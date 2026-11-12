import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const {
  careerCityStatus, careerClears, careerGoal, careerLayout, careerProgress, careerRank, careerStage, careerStageStatus,
  equipCareerCue, finishCareerStage,
} = await loadSource('career');
const { cities } = await loadSource('circuit');
const { isMoving, radius, shotSpeed, step, strikeBall } = await loadSource('physics');
const [helsinki, stockholm, copenhagen] = cities;

function freshStorage() {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
}

test('first clears open pairs, pay once, buy equipment, and unlock the next city', () => {
  freshStorage();
  assert.equal(careerCityStatus(stockholm, careerProgress()), 'Locked');
  assert.equal(careerStageStatus(helsinki, 1, careerProgress()), 'Locked');
  finishCareerStage(helsinki, 0, 'loss', false);
  assert.equal(careerProgress().coins, 0);
  finishCareerStage(helsinki, 0, 'opening', true);
  finishCareerStage(helsinki, 0, 'opening', true);
  finishCareerStage(helsinki, 0, 'replay', true);
  assert.equal(careerProgress().coins, 75);
  assert.equal(careerStageStatus(helsinki, 1, careerProgress()), 'Unlocked');
  assert.equal(careerStageStatus(helsinki, 2, careerProgress()), 'Unlocked');
  assert.equal(careerStageStatus(helsinki, 3, careerProgress()), 'Locked');
  assert.equal(equipCareerCue('Classic Maple'), false);

  for (let index = 1; index <= 3; index++) finishCareerStage(helsinki, index, 'match-' + index, true);
  assert.equal(careerProgress().coins, 300);
  assert.equal(equipCareerCue('Classic Maple'), true);
  assert.equal(equipCareerCue('Classic Maple'), true);
  assert.equal(careerProgress().coins, 0);
  assert.equal(careerProgress().equipped, 'Classic Maple');
  for (let index = 4; index <= 9; index++) finishCareerStage(helsinki, index, 'match-' + index, true);
  assert.equal(careerCityStatus(helsinki, careerProgress()), 'Completed');
  assert.equal(careerCityStatus(stockholm, careerProgress()), 'Unlocked');
  assert.equal(careerProgress().coins, 600);
  assert.equal(careerProgress().points, 550);
});

test('old wins preserve access without granting new clears or coins', () => {
  freshStorage();
  localStorage.setItem('billiard-computer-circuit-v1', JSON.stringify({ helsinki: { wins: 1, losses: 0 } }));
  assert.equal(careerCityStatus(stockholm, careerProgress()), 'Unlocked');
  assert.equal(careerCityStatus(copenhagen, careerProgress()), 'Locked');
  assert.equal(careerClears(helsinki, careerProgress()), 0);
  assert.equal(careerProgress().coins, 0);
});

test('a replay can earn a missed skill bonus exactly once', () => {
  freshStorage();
  assert.equal(careerRank(0), 'Rookie');
  assert.equal(careerGoal(helsinki, 0), 'Clear without scratching');
  assert.equal(careerGoal(helsinki, 2), 'Clear on your first attempt');
  finishCareerStage(helsinki, 0, 'first', true);
  finishCareerStage(helsinki, 0, 'failed', false, true);
  assert.equal(careerProgress().coins, 75);
  finishCareerStage(helsinki, 0, 'bonus', true, true);
  finishCareerStage(helsinki, 0, 'bonus', true, true);
  finishCareerStage(helsinki, 0, 'another', true, true);
  assert.equal(careerProgress().coins, 85);
  assert.equal(careerProgress().points, 35);
  assert.equal(careerProgress().bonuses.helsinki[0], 'bonus');
  assert.equal(careerRank(500), 'Club Player');
});

test('London final has distinct rack layouts throughout its best-of-three', () => {
  const london = cities.at(-1);
  assert.equal(careerStage(london, 9).bestOfThree, true);
  const layouts = [0, 1, 2].map(round => careerLayout(london, 9, round));
  assert.equal(new Set(layouts.map(layout => JSON.stringify(layout))).size, 3);
  assert.ok(layouts.every(layout => layout.every(ball => !ball.pocketed)));
});

test('preset balls do not overlap and the starter cue can complete Helsinki’s bank shot', () => {
  for (const city of cities) {
    for (let index = 0; index < 10; index++) {
      const active = careerLayout(city, index)?.filter(ball => !ball.pocketed) ?? [];
      for (const [i, ball] of active.entries()) {
        assert.ok(active.slice(i + 1).every(other => Math.hypot(ball.x - other.x, ball.z - other.z) >= radius * 2));
      }
    }
  }
  const balls = careerLayout(helsinki, 5);
  const angle = 1.4850457723982544;
  let banked = false;
  let first;
  strikeBall(balls[0], Math.cos(angle), Math.sin(angle), shotSpeed(.75));
  for (let tick = 0; tick < 240 && balls.some(isMoving); tick++) {
    const contact = step(balls, 1 / 30, undefined, ball => { if (ball === balls[1]) banked = true; });
    first ??= contact;
  }
  assert.equal(first, 1);
  assert.equal(banked, true);
  assert.equal(balls[1].pocketed, true);
  assert.equal(balls[0].pocketed, false);
});
