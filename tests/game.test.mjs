import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { poolTargets, resolvePoolShot } = await loadSource('pool-rules');
const { cuePose, cueLength } = await loadSource('cue-geometry');
const { rack, radius, width, isMoving, shotSpeed, step, strikeBall } = await loadSource('physics');
const { validGame } = await loadSource('saved-game');
const { pocketDropDuration, pocketDropImpact, pocketDropPose, startPocketDrop } = await loadSource('pocket-drop');
const shot = overrides => resolvePoolShot({ turn: 0, groups: [null, null], targets: [1,2,3,4,5,6,7,9,10,11,12,13,14,15], firstContact: 1, potted: [], scratch: false, breaking: false, ...overrides });

test('a pocket drop starts at the lip, sinks toward the centre, and fades out', () => {
  const ball = { ...rack()[0], x: width / 2 - 0.03, z: 0, pocketed: true };
  const drop = startPocketDrop(ball, 1);
  assert.deepEqual(pocketDropPose(drop), { x: ball.x, z: 0, y: radius, scale: 1, opacity: 1 });
  drop.elapsed = pocketDropImpact;
  const impact = pocketDropPose(drop);
  assert.ok(impact.x > ball.x && impact.x < drop.pocket.x);
  assert.ok(impact.y < 0 && impact.opacity > 0);
  drop.elapsed = pocketDropDuration;
  const end = pocketDropPose(drop);
  assert.equal(end.x, drop.pocket.x);
  assert.equal(end.opacity, 0);
  assert.ok(end.y < impact.y && end.scale < impact.scale);
});

test('a legal pot assigns solids and stripes and retains the turn', () => {
  const result = shot({ potted: [1] });
  assert.deepEqual(result.groups, ['Solids', 'Stripes']);
  assert.equal(result.turn, 0);
});
test('miss and scratch switch players; scratch does not assign a group', () => {
  assert.equal(shot({}).turn, 1);
  const scratch = shot({ potted: [9], scratch: true });
  assert.equal(scratch.turn, 1);
  assert.equal(scratch.foul, true);
  assert.deepEqual(scratch.groups, [null, null]);
});
test('break leaves the table open and respots the eight', () => {
  const result = shot({ breaking: true, potted: [1,8] });
  assert.deepEqual(result.groups, [null, null]);
  assert.equal(result.respotEight, true);
  assert.equal(result.winner, undefined);
});
test('wrong group is a foul; an early eight loses; a legal eight wins', () => {
  assert.equal(shot({ groups: ['Solids','Stripes'], targets: [1], firstContact: 9 }).foul, true);
  assert.equal(shot({ potted: [8] }).winner, 1);
  assert.equal(shot({ targets: [8], firstContact: 8, potted: [8], calledPocket: 0, eightPocket: 0 }).winner, 0);
  assert.equal(shot({ targets: [8], firstContact: 8, potted: [8], scratch: true }).winner, 1);
});
test('the eight becomes eligible only after the assigned group is cleared', () => {
  const gone = Array(16).fill(false);
  assert.equal(poolTargets(gone, 'Solids').includes(8), false);
  for (let i = 1; i <= 7; i++) gone[i] = true;
  assert.deepEqual(poolTargets(gone, 'Solids'), [8]);
});
test('cue shaft stays above cloth, rail, and a ball behind the cue ball', () => {
  const balls = rack().slice(0,2);
  Object.assign(balls[0], {x: 0, z: 0});
  Object.assign(balls[1], {x: 0, z: -0.2});
  const pose = cuePose(balls, 0, 1, 0, -0.7, 0);
  assert.ok(pose.center.y > radius * 2);
  const tipZ = pose.center.z + pose.direction.z * cueLength / 2;
  const tipY = pose.center.y + pose.direction.y * cueLength / 2;
  const atBall = tipY + (tipZ + 0.2) * (-pose.direction.y / pose.direction.z);
  assert.ok(atBall >= 2 * radius + 0.01);
  Object.assign(balls[0], { x: width / 2 - radius - 0.01, z: 0.2 });
  const railPose = cuePose(balls.slice(0,1), -1, 0, 0, 0, 0);
  assert.ok(railPose.center.y > 0.08);
});
test('corrupt saves and unbounded network states are rejected', () => {
  for (const bad of [null, {}, {version: 1}, {version: 1, balls: [{x: Infinity}]}]) assert.equal(validGame(bad), false);
});

