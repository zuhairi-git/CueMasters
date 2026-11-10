import { createHash } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { expireShotClock, pauseShotClock, resumeShotClock, shotTimeMs, updateShotClock } from './shot-clock.mjs';

export function attachOnline(server) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });
  const players = new Map();
  const rooms = new Map();
  const send = (ws, message) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  const sendClock = room => {
    if (!room.clock) return;
    const clock = room.clock;
    const data = { type: 'clock', remaining: clock.deadline === null ? clock.remaining ?? shotTimeMs : Math.max(0, clock.deadline - Date.now()), running: clock.deadline !== null && !clock.expired, turn: clock.turn };
    send(players.get(room.hostId) ?? {}, data);
    send(players.get(room.guestId) ?? {}, data);
  };
  const expire = room => {
    if (expireShotClock(room)) {
      const host = players.get(room.hostId);
      if (host?.peer) { send(host, { type: 'timeout', turn: room.clock.turn }); sendClock(room); }
    }
  };
  const sendDeparture = room => {
    const departure = room.departure;
    const remaining = Math.max(0, departure.deadline - Date.now());
    const peer = players.get(departure.winnerId);
    if (peer?.readyState !== WebSocket.OPEN) return;
    if (remaining > 0) {
      send(peer, { type: 'departure', remaining, seat: departure.winner, peerName: departure.name });
    } else {
      rooms.delete(departure.winnerId);
      send(peer, { type: 'ended', winner: departure.winner, peerName: departure.name, message: 'You won because your opponent left the game.' });
    }
  };
  const leave = ws => {
    const room = rooms.get(ws.playerId);
    const peer = ws.peer;
    ws.peer = undefined;
    ws.hosting = false;
    rooms.delete(ws.playerId);
    if (peer) peer.peer = undefined;
    if (room && !room.departure) {
      const seat = ws.playerId === room.hostId ? 0 : 1;
      const winnerId = seat === 0 ? room.guestId : room.hostId;
      if (room.state?.finished) {
        rooms.delete(winnerId);
        if (peer) send(peer, { type: 'ended', message: 'Opponent left. Create a new invite to play again.' });
      } else {
        const now = Date.now();
        const clock = room.clock;
        const remaining = clock?.turn === seat
          ? Math.max(0, clock.deadline === null ? clock.remaining ?? shotTimeMs : clock.deadline - now)
          : shotTimeMs;
        room.departure = { deadline: now + remaining, winnerId, winner: 1 - seat, name: ws.playerName };
        room.updated = now;
        sendDeparture(room);
      }
    }
    send(ws, { type: 'left' });
  };
  const pair = room => {
    const host = players.get(room.hostId), guest = players.get(room.guestId);
    if (!host || !guest) return;
    host.peer = guest;
    guest.peer = host;
    host.hosting = guest.hosting = false;
    host.isHost = true;
    guest.isHost = false;
    resumeShotClock(room);
    send(host, { type: 'paired', seat: 0, peerId: guest.playerId, peerName: guest.playerName, resume: Boolean(room.state), state: room.state });
    send(guest, { type: 'paired', seat: 1, peerId: host.playerId, peerName: host.playerName, resume: Boolean(room.state), state: room.state });
    sendClock(room);
    if (room.clock?.expired) send(host, { type: 'timeout', turn: room.clock.turn });
  };
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/play') return;
    if (request.headers.origin) {
      try {
        if (new URL(request.headers.origin).host !== request.headers.host) { socket.destroy(); return; }
      } catch { socket.destroy(); return; }
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws));
  });
  sockets.on('connection', ws => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    let windowStart = Date.now(), messages = 0;
    const registrationTimeout = setTimeout(() => { if (!ws.playerId) ws.close(1008, 'Register first'); }, 10000);
    ws.on('message', raw => {
      if (Date.now() - windowStart > 1000) { windowStart = Date.now(); messages = 0; }
      if (++messages > 100) { ws.close(1008, 'Too many messages'); return; }
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.type === 'register' && !ws.playerId) {
        if (typeof data.secret !== 'string' || !/^[a-f0-9]{64}$/.test(data.secret)) return;
        const id = createHash('sha256').update(data.secret).digest('hex').slice(0, 12).toUpperCase();
        if (players.has(id)) { send(ws, { type: 'error', message: 'This player ID is already open in another tab.' }); ws.close(); return; }
        ws.playerId = id;
        ws.playerName = typeof data.name === 'string' ? data.name.trim().slice(0, 24) || 'Player' : 'Player';
        players.set(id, ws);
        clearTimeout(registrationTimeout);
        send(ws, { type: 'registered', playerId: id });
        const room = rooms.get(id);
        if (room?.departure) sendDeparture(room);
        else if (room) pair(room);
        return;
      }
      if (!ws.playerId) return;
      if ((data.type === 'host' || data.type === 'join') && rooms.has(ws.playerId)) {
        send(ws, { type: 'error', message: 'End your current online game before starting another.' });
        return;
      }
      if (data.type === 'host') {
        ws.hosting = true;
        send(ws, { type: 'waiting' });
      } else if (data.type === 'join' && !ws.peer) {
        const host = typeof data.playerId === 'string' ? players.get(data.playerId.toUpperCase()) : undefined;
        if (!host || !host.hosting || host.peer || host === ws) {
          send(ws, { type: 'error', message: 'That player is not waiting for a game. Ask them to create an invite.' });
          return;
        }
        const room = { hostId: host.playerId, guestId: ws.playerId, state: undefined, updated: Date.now() };
        rooms.set(host.playerId, room);
        rooms.set(ws.playerId, room);
        pair(room);
      } else if (data.type === 'state' && ws.peer && ws.isHost) {
        const room = rooms.get(ws.playerId);
        if (room) {
          room.state = data.state;
          room.updated = Date.now();
          updateShotClock(room, data.state);
          if (Date.now() - (room.lastClockSent ?? 0) >= 500) { sendClock(room); room.lastClockSent = Date.now(); }
        }
        send(ws.peer, { type: 'state', state: data.state });
      } else if (data.type === 'input' && ws.peer && !ws.isHost) {
        const room = rooms.get(ws.playerId);
        if (room?.clock?.deadline != null && Date.now() >= room.clock.deadline) expire(room);
        else send(ws.peer, { type: 'input', input: data.input });
      } else if (data.type === 'profile') {
        if (typeof data.name === 'string') ws.playerName = data.name.trim().slice(0, 24) || 'Player';
        if (ws.peer) send(ws.peer, { type: 'profile', name: ws.playerName });
      } else if (data.type === 'leave') leave(ws);
    });
    ws.on('close', () => {
      clearTimeout(registrationTimeout);
      // Keep the last authoritative state for ten minutes so refresh can resume.
      const peer = ws.peer;
      const room = rooms.get(ws.playerId);
      if (room && !room.departure) pauseShotClock(room);
      if (peer) {
        peer.peer = undefined;
        send(peer, { type: 'ended', message: 'Opponent disconnected. Waiting for them to reconnect…' });
      }
      if (players.get(ws.playerId) === ws) players.delete(ws.playerId);
    });
    ws.on('error', () => {});
  });
  const heartbeat = setInterval(() => {
    for (const [id, room] of rooms) if (Date.now() - room.updated > 10 * 60 * 1000) rooms.delete(id);
    for (const ws of sockets.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  heartbeat.unref();
  const clockTick = setInterval(() => {
    for (const room of new Set(rooms.values())) {
      if (room.departure) {
        if (Date.now() >= room.departure.deadline) sendDeparture(room);
      } else if (players.get(room.hostId)?.peer && room.clock) { expire(room); sendClock(room); }
    }
  }, 500);
  clockTick.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(clockTick);
    for (const ws of sockets.clients) ws.terminate();
    sockets.close();
  });
  return sockets;
}
