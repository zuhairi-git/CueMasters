import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const { nineBallOn, nineBallTargets, resolveNineBallShot } = await loadSource('pool-rules');
const { nineBallRack, radius, isMoving, shotSpeed, step, strikeBall } = await loadSource('physics');
const { validGame } = await loadSource('saved-game');
const { chooseShot } = await loadSource('opponent');
const { careerOpening, careerProgress, careerStage, finishCareerStage } = await loadSource('career');
const { cities } = await loadSource('circuit');
const { linkedPage, savedPage, savePage } = await loadSource('page-state');
const { avatarArt, avatarLooks, rivalAvatar, robotAvatar } = await loadSource('avatar-art');

const shot = overrides => resolveNineBallShot({ turn: 0, targets: [1], firstContact: 1, potted: [], scratch: false, ...overrides });

test('the nine-ball rack is a tight diamond with the one on the spot and the nine in the middle', () => {
  for (const random of [undefined, Math.random]) {
    const balls = nineBallRack(random);
    assert.equal(balls.length, 16);
    const racked = balls.slice(1, 10);
    assert.ok(racked.every(ball => !ball.pocketed));
    assert.ok(balls.slice(10).every(ball => ball.pocketed));
    assert.equal(balls[0].pocketed, false);
    // The one leads the rack and the nine sits level with the two widest balls.
    assert.ok(racked.every(ball => ball === balls[1] || ball.z > balls[1].z + radius));
    assert.ok(Math.abs(balls[1].x) < 0.001 && Math.abs(balls[9].x) < 0.002);
    const rows = [...new Set(racked.map(ball => Math.round(ball.z * 50)))].sort((a, b) => a - b);
    assert.equal(rows.length, 5);
    assert.equal(Math.round(balls[9].z * 50), rows[2]);
    for (let i = 0; i < racked.length; i++) {
      for (let j = i + 1; j < racked.length; j++) {
        assert.ok(Math.hypot(racked[i].x - racked[j].x, racked[i].z - racked[j].z) >= 2 * radius - 1e-9);
      }
    }
  }
  const shuffled = new Set(Array.from({ length: 12 }, () => nineBallRack(Math.random).slice(2, 9).map(ball => ball.x.toFixed(2) + ball.z.toFixed(2)).join()));
  assert.ok(shuffled.size > 1, 'the seven other balls change places between racks');
});

test('the lowest ball on the table is always the ball on', () => {
  const pocketed = nineBallRack().map(ball => ball.pocketed);
  assert.equal(nineBallOn(pocketed), 1);
  pocketed[1] = pocketed[2] = true;
  assert.deepEqual(nineBallTargets(pocketed), [3]);
  for (let index = 3; index <= 8; index++) pocketed[index] = true;
  assert.deepEqual(nineBallTargets(pocketed), [9]);
  pocketed[9] = true;
  assert.deepEqual(nineBallTargets(pocketed), []);
});

test('nine-ball turns, fouls and the winning nine', () => {
  assert.deepEqual(shot({}), { foul: false, winner: undefined, turn: 1, respotNine: false });
  assert.equal(shot({ potted: [4] }).turn, 0, 'any ball potted after a legal hit keeps the table');
  assert.deepEqual(shot({ firstContact: 3, potted: [3] }), { foul: true, winner: undefined, turn: 1, respotNine: false });
  assert.equal(shot({ firstContact: undefined }).foul, true);
  assert.equal(shot({ potted: [1], scratch: true }).turn, 1);
  assert.equal(shot({ potted: [9] }).winner, 0, 'a combination onto the nine wins');
  assert.equal(shot({ turn: 1, potted: [1, 9] }).winner, 1);
  assert.deepEqual(shot({ potted: [9], scratch: true }), { foul: true, winner: undefined, turn: 1, respotNine: true });
  assert.equal(shot({ firstContact: 9, potted: [9] }).respotNine, true);
  assert.equal(shot({ targets: [9], firstContact: 9, potted: [9] }).winner, 0);
});

test('a nine-ball save is valid and never doubles as a snooker frame', () => {
  const state = {
    version: 1, balls: nineBallRack(), snooker: false, nineBall: true, versusComputer: true, onlineMode: false,
    turn: 0, scores: [2, 1], groups: [null, null], breaking: false, shotWasBreak: false, colourAfterRed: false,
    finished: false, shotTargets: [3], previouslyPocketed: [], rolling: false, aim: [0, 1], strike: 0, shotPower: 0,
    tip: [0, 0], aimLocked: false,
  };
  assert.equal(validGame(state), true);
  assert.equal(validGame({ ...state, nineBall: 'yes' }), false);
  assert.equal(validGame({ ...state, snooker: true }), false);
});

