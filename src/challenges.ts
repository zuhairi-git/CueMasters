import type { Game } from './circuit';
import { rack } from './physics';

export const challengeTiers = ['Rookie', 'Pro', 'Master'] as const;
export type ChallengeTier = typeof challengeTiers[number];
// Stars needed across a game's challenges before a tier opens.
export const tierStars: Record<ChallengeTier, number> = { Rookie: 0, Pro: 5, Master: 14 };
export const maxStars = 3;
export const starReward = 20;

type Challenge = {
  id: string;
  game: Game;
  tier: ChallengeTier;
  title: string;
  objective: string;
  kind: 'pot' | 'bank' | 'kick' | 'combo' | 'contact' | 'clear';
  attempts: number;
  /** Seconds on the clock. Timed challenges allow misses; the clock decides the stars. */
  timeLimit?: number;
  layout: [number, number, number][];
};

const speedLayout: [number, number, number][] = [[0, 0, -.5], [1, .35, -.75], [2, -.40, .05], [3, .42, .55], [4, -.30, 1.0]];
const lightningLayout: [number, number, number][] = [[0, 0, -.30], [1, .45, -1.05], [2, -.45, -1.0], [3, .50, -.05], [4, -.48, .10], [5, .40, 1.05], [6, -.42, 1.08]];
const mirror = (layout: [number, number, number][]) => layout.map(([index, x, z]) => [index, -x, z] as [number, number, number]);

export const challenges: Challenge[] = [
  { id: 'cut', game: 'pool', tier: 'Rookie', title: 'The Cut Shot', objective: 'Pot ball 1.', kind: 'pot', attempts: 3,
    layout: [[0, -.05, .80], [1, .45, .95]] },
  { id: 'bank', game: 'pool', tier: 'Rookie', title: 'Bank Shot', objective: 'Pot ball 1 after it hits a cushion.', kind: 'bank', attempts: 5,
    layout: [[0, .13, -.30], [1, .22, -.03]] },
  { id: 'escape', game: 'pool', tier: 'Rookie', title: 'Safety Escape', objective: 'Hit ball 1 first without scratching.', kind: 'contact', attempts: 3,
    layout: [[0, -.29, -.58], [1, -.29, .33], [9, -.29, -.11], [10, -.13, -.11]] },
  { id: 'position', game: 'pool', tier: 'Rookie', title: 'Position Play', objective: 'Pot both solids in the same visit.', kind: 'clear', attempts: 3,
    layout: [[0, .10, -.32], [1, .43, -.12], [2, -.38, .22]] },
  { id: 'long-bank', game: 'pool', tier: 'Pro', title: 'Copenhagen Long Bank', objective: 'Bank ball 1 into any pocket.', kind: 'bank', attempts: 5,
    layout: [[0, .17, -.615], [1, .20, -.19]] },
  { id: 'kick-pot', game: 'pool', tier: 'Pro', title: 'Kick Pot', objective: 'Bounce the cue ball off a cushion before hitting and potting ball 1.', kind: 'kick', attempts: 5,
    layout: [[0, -.32, -.55], [1, .43, .19], [9, .065, -.18]] },
  { id: 'combination', game: 'pool', tier: 'Pro', title: 'Combination Pot', objective: 'Hit ball 2 first and pot only ball 1 on the same shot.', kind: 'combo', attempts: 3,
    layout: [[0, -.29, -.57], [2, .14, .09], [1, .34, .054]] },
  { id: 'stockholm-run', game: 'pool', tier: 'Pro', title: 'Stockholm Run', objective: 'Clear all your solids in one visit.', kind: 'clear', attempts: 3,
    layout: [[0, -.165, -.281], [1, -.43, -.12], [2, .38, .22], [3, .38, .92]] },
  { id: 'beat-the-clock', game: 'pool', tier: 'Pro', title: 'Beat the Clock', objective: 'Pot all four solids before time runs out. A scratch costs five seconds.', kind: 'clear', attempts: 1, timeLimit: 45,
    layout: speedLayout },
  { id: 'long-cut', game: 'pool', tier: 'Master', title: 'Long Corner Cut', objective: 'Pot ball 1 from distance.', kind: 'pot', attempts: 3,
    layout: [[0, .38, -.97], [1, .14, .58]] },
  { id: 'berlin-escape', game: 'pool', tier: 'Master', title: 'Berlin Safety', objective: 'Escape the snooker. Hit ball 1 first without scratching.', kind: 'contact', attempts: 3,
    layout: [[0, .27, -.738], [1, .11, .39], [9, .25, -.15], [10, .12, -.15], [11, -.01, -.15]] },
  { id: 'four-ball-clear', game: 'pool', tier: 'Master', title: 'Four-Ball Clearance', objective: 'Pot all four solids in one visit.', kind: 'clear', attempts: 3,
    layout: [[0, .17, -.24], [1, -.47, -.91], [2, .42, -.10], [3, -.40, .13], [4, .47, .92]] },
  { id: 'lightning-round', game: 'pool', tier: 'Master', title: 'Lightning Round', objective: 'Clear six solids against the clock. A scratch costs five seconds.', kind: 'clear', attempts: 1, timeLimit: 75,
    layout: lightningLayout },
  { id: 'red', game: 'snooker', tier: 'Rookie', title: 'Red Ball Cut', objective: 'Pot the red.', kind: 'pot', attempts: 3,
    layout: [[0, .05, .80], [1, -.45, .95]] },
  { id: 'bank', game: 'snooker', tier: 'Rookie', title: 'Bank Shot', objective: 'Pot the red after it hits a cushion.', kind: 'bank', attempts: 5,
    layout: [[0, -.13, -.30], [1, -.22, -.03]] },
  { id: 'escape', game: 'snooker', tier: 'Rookie', title: 'Safety Escape', objective: 'Hit the red first without scratching.', kind: 'contact', attempts: 3,
    layout: [[0, -.29, -.58], [1, -.29, .33], [16, -.29, -.11], [17, -.13, -.11]] },
  { id: 'position', game: 'snooker', tier: 'Rookie', title: 'Position Play', objective: 'Pot both reds in the same visit.', kind: 'clear', attempts: 3,
    layout: [[0, -.10, -.32], [1, -.43, -.12], [2, .38, .22]] },
  { id: 'long-bank', game: 'snooker', tier: 'Pro', title: 'Copenhagen Long Bank', objective: 'Bank the red into any pocket.', kind: 'bank', attempts: 5,
    layout: [[0, -.17, -.615], [1, -.20, -.19]] },
  { id: 'kick-pot', game: 'snooker', tier: 'Pro', title: 'Kick Pot', objective: 'Bounce the cue ball off a cushion before hitting and potting the red.', kind: 'kick', attempts: 5,
    layout: [[0, .32, -.55], [1, -.43, .19], [16, -.065, -.18]] },
  { id: 'combination', game: 'snooker', tier: 'Pro', title: 'Combination Pot', objective: 'Hit the red farther from the side pocket first and pot only the nearer red.', kind: 'combo', attempts: 3,
    layout: [[0, .29, -.57], [2, -.14, .09], [1, -.34, .054]] },
  { id: 'stockholm-run', game: 'snooker', tier: 'Pro', title: 'Stockholm Run', objective: 'Clear all three reds in one visit.', kind: 'clear', attempts: 3,
    layout: [[0, .165, -.281], [1, .43, -.12], [2, -.38, .22], [3, -.38, .92]] },
  { id: 'beat-the-clock', game: 'snooker', tier: 'Pro', title: 'Beat the Clock', objective: 'Pot all four reds before time runs out. A scratch costs five seconds.', kind: 'clear', attempts: 1, timeLimit: 45,
    layout: mirror(speedLayout) },
  { id: 'long-cut', game: 'snooker', tier: 'Master', title: 'Long Corner Cut', objective: 'Pot the red from distance.', kind: 'pot', attempts: 3,
    layout: [[0, -.38, -.97], [1, -.14, .58]] },
  { id: 'berlin-escape', game: 'snooker', tier: 'Master', title: 'Berlin Safety', objective: 'Escape the snooker. Hit the red first without scratching.', kind: 'contact', attempts: 3,
    layout: [[0, -.27, -.738], [1, -.11, .39], [16, -.25, -.15], [17, -.12, -.15], [18, .01, -.15]] },
  { id: 'four-ball-clear', game: 'snooker', tier: 'Master', title: 'Four-Ball Clearance', objective: 'Pot all four reds in one visit.', kind: 'clear', attempts: 3,
    layout: [[0, -.17, -.24], [1, .47, -.91], [2, -.42, -.10], [3, .40, .13], [4, -.47, .92]] },
  { id: 'lightning-round', game: 'snooker', tier: 'Master', title: 'Lightning Round', objective: 'Clear six reds against the clock. A scratch costs five seconds.', kind: 'clear', attempts: 1, timeLimit: 75,
    layout: mirror(lightningLayout) },
];

