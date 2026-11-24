import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const { ShotHighlights, ShotRecording } = await loadSource('shot-highlights');
const { challengeLayout, getChallenge } = await loadSource('challenges');
const { rack, isMoving, shotSpeed, step, strikeBall } = await loadSource('physics');

test('live bank and kick challenge shots are recognized after settling, with fouls excluded', () => {
  for (const [challenge, angle, power, dt, expected] of [
    ['bank', 1.4850457723982544, .75, 1 / 30, 'bank'],
    ['kick-pot', 1.32, 1, 1 / 300, 'kick'],
  ]) {
    const balls = challengeLayout(getChallenge('pool', challenge));
    const highlights = new ShotHighlights(balls);
    let first;
    strikeBall(balls[0], Math.cos(angle), Math.sin(angle), shotSpeed(power));
    for (let tick = 0; tick < 10 / dt && balls.some(isMoving); tick++) {
      const hit = step(balls, dt, undefined,
        (ball, madeContact) => highlights.rail(ball, madeContact || first !== undefined),
        (a, b) => highlights.contact(a, b));
      first ??= hit;
    }
    assert.equal(first, 1);
    assert.equal(balls[1].pocketed, true);
    assert.equal(balls[0].pocketed, false);
    assert.equal(highlights.classify([1], true, false), expected);
    assert.equal(highlights.classify([1], false, false), undefined);
  }
});

test('ordinary pots are quiet and break highlights require at least three balls', () => {
  const balls = rack();
  const highlights = new ShotHighlights(balls);
  assert.equal(highlights.classify([1], true, false), undefined);
  assert.equal(highlights.classify([1, 2], true, true), undefined);
  assert.equal(highlights.classify([1, 2, 3], true, true), 'break');
  assert.equal(highlights.classify([1, 2], true, false), 'double');

  highlights.contact(0, 2);
  highlights.contact(1, 2);
  assert.equal(highlights.classify([1], true, false), 'combo');
  highlights.contact(0, 1);
  assert.equal(highlights.classify([1], true, false), undefined);
});

test('replay keeps the strike and pocket drop while leaving the settled match state intact', () => {
  const balls = rack();
  const recording = new ShotRecording();
  const firstX = balls[1].x;
  recording.capture(0, balls, new Map());
  balls[1].x += .3;
  recording.capture(.5, balls, new Map());
  recording.markPot();
  balls[1].pocketed = true;
  const pose = { x: .1, y: .01, z: .2, scale: .8, opacity: .5 };
  recording.capture(.15, balls, new Map([[1, pose]]));
  recording.capture(.15, balls, new Map());
  const finalState = JSON.stringify(balls);
  const replay = recording.replay();
  assert.equal(replay.advance(0).balls[1].x, firstX);
  assert.deepEqual(replay.advance(.9).drops.get(1), pose);
  assert.equal(replay.advance(.2).balls[1].pocketed, true);
  assert.equal(replay.advance(.5), undefined);
  assert.equal(JSON.stringify(balls), finalState);
});