test('the computer plays the ball on in nine-ball and takes the nine when it is there', () => {
  for (const difficulty of ['Medium', 'Hard', 'Expert']) {
    const balls = nineBallRack();
    balls.forEach((ball, index) => { ball.pocketed = index !== 0 && index !== 3 && index !== 9; });
    Object.assign(balls[0], { x: .15, z: .02 });
    Object.assign(balls[3], { x: .43, z: 0 });
    Object.assign(balls[9], { x: -.3, z: .9 });
    const choice = chooseShot(balls, [3], difficulty, () => .5, true);
    strikeBall(balls[0], Math.sin(choice.angle), Math.cos(choice.angle), shotSpeed(choice.power));
    let contact;
    for (let tick = 0; tick < 1800 && balls.some(isMoving); tick++) {
      const hit = step(balls, 1 / 300);
      contact ??= hit;
    }
    assert.equal(contact, 3, difficulty + ' hits the ball on first');
    assert.equal(balls[3].pocketed, true, difficulty + ' pots the ball on');
    assert.equal(balls[0].pocketed, false);
  }
  const balls = nineBallRack();
  balls.forEach((ball, index) => { ball.pocketed = index !== 0 && index !== 9; });
  Object.assign(balls[0], { x: .15, z: .02 });
  Object.assign(balls[9], { x: .43, z: 0 });
  const winner = chooseShot(balls, [9], 'Hard', () => .5, true);
  strikeBall(balls[0], Math.sin(winner.angle), Math.cos(winner.angle), shotSpeed(winner.power));
  for (let tick = 0; tick < 1800 && balls.some(isMoving); tick++) step(balls, 1 / 300);
  assert.equal(balls[9].pocketed, true);
});

test('nine-ball has its own career with diamond racks', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const [helsinki] = cities;
  const opening = careerOpening(helsinki, 2, 'nineball', 0, () => .5);
  assert.equal(opening.balls.length, 16);
  assert.ok(opening.balls.slice(10).every(ball => ball.pocketed));
  assert.ok(opening.balls.slice(0, 10).every(ball => !ball.pocketed));
  assert.ok(opening.balls.slice(1, 10).every(ball => Math.hypot(ball.x - opening.balls[0].x, ball.z - opening.balls[0].z) > 2 * radius));
  assert.match(careerStage(helsinki, 0, 'nineball').objective, /nine-ball/);
  assert.match(careerStage(helsinki, 9, 'nineball').objective, /nine-ball/);
  finishCareerStage(helsinki, 0, 'nine-opening', true, false, 'nineball');
  assert.equal(careerProgress('nineball').coins, 75);
  assert.equal(careerProgress('pool').coins, 0);
  assert.equal(careerProgress('snooker').coins, 0);
});

test('nine-ball pages are remembered, without challenges or online play', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.history = { state: null, replaceState(state) { this.state = state; } };
  for (const page of [{ game: 'nineball', view: 'home' }, { game: 'nineball', view: 'stages', city: 'helsinki' }, { game: 'nineball', view: 'match' }]) {
    savePage(page);
    history.state = null;
    assert.deepEqual(savedPage(), page);
  }
  for (const view of ['challenges', 'online']) {
    localStorage.setItem('cue-master-page', JSON.stringify({ game: 'nineball', view }));
    assert.equal(savedPage(), undefined);
  }
  const link = query => linkedPage(new URL(query, 'https://example.test/'), 'pool');
  assert.deepEqual(link('?game=nineball&circuit=computer'), { game: 'nineball', view: 'computer' });
  assert.deepEqual(link('?game=nineball&circuit=challenges'), { game: 'nineball', view: 'home' });
});

test('every portrait is a distinct, well-formed drawing with parts to animate', () => {
  const ids = [...avatarLooks.map((_, index) => 'illustrated-' + (index + 1)), robotAvatar];
  assert.equal(avatarLooks.length, 16, 'saved avatar choices keep pointing at a portrait');
  const drawings = ids.map(avatarArt);
  assert.equal(new Set(drawings).size, ids.length);
  for (const svg of drawings) {
    assert.match(svg, /^<svg [^>]*viewBox="0 0 100 100"[^>]*>.*<\/svg>$/s);
    assert.match(svg, /class="av-head"/);
    assert.match(svg, /class="av-(eyes|glint)"/, 'eyes blink, or sunglasses glint');
    assert.doesNotMatch(svg, /undefined|NaN/);
    const open = (svg.match(/<(g|svg)[\s>]/g) ?? []).length;
    const closed = (svg.match(/<\/(g|svg)>/g) ?? []).length;
    assert.equal(open, closed, 'groups are balanced');
    for (const [, path] of svg.matchAll(/ d="([^"]+)"/g)) assert.match(path, /^[MmLlHhVvCcSsQqAaZz0-9 .,-]+$/);
  }
  assert.equal(avatarArt('missing'), avatarArt('illustrated-1'));
  for (const name of ['Aino Virtanen', 'Elsa Lindqvist', 'Magnus Holm', 'Lena Brandt', 'Sir Edmund Clarke']) {
    for (const taken of ids.slice(0, 16)) {
      const rival = rivalAvatar(name, taken);
      assert.ok(ids.includes(rival) && rival !== taken && rival !== robotAvatar);
      assert.equal(rival === rivalAvatar(name, 'none') || rivalAvatar(name, 'none') === taken, true, 'a rival keeps one face');
    }
  }
});
