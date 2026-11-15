import { isMoving, length, pockets, radius, rollingDeceleration, shotSpeed, step, strikeBall, width, type Ball } from './physics';
import type { Difficulty } from './difficulty';

type Shot = { angle: number; power: number; pocket?: number };
type Candidate = Shot & { cost: number; target: number };

const value = (i: number) => i <= 15 ? 1 : i - 14;

function clearPath(balls: Ball[], ax: number, az: number, bx: number, bz: number, ignoreA: number, ignoreB: number) {
  const dx = bx - ax, dz = bz - az;
  const squared = dx * dx + dz * dz;
  if (!squared) return false;
  return balls.every((ball, index) => {
    if (index === ignoreA || index === ignoreB || ball.pocketed) return true;
    const t = Math.max(0, Math.min(1, ((ball.x - ax) * dx + (ball.z - az) * dz) / squared));
    return Math.hypot(ball.x - ax - t * dx, ball.z - az - t * dz) > 2 * radius;
  });
}

function potCandidates(balls: Ball[], legal: number[]) {
  const cue = balls[0];
  const shots: Candidate[] = [];
  const snooker = balls.length === 22;
  const isColourAfterRed = snooker && legal.length > 1 && legal.some(i => i > 15);
  for (const index of legal) {
    const ball = balls[index];
    for (const [pocketIndex, pocket] of pockets.entries()) {
      const dx = pocket.x - ball.x, dz = pocket.z - ball.z;
      const distance = Math.hypot(dx, dz);
      if (!distance) continue;
      const x = ball.x - dx / distance * 2 * radius;
      const z = ball.z - dz / distance * 2 * radius;
      if (Math.abs(x) > width / 2 - radius || Math.abs(z) > length / 2 - radius) continue;
      const reach = Math.hypot(x - cue.x, z - cue.z);
      if (!reach) continue;
      const cut = ((x - cue.x) * dx + (z - cue.z) * dz) / (reach * distance);
      if (cut < 0.22) continue;
      const tTarget = ((ball.x - cue.x) * (x - cue.x) + (ball.z - cue.z) * (z - cue.z)) / (reach * reach);
      if (tTarget > 0 && tTarget < 1) {
        const px = cue.x + tTarget * (x - cue.x), pz = cue.z + tTarget * (z - cue.z);
        if (Math.hypot(ball.x - px, ball.z - pz) < 2 * radius - 0.003) continue;
      }
      if (!clearPath(balls, cue.x, cue.z, x, z, 0, index) || !clearPath(balls, ball.x, ball.z, pocket.x, pocket.z, index, -1)) continue;
      const basePower = Math.min(0.95, (Math.sqrt(2 * rollingDeceleration * (reach + distance / (cut * cut)) + 0.8) / (4.3 * 0.72)) ** (1 / 1.35));
      const valueBonus = isColourAfterRed ? (value(index) - 1) * 0.4 : 0;
      shots.push({
        angle: Math.atan2(x - cue.x, z - cue.z),
        power: basePower,
        cost: reach + distance + 1.5 * (1 - cut) - valueBonus,
        pocket: pocketIndex,
        target: index,
      });
    }
  }
  return shots.sort((a, b) => a.cost - b.cost);
}

function evaluateShot(balls: Ball[], legal: number[], shot: Candidate, lookAhead: boolean, snooker: boolean) {
  const simulated = balls.map(ball => ({ ...ball }));
  const cue = simulated[0];
  strikeBall(cue, Math.sin(shot.angle), Math.cos(shot.angle), shotSpeed(shot.power));
  let contact: number | undefined;
  for (let tick = 0; tick < 260 && simulated.some(isMoving); tick++) {
    const hit = step(simulated, 1 / 100);
    contact ??= hit;
    if (simulated[0].pocketed) break;
  }
  if (cue.pocketed || contact === undefined || !legal.includes(contact)) {
    return { valid: false, score: -1000 - shot.cost };
  }
  if (!snooker && balls.length === 16 && !balls[8].pocketed && simulated[8].pocketed) {
    const isLegalEight = legal.length === 1 && legal[0] === 8;
    const pocket = shot.pocket === undefined ? undefined : pockets[shot.pocket];
    const inCalled = pocket && Math.hypot(simulated[8].x - pocket.x, simulated[8].z - pocket.z) < 0.15;
    return { valid: isLegalEight && inCalled, score: isLegalEight && inCalled ? 1000 : -1000 };
  }
  const illegalPotted = simulated.some((ball, i) => i > 0 && ball.pocketed && !balls[i].pocketed && !legal.includes(i));
  if (illegalPotted) return { valid: false, score: -500 };
  const potted = legal.filter(index => !balls[index].pocketed && simulated[index].pocketed);
  if (!potted.length) return { valid: true, score: -shot.cost };
  let score = snooker ? potted.reduce((s, i) => s + value(i) * 20, 0) : potted.length * 60;
  score -= shot.cost;
  if (lookAhead) {
    const remaining = legal.filter(index => !simulated[index].pocketed);
    const nextTargets = snooker
      ? (potted.some(i => i <= 15) ? [16, 17, 18, 19, 20, 21].filter(i => !simulated[i].pocketed) : remaining)
      : (remaining.length ? remaining : (!simulated[8].pocketed ? [8] : []));
    if (nextTargets.length) {
      const nextCandidates = potCandidates(simulated, nextTargets);
      if (nextCandidates.length) {
        score += 25 / (1 + nextCandidates[0].cost);
      }
    }
  }
  return { valid: true, score, potted: potted.length };
}