const { directionToBall, traceShot } = await loadSource('aim-guide');
test('aim direction points from the cue ball to the selected object ball', () => {
  assert.deepEqual(directionToBall({ x: 1, z: 2 }, { x: 4, z: 6 }), { x: 0.6, z: 0.8 });
  assert.equal(directionToBall({ x: 1, z: 2 }, { x: 1, z: 2 }), undefined);
});
test('object-ball guide reaches an aligned pocket and stops at an intervening ball', () => {
  const make = (x,z) => ({x,z,vx:0,vz:0,spinX:0,spinZ:0,sideSpin:0,pocketed:false});
  const balls = [make(0,0), make(0.25,0)];
  const guide = traceShot(balls, 1, 0);
  assert.equal(guide.target, 1);
  assert.ok(guide.pocket && guide.pocket.x > 0 && guide.pocket.z === 0);
  assert.ok(guide.impact.x < balls[1].x - radius);
  balls.push(make(0.4, 0));
  const blocked = traceShot(balls, 1, 0);
  assert.equal(blocked.pocket, undefined);
  assert.ok(blocked.objectEnd.x < 0.4);
});

test('saved games round-trip with a moving shot, groups, turn and aim lock', () => {
  const saved = {
    version:1, balls:rack(), snooker:false, versusComputer:true, onlineMode:false,
    turn:1, scores:[0,0], groups:['Solids','Stripes'], breaking:false, shotWasBreak:false,
    colourAfterRed:false, finished:false, firstContact:9, shotTargets:[9,10,11,12,13,14,15],
    previouslyPocketed:Array(16).fill(false), rolling:true, placement:undefined,
    aim:[0,1], strike:0, shotPower:0.6, tip:[0.1,-0.2], aimLocked:false,
  };
  saved.balls[0].vz = 1.5;
  assert.equal(validGame(saved), true);
  saved.balls[0].orientation = [0.6, 0, 0, 0.8];
  const restored = JSON.parse(JSON.stringify(saved));
  assert.equal(validGame(restored), true);
  assert.equal(restored.balls[0].vz, 1.5);
  assert.deepEqual(restored.balls[0].orientation, saved.balls[0].orientation);
  assert.deepEqual(restored.groups, ['Solids','Stripes']);
  assert.equal(restored.turn, 1);
  restored.balls[0].orientation = [0, 0, 0, 0];
  assert.equal(validGame(restored), false);
  delete restored.balls[0].orientation;
  restored.balls[0].x = 99;
  assert.equal(validGame(restored), false);
});



test('the black eight must enter the called pocket', () => {
  const base = { targets: [8], firstContact: 8, potted: [8] };
  assert.equal(shot({...base, calledPocket: 2, eightPocket: 2}).winner, 0);
  assert.equal(shot({...base, calledPocket: 2, eightPocket: 3}).winner, 1);
  assert.equal(shot({...base, eightPocket: 2}).winner, 1);
});

test('the beginner computer can win by calling and potting a makeable eight', async () => {
  const { chooseShot } = await loadSource('opponent');
  const balls = rack();
  balls.forEach((ball, index) => { ball.pocketed = index !== 0 && index !== 8; });
  Object.assign(balls[0], { x: .15, z: .02 });
  Object.assign(balls[8], { x: .43, z: 0 });
  const shot = chooseShot(balls, [8], 'Beginner', () => .8);
  assert.equal(shot.pocket, 4);
  strikeBall(balls[0], Math.sin(shot.angle), Math.cos(shot.angle), shotSpeed(shot.power));
  for (let tick = 0; tick < 1800 && balls.some(isMoving); tick++) step(balls, 1 / 300);
  assert.equal(balls[8].pocketed, true);
  assert.equal(balls[0].pocketed, false);
});
