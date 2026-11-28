export type Group = 'Solids' | 'Stripes';
export type Groups = [Group | null, Group | null];
export const groupOf = (index: number): Group | null => index > 0 && index < 8 ? 'Solids' : index > 8 && index < 16 ? 'Stripes' : null;

export function poolTargets(pocketed: boolean[], group: Group | null) {
  const active = pocketed.flatMap((gone, i) => !gone && groupOf(i) && (!group || groupOf(i) === group) ? [i] : []);
  return active.length || !group ? active : pocketed[8] ? [] : [8];
}

export function resolvePoolShot(input: {
  turn: number; groups: Groups; targets: number[]; firstContact?: number;
  potted: number[]; scratch: boolean; breaking: boolean;
  calledPocket?: number; eightPocket?: number;
}) {
  const { turn, targets, potted, scratch, breaking } = input;
  const groups: Groups = [...input.groups];
  const foul = scratch || input.firstContact === undefined || !targets.includes(input.firstContact);
  // Friendly eight-ball: a break leaves the table open; a break eight is respotted.
  if (!breaking && !foul && !groups[turn]) {
    const group = potted.map(groupOf).find(value => value !== null);
    if (group) {
      groups[turn] = group;
      groups[1 - turn] = group === 'Solids' ? 'Stripes' : 'Solids';
    }
  }
  const calledCorrectly = Number.isInteger(input.calledPocket) && input.calledPocket === input.eightPocket;
  const winner = !breaking && potted.includes(8) ? !foul && targets.includes(8) && calledCorrectly ? turn : 1 - turn : undefined;
  const keptTurn = !foul && potted.some(index => groupOf(index) && (!groups[turn] || groupOf(index) === groups[turn]));
  return { groups, foul, winner, turn: keptTurn ? turn : 1 - turn, respotEight: breaking && potted.includes(8) };
}

/** Nine-ball: the lowest-numbered ball on the table must be struck first. */
export function nineBallOn(pocketed: boolean[]) {
  for (let index = 1; index <= 9; index++) if (!pocketed[index]) return index;
}

export function nineBallTargets(pocketed: boolean[]) {
  const on = nineBallOn(pocketed);
  return on === undefined ? [] : [on];
}

/**
 * Nine-ball needs no called shots: any ball that drops after a legal hit keeps
 * the turn, and the nine wins the rack whenever it falls legally, the break and
 * combinations included. A nine pocketed on a foul returns to the foot spot.
 */
export function resolveNineBallShot(input: {
  turn: number; targets: number[]; firstContact?: number; potted: number[]; scratch: boolean;
}) {
  const { turn, targets, potted, scratch } = input;
  const foul = scratch || input.firstContact === undefined || !targets.includes(input.firstContact);
  const nine = potted.includes(9);
  return {
    foul,
    winner: nine && !foul ? turn : undefined,
    turn: !foul && potted.length ? turn : 1 - turn,
    respotNine: nine && foul,
  };
}

export function snookerRemainingPoints(pocketed: boolean[], colourAfterRed: boolean): number {
  let reds = 0;
  for (let i = 1; i <= 15; i++) {
    if (!pocketed[i]) reds++;
  }
  if (reds > 0) {
    return (colourAfterRed ? 7 : 0) + reds * 8 + 27;
  }
  let remainingColours = 0;
  for (let i = 16; i <= 21; i++) {
    if (!pocketed[i]) remainingColours += i - 14;
  }
  return (colourAfterRed ? 7 : 0) + remainingColours;
}
