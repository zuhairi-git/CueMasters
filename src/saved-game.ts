import type { Ball } from './physics';
import type { Groups } from './pool-rules';

export interface SavedGame {
  version: 1; balls: Ball[]; snooker: boolean; versusComputer: boolean; onlineMode: boolean;
  turn: number; scores: number[]; groups: Groups; winner?: number; breaking: boolean;
  shotWasBreak: boolean; colourAfterRed: boolean; finished: boolean; firstContact?: number;
  shotTargets: number[]; previouslyPocketed: boolean[]; rolling: boolean;
  placement?: 'break' | 'foul'; aim: [number, number]; strike: number; shotPower: number;
  tip: [number, number]; aimLocked: boolean;
  calledPocket?: number;
  careerAttempts?: number;
  careerBanked?: boolean;
}
export function validGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const s = value as SavedGame;
  const finite = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
  const validOrientation = (v: unknown) => v === undefined || Array.isArray(v) && v.length === 4
    && v.every(component => finite(component, 1)) && Math.abs(Math.hypot(...v) - 1) < 1e-6;
  const index = (v: unknown) => Number.isInteger(v) && Number(v) >= 0 && Number(v) < (s.snooker ? 22 : 16);
  return s.version === 1 && ['snooker', 'versusComputer', 'onlineMode', 'breaking', 'shotWasBreak', 'colourAfterRed', 'finished', 'rolling', 'aimLocked'].every(k => typeof (s as unknown as Record<string, unknown>)[k] === 'boolean')
    && (s.careerAttempts === undefined || Number.isInteger(s.careerAttempts) && s.careerAttempts >= 0 && s.careerAttempts <= 3)
    && (s.careerBanked === undefined || typeof s.careerBanked === 'boolean')
    && (s.calledPocket === undefined || Number.isInteger(s.calledPocket) && s.calledPocket >= 0 && s.calledPocket < 6)
    && (s.turn === 0 || s.turn === 1) && (s.winner === undefined || s.winner === 0 || s.winner === 1)
    && Array.isArray(s.balls) && s.balls.length === (s.snooker ? 22 : 16) && s.balls.every(b => b && typeof b.pocketed === 'boolean' && finite(b.x, 0.8) && finite(b.z, 1.5) && [b.vx, b.vz, b.spinX, b.spinZ].every(v => finite(v, 12)) && finite(b.sideSpin, 200) && validOrientation(b.orientation))
    && Array.isArray(s.scores) && s.scores.length === 2 && s.scores.every(v => finite(v, 100000) && v >= 0)
    && Array.isArray(s.groups) && s.groups.length === 2 && s.groups.every(g => g === null || g === 'Solids' || g === 'Stripes')
    && (s.firstContact === undefined || index(s.firstContact))
    && Array.isArray(s.shotTargets) && s.shotTargets.length <= 22 && s.shotTargets.every(index)
    && Array.isArray(s.previouslyPocketed) && (s.previouslyPocketed.length === 0 || s.previouslyPocketed.length === s.balls.length) && s.previouslyPocketed.every(v => typeof v === 'boolean')
    && (s.placement === undefined || s.placement === 'break' || s.placement === 'foul')
    && Array.isArray(s.aim) && s.aim.length === 2 && s.aim.every(v => finite(v, 1)) && Math.hypot(...s.aim) > 0.9
    && Array.isArray(s.tip) && s.tip.length === 2 && s.tip.every(v => finite(v, 0.78))
    && finite(s.strike, 0.2) && s.strike >= 0 && finite(s.shotPower, 1) && s.shotPower >= 0;
}
