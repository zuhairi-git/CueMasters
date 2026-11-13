import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const {
  careerCityStatus, careerClears, careerGoal, careerStages, careerProgress, careerRank, careerStage, careerStageStatus,
  equipCareerCue, finishCareerStage,
} = await loadSource('career');
const { cities } = await loadSource('circuit');
const { isMoving, radius, shotSpeed, step, strikeBall } = await loadSource('physics');
const { challenges, challengeLayout, challengeCompleted, completeChallenge, getChallenge } = await loadSource('challenges');
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
  assert.equal(careerGoal, 'Win without scratching');
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

test('every city level starts a full match in both games', () => {
  const london = cities.at(-1);
  for (const game of ['pool', 'snooker']) {
    for (const city of cities) {
      for (const [index] of careerStages.entries()) {
        const stage = careerStage(city, index, game);
        assert.equal(stage.bestOfThree, city === london && index === 9);
        assert.match(stage.objective, /full/);
        assert.equal(stage.layout, undefined);
        assert.equal(stage.challenge, undefined);
      }
    }
  }
});

test('Billiard and Snooker track progress and challenge completions separately', () => {
  freshStorage();
  localStorage.setItem('billiard-computer-circuit-v1', JSON.stringify({ helsinki: { wins: 1 } }));
  finishCareerStage(helsinki, 0, 'snooker-opening', true, true, 'snooker');
  assert.equal(careerClears(helsinki, careerProgress('snooker')), 1);
  assert.equal(careerProgress('snooker').coins, 85);
  assert.equal(careerProgress().coins, 0);
  assert.equal(careerCityStatus(stockholm, careerProgress('snooker'), 'snooker'), 'Locked');
  assert.equal(careerCityStatus(stockholm, careerProgress()), 'Unlocked');
  const poolEscape = getChallenge('pool', 'escape');
  const snookerEscape = getChallenge('snooker', 'escape');
  assert.equal(completeChallenge(poolEscape), true);
  assert.equal(challengeCompleted(poolEscape), true);
  assert.equal(challengeCompleted(snookerEscape), false);
});

test('challenge balls do not overlap and the starter cue can complete the bank shot', () => {
  for (const challenge of challenges) {
    const active = challengeLayout(challenge).filter(ball => !ball.pocketed);
    for (const [i, ball] of active.entries()) {
      assert.ok(active.slice(i + 1).every(other => Math.hypot(ball.x - other.x, ball.z - other.z) >= radius * 2));
    }
  }
  const balls = challengeLayout(getChallenge('pool', 'bank'));
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
