import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { attachOnline } from '../server/online.mjs';
import { createCircuit } from '../server/circuit.mjs';

function inbox(socket) {
  const queue = [], waiting = [];
  socket.on('message', raw => {
    const value = JSON.parse(raw.toString());
    const listener = waiting.shift();
    if (listener) listener(value); else queue.push(value);
  });
  return async type => {
    const message = queue.length ? queue.shift() : await new Promise(resolve => waiting.push(resolve));
    assert.equal(message.type, type, JSON.stringify(message));
    return message;
  };
}
test('online IDs, host authority, profile names, and refresh reconnection', { timeout: 10000 }, async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const server = createServer();
  const sockets = attachOnline(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { for (const ws of sockets.clients) ws.terminate(); server.close(); });
  const url = 'ws://127.0.0.1:' + server.address().port + '/play';
  const connect = async (secret, name) => {
    const ws = new WebSocket(url);
    const next = inbox(ws);
    await once(ws, 'open');
    ws.send(JSON.stringify({type: 'register', secret, name}));
    const registration = await next('registered');
    return {ws, next, id: registration.playerId, send: data => ws.send(JSON.stringify(data))};
  };
  const host = await connect('a'.repeat(64), 'Alice');
  const guest = await connect('b'.repeat(64), 'Bob');
  assert.match(host.id, /^[A-F0-9]{12}$/);
  guest.send({type: 'join', playerId: '000000000000'});
  await guest.next('error');
  host.send({type: 'host'});
  await host.next('waiting');
  guest.send({type: 'join', playerId: host.id});
  assert.equal((await host.next('paired')).peerName, 'Bob');
  assert.equal((await guest.next('paired')).seat, 1);
  guest.send({type: 'state', state: {forged: true}});
  host.send({type: 'state', state: {turn: 1, sequence: 7}});
  assert.deepEqual((await guest.next('state')).state, {turn: 1, sequence: 7});
  guest.send({type: 'input', input: {action: 'shoot', strength: 0.5}});
  assert.equal((await host.next('input')).input.strength, 0.5);
  guest.send({type: 'profile', name: 'Bobby'});
  assert.equal((await host.next('profile')).name, 'Bobby');
  guest.ws.close();
  await host.next('ended');
  const rejoined = await connect('b'.repeat(64), 'Bobby');
  assert.equal(rejoined.id, guest.id);
  const hostResume = await host.next('paired');
  const guestResume = await rejoined.next('paired');
  assert.equal(hostResume.resume, true);
  assert.deepEqual(guestResume.state, {turn: 1, sequence: 7});
  rejoined.send({type: 'leave'});
  await rejoined.next('left');
  assert.deepEqual(await host.next('departure'), {type: 'departure', remaining: 30000, seat: 0, peerName: 'Bobby'});
  now += 29999;
  host.send({type: 'host'});
  await host.next('error');
  now += 1;
  assert.equal((await host.next('ended')).winner, 0);

  host.send({type: 'host'});
  await host.next('waiting');
  rejoined.send({type: 'join', playerId: host.id});
  await host.next('paired');
  await rejoined.next('paired');
  host.send({type: 'state', state: {turn: 0, rolling: false, strike: 0, finished: false}});
  await host.next('clock');
  await rejoined.next('clock');
  await rejoined.next('state');
  now += 10000;
  host.send({type: 'leave'});
  await host.next('left');
  assert.deepEqual(await rejoined.next('departure'), {type: 'departure', remaining: 20000, seat: 1, peerName: 'Alice'});
  now += 20000;
  assert.equal((await rejoined.next('ended')).winner, 1);
});

test('city matchmaking enforces unlocks and persists each result once', { timeout: 10000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'billiard-circuit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'progress.json');
  const circuit = createCircuit(file);
  const server = createServer((request, response) => {
    if (!circuit.handleRequest(request, response)) response.writeHead(404).end();
  });
  const sockets = attachOnline(server, circuit);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { for (const ws of sockets.clients) ws.terminate(); server.close(); });
  const address = '127.0.0.1:' + server.address().port;
  async function player(secret) {
    const ws = new WebSocket('ws://' + address + '/play');
    const next = inbox(ws);
    await once(ws, 'open');
    const send = message => ws.send(JSON.stringify(message));
    send({ type: 'register', secret });
    const { playerId } = await next('registered');
    return { next, send, playerId, secret };
  }
  const host = await player('a'.repeat(64));
  const guest = await player('b'.repeat(64));
  const progress = async ({ secret }) => (await fetch('http://' + address + '/circuit-progress', {
    method: 'POST', headers: { 'X-Player-Secret': secret },
  })).json();
  host.send({ type: 'city-queue', city: 'stockholm' });
  await host.next('error');
  host.send({ type: 'city-queue', city: 'helsinki' });
  await host.next('city-waiting');
  guest.send({ type: 'city-queue', city: 'helsinki' });
  assert.equal((await host.next('paired')).city, 'helsinki');
  assert.equal((await guest.next('paired')).seat, 1);
  guest.send({ type: 'state', state: { finished: true, winner: 1 } });
  const finalState = { type: 'state', state: { turn: 0, finished: true, winner: 0 } };
  host.send(finalState);
  host.send(finalState);
  assert.deepEqual((await host.next('circuit-result')).result, { winner: 0, firstWin: true });
  assert.deepEqual((await guest.next('circuit-result')).result, { winner: 0, firstWin: true });
  assert.deepEqual(await progress(host), { helsinki: { wins: 1, losses: 0 } });
  assert.deepEqual(await progress(guest), { helsinki: { wins: 0, losses: 1 } });
  const reopened = createCircuit(file);
  assert.equal(reopened.canEnter(host.playerId, 'stockholm'), true);
  assert.equal(reopened.canEnter(guest.playerId, 'stockholm'), false);
});

test('profile QR codes round-trip through the same decoder used by the scanner', () => {
  const text = 'https://billiard.example/?join=ABCDEF123456';
  const qr = QRCode.create(text, {errorCorrectionLevel: 'M'});
  const scale = 8, margin = 4;
  const size = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let py = 0; py < scale; py++) for (let px = 0; px < scale; px++) {
      const i = (((y + margin) * scale + py) * size + (x + margin) * scale + px) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
  }
  assert.equal(jsQR(pixels, size, size)?.data, text);
});
