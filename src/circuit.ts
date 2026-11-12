import cityData from './cities.json';
import { difficulties, type Difficulty } from './difficulty';
import { t } from './i18n';

export const cities = cityData;
export type City = typeof cities[number];
export type Circuit = 'online' | 'computer';
export type Progress = Record<string, { wins: number; losses: number }>;
export type Mode =
  | { kind: 'casual' }
  | { kind: 'training'; opponent: 'solo' | 'computer'; difficulty: Difficulty }
  | { kind: 'online'; city: City }
  | { kind: 'computer'; city: City; stage: number; matchId: string };

const computerKey = 'billiard-computer-circuit-v1';

export function computerProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(computerKey) ?? '{}') ?? {}; }
  catch { return {}; }
}

export function cityStatus(city: City, progress: Progress) {
  if (city.requires && !progress[city.requires]?.wins) return 'Locked';
  return progress[city.id]?.wins ? 'Completed' : 'Unlocked';
}

export function resultMessage(city: City, won: boolean, firstWin: boolean) {
  if (!won) return t('Return to the city list to try again.');
  const next = cities.find(entry => entry.requires === city.id);
  if (!firstWin) return t('{city} won again.', { city: t(city.name) });
  return next ? t('{city} completed. {next} is now unlocked!', { city: t(city.name), next: t(next.name) })
    : t('{city} completed. You won the circuit!', { city: t(city.name) });
}

export function cityDifficulty(city: City) {
  return difficulties[city.level - 1];
}

export function onlineMedals(progress: Progress) {
  return cities.filter(city => progress[city.id]?.wins > 0);
}

export function onlineMedalName(city: City) {
  return t('{city} medal', { city: t(city.name) });
}

export async function fetchOnlineProgress(secret: string, signal?: AbortSignal): Promise<Progress> {
  const response = await fetch('/circuit-progress', {
    method: 'POST', headers: { 'X-Player-Secret': secret }, signal,
  });
  if (!response.ok) throw new Error('Progress unavailable');
  return response.json();
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
