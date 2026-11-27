import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const {
  careerCityStatus, careerClears, careerGoal, careerOpening, careerStages, careerProgress, careerRank, careerStage, careerStageStatus,
  equipCareerCue, finishCareerStage,
} = await loadSource('career');
const { careerTable } = await loadSource('table-finishes');
const { cities } = await loadSource('circuit');
const { isMoving, length, radius, rack, shotSpeed, step, strikeBall } = await loadSource('physics');
const { challenges, challengeLayout, challengeCompleted, challengeStars, completeChallenge, gameStars, getChallenge, ratingFor, tierUnlocked } = await loadSource('challenges');
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
        const final = index === 9;
        assert.equal(stage.final, final);
        assert.equal(Boolean(stage.champion), final);
        // Every city ends in a series; pool's last two cities race to three.
        assert.equal(stage.racksToWin, !final ? 1 : game === 'snooker' ? 2 : city.level >= 4 ? 3 : 2);
        // Snooker finals are six-red frames until the full-frame London championship.
        assert.equal(stage.sixRed, final && game === 'snooker' && city !== london);
        assert.match(stage.objective, stage.sixRed ? /six-red/ : stage.racksToWin === 3 ? /three/ : /full/);
        assert.equal(stage.layout, undefined);
        assert.equal(stage.challenge, undefined);
      }
    }
  }
});

test('career stages vary the opening position and venue while keeping legal full racks', () => {
  for (const game of ['pool', 'snooker']) {
    const snooker = game === 'snooker';
    const venues = new Set();
    for (const city of cities) {
      const positions = new Set();
      for (const stage of careerStages.keys()) {
        const opening = careerOpening(city, stage, game, 0, () => .5);
        const [cue] = opening.balls;
        positions.add(cue.x + ',' + cue.z);
        const venue = careerTable(city.id, stage, snooker);
        venues.add(JSON.stringify([venue.colors, venue.accent]));
        assert.equal(venue.championship, stage === careerStages.length - 1);
        assert.equal(opening.balls.length, snooker ? 22 : 16);
        const sixRed = careerStage(city, stage, game).sixRed;
        assert.equal(opening.balls.filter(ball => ball.pocketed).length, sixRed ? 9 : 0);
        assert.ok(opening.balls.every((ball, index) => !ball.pocketed || index > 6 && index <= 15));
        if (snooker) {
          assert.ok(cue.z <= -.74 && Math.hypot(cue.x, cue.z + .74) < .22);
        } else {
          assert.ok(cue.z <= -length / 4);
          for (const i of [7, 8, 15]) {
            const expected = rack(false, () => .5)[i];
            assert.deepEqual(opening.balls[i], expected);
          }
        }
      }
      assert.equal(positions.size, careerStages.length);
    }
    assert.equal(venues.size, careerStages.length * cities.length);
  }
  const london = cities.at(-1);
  const final = careerStages.length - 1;
  assert.deepEqual([0, 1, 2].map(round => careerOpening(london, final, 'pool', round).opener), [0, 1, 0]);
  // Each final has its own break rule.
  assert.deepEqual([0, 1].map(round => careerOpening(cities[0], final, 'pool', round).opener), [0, 0]);
  assert.deepEqual([0, 1].map(round => careerOpening(cities[1], final, 'pool', round).opener), [1, 1]);
  assert.deepEqual([0, 1].map(round => careerOpening(cities[2], final, 'pool', round).opener), [1, 0]);
  assert.equal(new Set(cities.map(city => careerStage(city, final).title)).size, cities.length);
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
  assert.equal(challengeStars(poolEscape), 1);
  // The best rating is kept and stars unlock the next tier.
  completeChallenge(poolEscape, 3);
  completeChallenge(poolEscape, 2);
  assert.equal(challengeStars(poolEscape), 3);
  assert.equal(gameStars('pool'), 3);
  assert.equal(tierUnlocked('pool', 'Rookie'), true);
  assert.equal(tierUnlocked('pool', 'Pro'), false);
  completeChallenge(getChallenge('pool', 'cut'), 2);
  assert.equal(tierUnlocked('pool', 'Pro'), true);
  assert.equal(ratingFor(poolEscape, 1), 3);
  assert.equal(ratingFor(poolEscape, 3), 1);
  const timed = getChallenge('pool', 'beat-the-clock');
  assert.deepEqual([30, 10, 2].map(left => ratingFor(timed, 1, left)), [3, 2, 1]);
  assert.equal(challengeCompleted(snookerEscape), false);
});

test('challenge balls do not overlap and the starter cue can complete the bank shot', () => {
  const objectives = game => challenges.filter(challenge => challenge.game === game)
    .map(({ kind, attempts }) => [kind, attempts]);
  assert.deepEqual(objectives('pool'), objectives('snooker'));
  for (const challenge of challenges) {
    const active = challengeLayout(challenge).filter(ball => !ball.pocketed);
    for (const [i, ball] of active.entries()) {
      assert.ok(active.slice(i + 1).every(other => Math.hypot(ball.x - other.x, ball.z - other.z) >= radius * 2));
    }
  }
  const balls = challengeLayout(getChallenge('pool', 'bank'));
  const angle = 72 * Math.PI / 180;
  let banked = false;
  let first;
  strikeBall(balls[0], Math.cos(angle), Math.sin(angle), shotSpeed(.5));
  for (let tick = 0; tick < 240 && balls.some(isMoving); tick++) {
    const contact = step(balls, 1 / 30, undefined, ball => { if (ball === balls[1]) banked = true; });
    first ??= contact;
  }
  assert.equal(first, 1);
  assert.equal(banked, true);
  assert.equal(balls[1].pocketed, true);
  assert.equal(balls[0].pocketed, false);
});

test('both kick pots are reachable with a cue-ball cushion contact before the red or solid', () => {
  for (const [game, angle] of [['pool', 76.375 * Math.PI / 180], ['snooker', 103.75 * Math.PI / 180]]) {
    const balls = challengeLayout(getChallenge(game, 'kick-pot'));
    let first;
    let kick = false;
    strikeBall(balls[0], Math.cos(angle), Math.sin(angle), shotSpeed(1));
    for (let tick = 0; tick < 3000 && balls.some(isMoving); tick++) {
      const contact = step(balls, 1 / 300, undefined, (ball, cueContactMade) => {
        if (ball === balls[0] && first === undefined && !cueContactMade) kick = true;
      });
      first ??= contact;
    }
    assert.equal(first, 1, game);
    assert.equal(kick, true, game);
    assert.equal(balls[1].pocketed, true, game);
    assert.equal(balls[0].pocketed, false, game);
    assert.equal(balls[game === 'pool' ? 9 : 16].pocketed, false, game);
  }
});

test('no career opening starts with the cue ball on another ball', () => {
  for (const game of ['pool', 'snooker']) {
    for (const city of cities) for (const stage of careerStages.keys()) for (const round of [0, 1, 2]) {
      const { balls } = careerOpening(city, stage, game, round, () => .5);
      const [cue, ...others] = balls;
      for (const ball of others) {
        if (ball.pocketed) continue;
        assert.ok(Math.hypot(ball.x - cue.x, ball.z - cue.z) >= 2 * radius + 0.01, [game, city.id, stage, round].join(' '));
      }
      if (game === 'snooker') assert.ok(cue.z <= -.74 && Math.hypot(cue.x, cue.z + .74) < .22);
    }
  }
});
