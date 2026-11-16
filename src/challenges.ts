import type { Game } from './circuit';
import { rack } from './physics';

type Challenge = {
  id: string;
  game: Game;
  title: string;
  objective: string;
  kind: 'pot' | 'bank' | 'kick' | 'combo' | 'contact' | 'clear';
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
  { id: 'long-cut', game: 'pool', title: 'Long Corner Cut', objective: 'Pot ball 1 in one shot.', kind: 'pot', attempts: 1,
    layout: [[0, .38, -.97], [1, .14, .58]] },
  { id: 'kick-pot', game: 'pool', title: 'Kick Pot', objective: 'Bounce the cue ball off a cushion before hitting and potting ball 1. You have two attempts.', kind: 'kick', attempts: 2,
    layout: [[0, -.32, -.55], [1, .43, .19], [9, .065, -.18]] },
  { id: 'combination', game: 'pool', title: 'Combination Pot', objective: 'Hit ball 2 first and pot only ball 1 on the same shot. You have two attempts.', kind: 'combo', attempts: 2,
    layout: [[0, -.29, -.57], [2, .14, .09], [1, .34, .054]] },
  { id: 'four-ball-clear', game: 'pool', title: 'Four-Ball Clearance', objective: 'Pot all four solids in one visit.', kind: 'clear', attempts: 1,
    layout: [[0, .17, -.24], [1, -.47, -.91], [2, .42, -.10], [3, -.40, .13], [4, .47, .92]] },
  { id: 'red', game: 'snooker', title: 'Red Ball Cut', objective: 'Pot the red within two attempts.', kind: 'pot', attempts: 2,
    layout: [[0, -.19, -.27], [1, .35, .14]] },
  { id: 'bank', game: 'snooker', title: 'Bank Shot', objective: 'Pot the red after it hits a cushion, within three attempts.', kind: 'bank', attempts: 3,
    layout: [[0, -.13, -.30], [1, -.22, -.03]] },
  { id: 'escape', game: 'snooker', title: 'Safety Escape', objective: 'Hit the red first without scratching, within two attempts.', kind: 'contact', attempts: 2,
    layout: [[0, -.29, -.58], [1, -.29, .33], [16, -.29, -.11], [17, -.13, -.11]] },
  { id: 'position', game: 'snooker', title: 'Position Play', objective: 'Pot both reds in the same visit.', kind: 'clear', attempts: 1,
    layout: [[0, -.10, -.32], [1, -.43, -.12], [2, .38, .22]] },
  { id: 'long-bank', game: 'snooker', title: 'Copenhagen Long Bank', objective: 'Bank the red into any pocket within two attempts.', kind: 'bank', attempts: 2,
    layout: [[0, -.17, -.615], [1, -.20, -.19]] },
  { id: 'berlin-escape', game: 'snooker', title: 'Berlin Safety', objective: 'Escape the snooker in one attempt. Hit the red first without scratching.', kind: 'contact', attempts: 1,
    layout: [[0, -.27, -.738], [1, -.11, .39], [16, -.25, -.15], [17, -.12, -.15], [18, .01, -.15]] },
  { id: 'stockholm-run', game: 'snooker', title: 'Stockholm Run', objective: 'Clear all three reds in one visit.', kind: 'clear', attempts: 1,
    layout: [[0, .165, -.281], [1, .43, -.12], [2, -.38, .22], [3, -.38, .92]] },
  { id: 'long-cut', game: 'snooker', title: 'Long Corner Cut', objective: 'Pot the red in one shot.', kind: 'pot', attempts: 1,
    layout: [[0, -.38, -.97], [1, -.14, .58]] },
  { id: 'kick-pot', game: 'snooker', title: 'Kick Pot', objective: 'Bounce the cue ball off a cushion before hitting and potting the red. You have two attempts.', kind: 'kick', attempts: 2,
    layout: [[0, .32, -.55], [1, -.43, .19], [16, -.065, -.18]] },
  { id: 'combination', game: 'snooker', title: 'Combination Pot', objective: 'Hit the red farther from the side pocket first and pot only the nearer red. You have two attempts.', kind: 'combo', attempts: 2,
    layout: [[0, .29, -.57], [2, -.14, .09], [1, -.34, .054]] },
  { id: 'four-ball-clear', game: 'snooker', title: 'Four-Ball Clearance', objective: 'Pot all four reds in one visit.', kind: 'clear', attempts: 1,
    layout: [[0, -.17, -.24], [1, .47, -.91], [2, -.42, -.10], [3, .40, .13], [4, -.47, .92]] },
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
