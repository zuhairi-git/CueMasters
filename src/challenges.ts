import type { Game } from './circuit';
import { rack } from './physics';

type Challenge = {
  id: string;
  game: Game;
  title: string;
  objective: string;
  kind: 'pot' | 'bank' | 'contact' | 'clear';
  attempts: number;
  layout: [number, number, number][];
};

export const challenges: Challenge[] = [
  { id: 'cut', game: 'pool', title: 'The Cut Shot', objective: 'Pot ball 1 within two attempts.', kind: 'pot', attempts: 2,
    layout: [[0, -.19, -.27], [1, .35, .14]] },
  { id: 'bank', game: 'pool', title: 'Bank Shot', objective: 'Pot ball 1 after it hits a cushion, within three attempts.', kind: 'bank', attempts: 3,
    layout: [[0, .13, -.30], [1, .22, -.03]] },
  { id: 'escape', game: 'pool', title: 'Safety Escape', objective: 'Hit ball 1 first without scratching, within two attempts.', kind: 'contact', attempts: 2,
    layout: [[0, -.29, -.58], [1, -.29, .33], [9, -.29, -.11], [10, -.13, -.11]] },
  { id: 'position', game: 'pool', title: 'Position Play', objective: 'Pot both solids in the same visit.', kind: 'clear', attempts: 1,
    layout: [[0, .10, -.32], [1, .43, -.12], [2, -.38, .22]] },
  { id: 'long-bank', game: 'pool', title: 'Copenhagen Long Bank', objective: 'Bank ball 1 into any pocket within two attempts.', kind: 'bank', attempts: 2,
    layout: [[0, .17, -.615], [1, .20, -.19]] },
  { id: 'berlin-escape', game: 'pool', title: 'Berlin Safety', objective: 'Escape the snooker in one attempt. Hit ball 1 first without scratching.', kind: 'contact', attempts: 1,
    layout: [[0, .27, -.738], [1, .11, .39], [9, .25, -.15], [10, .12, -.15], [11, -.01, -.15]] },
  { id: 'stockholm-run', game: 'pool', title: 'Stockholm Run', objective: 'Clear all your solids in one visit.', kind: 'clear', attempts: 1,
    layout: [[0, -.165, -.281], [1, -.43, -.12], [2, .38, .22], [3, .38, .92]] },
  { id: 'red', game: 'snooker', title: 'Red Ball Cut', objective: 'Pot the red within two attempts.', kind: 'pot', attempts: 2,
    layout: [[0, -.19, -.27], [1, .35, .14]] },
  { id: 'escape', game: 'snooker', title: 'Safety Escape', objective: 'Hit the red first without scratching, within two attempts.', kind: 'contact', attempts: 2,
    layout: [[0, -.29, -.58], [1, -.29, .33], [16, -.29, -.11], [17, -.13, -.11]] },
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

export function challengeCompleted(challenge: Challenge) {
  try { return localStorage.getItem(completionKey(challenge)) === '1'; }
  catch { return false; }
}

export function completeChallenge(challenge: Challenge) {
  try { localStorage.setItem(completionKey(challenge), '1'); return true; }
  catch { return false; }
}