export function chooseShot(balls: Ball[], legal: number[], difficulty: Difficulty, random = Math.random): Shot | undefined {
  if (!legal.length) return;
  const cue = balls[0];
  const nearest = [...legal].sort((a, b) =>
    Math.hypot(balls[a].x - cue.x, balls[a].z - cue.z) - Math.hypot(balls[b].x - cue.x, balls[b].z - cue.z)
  );
  const target = nearest.find(index => clearPath(balls, cue.x, cue.z, balls[index].x, balls[index].z, 0, index)) ?? nearest[0];
  const direct = { angle: Math.atan2(balls[target].x - cue.x, balls[target].z - cue.z), power: 0.45, cost: 3, pocket: undefined, target };

  if (difficulty === 'Beginner') {
    const candidates = potCandidates(balls, nearest.slice(0, 2));
    const shot = candidates[0] ?? direct;
    const aimError = legal.length === 1 && shot.pocket !== undefined ? 0.038 * 0.65 : 0.038;
    return { angle: shot.angle + (random() * 2 - 1) * aimError, power: shot.power, pocket: shot.pocket };
  }

  if (difficulty === 'Easy') {
    const candidates = potCandidates(balls, nearest.slice(0, 3));
    let shot: Candidate = candidates[0] ?? direct;
    if (candidates.length) {
      let best = -Infinity;
      for (const c of candidates.slice(0, 2)) {
        const res = evaluateShot(balls, legal, c, false, balls.length === 22);
        if (res.score > best) { best = res.score; shot = c; }
      }
    }
    const aimError = legal.length === 1 && shot.pocket !== undefined ? 0.026 * 0.65 : 0.026;
    return { angle: shot.angle + (random() * 2 - 1) * aimError, power: shot.power, pocket: shot.pocket };
  }

  const snooker = balls.length === 22;
  const candidates = potCandidates(balls, legal);
  let shot: Candidate = direct;
  let bestScore = -Infinity;
  const maxCandidates = difficulty === 'Medium' ? 6 : difficulty === 'Hard' ? 10 : 16;
  const powerMults = difficulty === 'Medium' ? [1.0] : difficulty === 'Hard' ? [1.0, 1.15] : [0.95, 1.05, 1.18];
  const lookAhead = difficulty === 'Hard' || difficulty === 'Expert';

  for (const c of candidates.slice(0, maxCandidates)) {
    for (const mult of powerMults) {
      const option: Candidate = { ...c, power: Math.min(0.95, c.power * mult) };
      const res = evaluateShot(balls, legal, option, lookAhead, snooker);
      if (res.score > bestScore) {
        bestScore = res.score;
        shot = option;
      }
      if (difficulty === 'Medium' && res.score > 30) break;
    }
    if (difficulty === 'Medium' && bestScore > 30) break;
    if (difficulty === 'Hard' && bestScore > 70) break;
    if (difficulty === 'Expert' && bestScore > 85) break;
  }

  // Safety shot fallback if no pot found for Hard or Expert
  if (bestScore < 0 && (difficulty === 'Hard' || difficulty === 'Expert')) {
    const safeTarget = balls[target];
    const baseAngle = Math.atan2(safeTarget.x - cue.x, safeTarget.z - cue.z);
    for (const offset of [-0.035, 0.035]) {
      const safetyShot: Candidate = { angle: baseAngle + offset, power: 0.24, cost: 2, pocket: undefined, target };
      const res = evaluateShot(balls, legal, safetyShot, false, snooker);
      if (res.valid && res.score > bestScore) {
        bestScore = res.score;
        shot = safetyShot;
      }
    }
  }

  const error = difficulty === 'Medium' ? 0.007 : difficulty === 'Hard' ? 0.0018 : 0.000;
  const aimError = legal.length === 1 && shot.pocket !== undefined ? error * 0.65 : error;
  return { angle: shot.angle + (random() * 2 - 1) * aimError, power: shot.power, pocket: shot.pocket };
}
