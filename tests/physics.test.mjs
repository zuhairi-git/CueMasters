import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/physics.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { radius, width, length, pockets, rack, step, strikeBall, isMoving, shotSpeed, maxBallSpeed } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const ball = (x = 0, z = 0, vx = 0, vz = 0) => ({ x, z, vx, vz, spinX: vx, spinZ: vz, sideSpin: 0, pocketed: false });
const advance = (balls, time, dt = 1 / 300) => {
  for (let t = 0; t < time - 1e-9; t += dt) step(balls, Math.min(dt, time - t));
};
const energy = balls => balls.reduce((sum, b) => sum + b.vx ** 2 + b.vz ** 2 + 0.4 * (b.spinX ** 2 + b.spinZ ** 2 + (radius * b.sideSpin) ** 2), 0);

test('head-on collision transfers speed and reports the first object ball', () => {
  const balls = [ball(-2 * radius - 0.001, 0, 1), ball()];
  const before = energy(balls);
  assert.equal(step(balls, 1 / 300), 1);
  assert.ok(balls[0].vx < 0.03);
  assert.ok(balls[1].vx > 0.95);
  assert.ok(energy(balls) <= before);
});

test('cut collision deflects the cue and object balls to opposite sides', () => {
  const balls = [ball(-0.08, -0.025, 1), ball()];
  advance(balls, 0.035);
  assert.ok(balls[0].vz < 0);
  assert.ok(balls[1].vz > 0);
  assert.ok(balls[1].vx > 0);
});

test('sliding friction spends energy, transitions to rolling, and stops', () => {
  const b = ball();
  strikeBall(b, 0, 1, 0.7);
  const initial = energy([b]);
  advance([b], 0.15);
  assert.ok(energy([b]) < initial);
  assert.ok(Math.abs(b.vz - b.spinZ) < 1e-6);
  advance([b], 5);
  assert.equal(isMoving(b), false);
});

test('visible rotation follows spin through skid, roll, and sidespin', () => {
  const rolling = ball(0, 0, 0, 1);
  const skidding = ball();
  strikeBall(skidding, 0, 1, 1);
  advance([rolling], 0.03);
  advance([skidding], 0.03);
  const [x, y, z, w] = rolling.orientation;
  assert.ok(Math.abs(2 * Math.atan2(x, w) - rolling.z / radius) < 0.001);
  assert.equal(y, 0);
  assert.equal(z, 0);
  assert.ok(skidding.z > rolling.z * 0.95);
  assert.ok(skidding.orientation[0] < x * 0.1);

  const spinning = { ...ball(), sideSpin: 4 };
  step([spinning], 1 / 300);
  assert.ok(spinning.orientation[1] > 0);
  assert.equal(spinning.x, 0);
  assert.equal(spinning.z, 0);
  assert.ok(Math.abs(Math.hypot(...spinning.orientation) - 1) < 1e-12);
});

test('backspin draws the cue back after contact; topspin follows forward', () => {
  const shot = tip => {
    const balls = [ball(-2 * radius - 0.001), ball()];
    strikeBall(balls[0], 1, 0, 1.5, 0, tip);
    advance(balls, 0.12);
    return balls[0].vx;
  };
  assert.ok(shot(-0.78) < -0.1);
  assert.ok(shot(0.78) > 0.1);
});

test('a cushion rebounds the normal component and loses energy', () => {
  const b = ball(width / 2 - radius - 0.015, 0.3, 1, 0.2);
  const before = energy([b]);
  advance([b], 0.025);
  assert.ok(b.vx < -0.6 && b.vx > -0.85);
  assert.ok(b.x <= width / 2 - radius);
  assert.ok(energy([b]) < before);
});

test('cushion impacts emit rail sounds scaled to the incoming speed', () => {
  const events = [];
  const b = ball(width / 2 - radius - 0.015, 0.3, 2, 0);
  step([b], 1 / 30, (kind, strength) => events.push({ kind, strength }));
  const rails = events.filter(event => event.kind === 'rail');
  assert.equal(rails.length, 1);
  assert.ok(rails[0].strength > 1.5 && rails[0].strength <= 2);
});

test('each pocket admits a straight shot without an invisible cushion', () => {
  for (const p of pockets) {
    const dx = p.x, dz = p.z;
    const distance = Math.hypot(dx, dz);
    const nx = dx / distance, nz = dz / distance;
    const b = ball(p.x - nx * 0.16, p.z - nz * 0.16, nx, nz);
    advance([b], 0.25);
    assert.equal(b.pocketed, true, JSON.stringify(p));
    assert.equal(isMoving(b), false);
  }
});

test('a ball grazing a pocket jaw rebounds rather than disappearing', () => {
  const b = ball(width / 2 - 0.1, 0.09, 1);
  advance([b], 0.15);
  assert.equal(b.pocketed, false);
  assert.ok(b.vx < 0);
});

test('fast shots do not tunnel through another ball at a large timestep', () => {
  const balls = [ball(-0.25, 0, 12), ball()];
  assert.equal(step(balls, 1 / 30), 1);
  assert.ok(balls[1].vx > 6 && balls[1].vx <= maxBallSpeed);
});

