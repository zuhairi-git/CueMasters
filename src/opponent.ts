import { isMoving, length, pockets, radius, rollingDeceleration, shotSpeed, step, strikeBall, width, type Ball } from './physics';
import type { Difficulty } from './difficulty';

const settings = {
  Beginner: { error: 0.038, trials: 2 },
  Easy: { error: 0.065, trials: 0 },
  Medium: { error: 0.024, trials: 0 },
  Hard: { error: 0.006, trials: 3 },
  Expert: { error: 0, trials: 8 },
};

type Shot = { angle: number; power: number; pocket?: number };
type Candidate = Shot & { cost: number };

function clearPath(balls: Ball[], ax: number, az: number, bx: number, bz: number, target: number) {
  const dx = bx - ax, dz = bz - az;
  const squared = dx * dx + dz * dz;
  if (!squared) return false;
  return balls.every((ball, index) => {
    if (!index || index === target || ball.pocketed) return true;
    const t = Math.max(0, Math.min(1, ((ball.x - ax) * dx + (ball.z - az) * dz) / squared));
    return Math.hypot(ball.x - ax - t * dx, ball.z - az - t * dz) > 2 * radius;
  });
}

function potCandidates(balls: Ball[], legal: number[]) {
  const cue = balls[0];
  const shots: Candidate[] = [];
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
      if (cut < 0.34 || !clearPath(balls, cue.x, cue.z, x, z, index) || !clearPath(balls, ball.x, ball.z, pocket.x, pocket.z, index)) continue;
      shots.push({
        angle: Math.atan2(x - cue.x, z - cue.z),
        power: Math.min(0.95, (Math.sqrt(2 * rollingDeceleration * (reach + distance / (cut * cut)) + 0.45) / (4.3 * 0.72)) ** (1 / 1.35)),
        cost: reach + distance + 1.5 * (1 - cut),
        pocket: pocketIndex,
      });
    }
  }
  return shots.sort((a, b) => a.cost - b.cost);
}

function evaluateShot(balls: Ball[], legal: number[], shot: Candidate, lookAhead: boolean) {
  const simulated = balls.map(ball => ({ ...ball }));
  const cue = simulated[0];
  strikeBall(cue, Math.sin(shot.angle), Math.cos(shot.angle), shotSpeed(shot.power));
  let contact: number | undefined;
  for (let tick = 0; tick < 900 && simulated.some(isMoving); tick++) {
    const hit = step(simulated, 1 / 150);
    contact ??= hit;
  }
  if (cue.pocketed || contact === undefined || !legal.includes(contact)) return -30 - shot.cost;
  if (balls.length === 16 && !balls[8].pocketed && simulated[8].pocketed) {
    const pocket = shot.pocket === undefined ? undefined : pockets[shot.pocket];
    return legal.length === 1 && legal[0] === 8 && pocket && Math.hypot(simulated[8].x - pocket.x, simulated[8].z - pocket.z) < 0.15 ? 100 : -100;
  }
  const remaining = legal.filter(index => !simulated[index].pocketed);
  const pots = legal.length - remaining.length;
  const next = lookAhead && pots ? potCandidates(simulated, remaining)[0] : undefined;
  return pots * 10 - shot.cost + (next ? 3 / (1 + next.cost) : 0);
}

export function chooseShot(balls: Ball[], legal: number[], difficulty: Difficulty, random = Math.random): Shot | undefined {
  if (!legal.length) return;
  const cue = balls[0];
  const nearest = [...legal].sort((a, b) =>
    Math.hypot(balls[a].x - cue.x, balls[a].z - cue.z) - Math.hypot(balls[b].x - cue.x, balls[b].z - cue.z)
  );
  const target = nearest.find(index => clearPath(balls, cue.x, cue.z, balls[index].x, balls[index].z, index)) ?? nearest[0];
  const direct = { angle: Math.atan2(balls[target].x - cue.x, balls[target].z - cue.z), power: 0.55, cost: 3 };
  const { error, trials } = settings[difficulty];
  const candidates = potCandidates(balls, difficulty === 'Beginner' ? nearest.slice(0, 2)
    : difficulty === 'Easy' ? nearest.slice(0, 3) : legal);
  let shot: Candidate = candidates[0] ?? direct;
  if (trials && candidates.length) {
    const options = candidates.slice(0, difficulty === 'Expert' ? 4 : trials - 1);
    if (difficulty === 'Expert') {
      for (const candidate of options.slice(0, 3)) options.push({ ...candidate, power: Math.max(0.2, candidate.power * 0.86) });
    }
    options.push(direct);
    let best = -Infinity;
    for (const option of options) {
      const score = evaluateShot(balls, legal, option, difficulty === 'Expert');
      if (score > best) { best = score; shot = option; }
    }
  }
  const aimError = legal.length === 1 && shot.pocket !== undefined ? error * 0.65 : error;
  return { angle: shot.angle + (random() * 2 - 1) * aimError, power: shot.power, pocket: shot.pocket };
}
