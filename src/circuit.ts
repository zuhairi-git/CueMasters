import cityData from './cities.json';
import { difficulties, type Difficulty } from './difficulty';

export const cities = cityData;
export type City = typeof cities[number];
export type Circuit = 'online' | 'computer';
export type Progress = Record<string, { wins: number; losses: number; lastMatch?: string; lastMessage?: string }>;
export type Mode =
  | { kind: 'casual' }
  | { kind: 'training'; opponent: 'solo' | 'computer'; difficulty: Difficulty }
  | { kind: 'online'; city: City }
  | { kind: 'computer'; city: City; matchId: string };

const computerKey = 'billiard-computer-circuit-v1';

export function computerProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(computerKey) ?? '{}') ?? {}; }
  catch { return {}; }
}

export function cityStatus(city: City, progress: Progress) {
  if (city.requires && !progress[city.requires]?.wins) return 'Locked';
  return progress[city.id]?.wins ? 'Completed' : 'Unlocked';
}

export function finishComputerCity(city: City, matchId: string, won: boolean) {
  const progress = computerProgress();
  if (cityStatus(city, progress) === 'Locked') return '';
  const previous = progress[city.id] ?? { wins: 0, losses: 0 };
  if (previous.lastMatch === matchId) return previous.lastMessage ?? '';
  const message = resultMessage(city, won, !previous.wins);
  progress[city.id] = { wins: previous.wins + Number(won), losses: previous.losses + Number(!won), lastMatch: matchId, lastMessage: message };
  try { localStorage.setItem(computerKey, JSON.stringify(progress)); }
  catch { return 'This browser could not save your tournament result.'; }
  return message;
}

export function resultMessage(city: City, won: boolean, firstWin: boolean) {
  if (!won) return 'Return to the city list to try again.';
  const next = cities.find(entry => entry.requires === city.id);
  if (!firstWin) return city.name + ' won again.';
  return next ? city.name + ' completed. ' + next.name + ' is now unlocked!' : city.name + ' completed. You won the circuit!';
}

export function cityDifficulty(city: City) {
  return difficulties[city.level - 1];
}

export function getPlayerSecret() {
  try {
    const saved = localStorage.getItem('billiard-player-secret');
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
  } catch {}
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem('billiard-player-secret', secret); } catch {}
  return secret;
}