test('break remains finite, separates the rack, and eventually settles', () => {
  const balls = rack();
  strikeBall(balls[0], 0, 1, 4.3);
  advance(balls, 25);
  for (const b of balls) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
    if (b.pocketed) continue;
    assert.ok(Math.abs(b.x) < width / 2 + 0.07 && Math.abs(b.z) < length / 2 + 0.07);
    assert.equal(isMoving(b), false);
  }
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    if (balls[i].pocketed || balls[j].pocketed) continue;
    assert.ok(Math.hypot(balls[i].x - balls[j].x, balls[i].z - balls[j].z) >= 2 * radius - 0.0001);
  }
});

test('small rack variations change the spread of identical breaks', () => {
  const makeRack = seed => rack(false, () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const first = makeRack(1), second = makeRack(2);
  for (const balls of [first, second]) {
    assert.deepEqual(balls[1], rack()[1]);
    assert.ok(balls[8].z > balls[1].z && Math.abs(balls[8].x) < 0.001);
    assert.ok(balls[7].x < -0.14 && balls[15].x > 0.14);
    for (let i = 1; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      assert.ok(Math.hypot(balls[i].x - balls[j].x, balls[i].z - balls[j].z) >= 2 * radius);
    }
    strikeBall(balls[0], 0, 1, 4.3);
    advance(balls, 2);
  }
  const spreadDifference = first.slice(1).reduce((total, b, i) =>
    total + Math.hypot(b.x - second[i + 1].x, b.z - second[i + 1].z), 0);
  assert.ok(spreadDifference > 0.2);
});

test('equal elapsed time gives consistent results across caller frame rates', () => {
  const a = [ball(0, 0.2, 0.8, 0.3)];
  const b = structuredClone(a);
  advance(a, 2, 1 / 30);
  advance(b, 2, 1 / 144);
  assert.ok(Math.hypot(a[0].x - b[0].x, a[0].z - b[0].z) < 0.01);
  assert.ok(Math.hypot(a[0].vx - b[0].vx, a[0].vz - b[0].vz) < 0.01);
});


test('shot strength is bounded, monotonic, and gives finer control for soft shots', () => {
  assert.equal(shotSpeed(0), 0);
  assert.equal(shotSpeed(-10), 0);
  assert.equal(shotSpeed(NaN), 0);
  assert.equal(shotSpeed(100), 4.3);
  assert.ok(shotSpeed(0.2) < shotSpeed(0.5) && shotSpeed(0.5) < shotSpeed(1));
  assert.ok(shotSpeed(0.2) < 0.2 * 4.3);
  const b = ball();
  strikeBall(b, 10, 0, 999, 999, 999);
  assert.equal(b.vx, 4.3);
  assert.ok(Number.isFinite(energy([b])));
});

test('all pocket approaches stay contained at soft, hard, and excessive speeds', () => {
  for (const pocket of pockets) for (const offset of [-0.5, -0.25, 0, 0.25, 0.5]) for (const speed of [0.3, 2, 4.3, 8]) {
    const toward = Math.atan2(pocket.x, pocket.z);
    const startX = pocket.x - Math.sin(toward) * 0.25;
    const startZ = pocket.z - Math.cos(toward) * 0.25;
    const b = ball(startX, startZ, Math.sin(toward + offset) * speed, Math.cos(toward + offset) * speed);
    for (let frame = 0; frame < 60; frame++) {
      step([b], 1 / 30);
      assert.ok(Number.isFinite(energy([b])));
      if (b.pocketed) break;
      assert.ok(Math.abs(b.x) <= width / 2 + 0.04001 && Math.abs(b.z) <= length / 2 + 0.04001, JSON.stringify(b));
      assert.ok(Math.hypot(b.vx, b.vz) <= maxBallSpeed + 1e-8);
    }
  }
});

test('non-finite inputs and escaped positions recover to a finite contained state', () => {
  const balls = [ball(10, -10, Infinity, NaN), ball(NaN, Infinity)];
  step(balls, 1 / 30);
  for (const b of balls) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(energy([b])));
    assert.ok(Math.abs(b.x) <= width / 2 + 0.04 && Math.abs(b.z) <= length / 2 + 0.04);
  }
});

test('six hard breaks with varied spin never leave the frame or gain energy', () => {
  for (let shot = 0; shot < 6; shot++) {
    const balls = rack();
    const angle = (shot - 2.5) * 0.03;
    strikeBall(balls[0], Math.sin(angle), Math.cos(angle), 4.3, (shot % 3 - 1) * 0.4, shot % 2 ? 0.5 : -0.5);
    let previousEnergy = energy(balls);
    for (let frame = 0; frame < 300; frame++) {
      step(balls, 1 / 30);
      const currentEnergy = energy(balls);
      assert.ok(currentEnergy <= previousEnergy + 1e-6);
      previousEnergy = currentEnergy;
      for (const b of balls) if (!b.pocketed) assert.ok(Math.abs(b.x) <= width / 2 + 0.04001 && Math.abs(b.z) <= length / 2 + 0.04001);
    }
  }
});