export function getChallenge(game: Game, id: string) {
  return challenges.find(challenge => challenge.game === game && challenge.id === id);
}

export function challengeLayout(challenge: Challenge) {
  const balls = rack(challenge.game === 'snooker');
  for (const ball of balls) ball.pocketed = true;
  for (const [index, x, z] of challenge.layout) Object.assign(balls[index], { x, z, pocketed: false });
  return balls;
}

const completionKey = (challenge: Challenge) => 'cue-master-challenge-' + challenge.game + '-' + challenge.id;

/** Best star rating earned so far: 0 when the challenge has not been cleared. */
export function challengeStars(challenge: Challenge) {
  try {
    const stars = Number(localStorage.getItem(completionKey(challenge)));
    return Number.isInteger(stars) && stars > 0 ? Math.min(maxStars, stars) : 0;
  } catch { return 0; }
}

export function challengeCompleted(challenge: Challenge) {
  return challengeStars(challenge) > 0;
}

/** Stars for a clear: attempts used, or the share of the clock left on a timed challenge. */
export function ratingFor(challenge: Challenge, attemptsUsed: number, timeLeft = 0) {
  if (challenge.timeLimit) return timeLeft >= challenge.timeLimit * .4 ? 3 : timeLeft >= challenge.timeLimit * .15 ? 2 : 1;
  return Math.max(1, maxStars + 1 - attemptsUsed);
}

/** Keeps the best rating. Returns false only when the browser could not save it. */
export function completeChallenge(challenge: Challenge, stars = 1) {
  const best = Math.max(challengeStars(challenge), Math.min(maxStars, Math.max(1, Math.round(stars))));
  try { localStorage.setItem(completionKey(challenge), String(best)); return true; }
  catch { return false; }
}

export function gameStars(game: Game) {
  return challenges.filter(challenge => challenge.game === game).reduce((sum, challenge) => sum + challengeStars(challenge), 0);
}

export function tierUnlocked(game: Game, tier: ChallengeTier) {
  return gameStars(game) >= tierStars[tier];
}
