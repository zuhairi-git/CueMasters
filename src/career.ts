import { cities, computerProgress, type City, type Game } from './circuit';
import { difficulties } from './difficulty';
import { t } from './i18n';
import { cityFinishes } from './table-finishes';

const stageRatings = [0, 0, 1, 1, 1, 2, 1, 2, 2, 2];
export const careerStages = stageRatings.map((rating, index) => ({
  title: index === 0 ? 'Opening Match' : index === 8 ? 'Semifinal' : index === 9 ? 'City Final' : 'City Match',
  rating,
}));

export function careerStage(city: City, index: number, game: Game = 'pool') {
  const bestOfThree = city.id === 'london' && index === careerStages.length - 1;
  return {
    ...careerStages[index],
    title: bestOfThree ? 'London Championship' : careerStages[index].title,
    objective: game === 'snooker'
      ? bestOfThree ? 'Win two full snooker frames.' : 'Win a full snooker frame.'
      : bestOfThree ? 'Win two full eight-ball racks.' : 'Win a full eight-ball rack.',
    bestOfThree,
  };
}

export const careerCues = [
  { id: 'Carbon Black', price: 0, description: 'Standard cue', power: 1, spin: 1 },
  { id: 'Classic Maple', price: 300, description: 'Finer control at low power', power: 1.12, spin: 1 },
  { id: 'Rosewood', price: 600, description: 'Slightly more spin', power: 1, spin: 1.12 },
] as const;
export type CareerCue = typeof careerCues[number]['id'];
type Career = {
  clears: Record<string, Record<number, string>>;
  bonuses: Record<string, Record<number, string>>;
  coins: number;
  points: number;
  owned: CareerCue[];
  equipped: CareerCue;
};

export const careerRank = (points: number) => points >= 2750 ? 'Champion' : points >= 1650 ? 'Professional'
  : points >= 1000 ? 'Contender' : points >= 500 ? 'Club Player' : 'Rookie';
export const careerBonus = { coins: 10, points: 25 };
export const careerGoal = 'Win without scratching';

const key = 'billiard-career-v1';
const careerKey = (game: Game) => game === 'snooker' ? 'snooker-career-v1' : key;

export function careerProgress(game: Game = 'pool'): Career {
  try {
    const saved = JSON.parse(localStorage.getItem(careerKey(game)) ?? 'null') as Career | null;
    if (saved?.clears && typeof saved.clears === 'object' && Array.isArray(saved.owned)
      && Number.isSafeInteger(saved.coins) && saved.coins >= 0
      && Number.isSafeInteger(saved.points) && saved.points >= 0
      && saved.owned.includes(saved.equipped)) return { ...saved, bonuses: saved.bonuses ?? {} };
  } catch {}
  return { clears: {}, bonuses: {}, coins: 0, points: 0, owned: ['Carbon Black'], equipped: 'Carbon Black' };
}

export function careerCue(game: Game = 'pool') {
  return careerCues.find(cue => cue.id === careerProgress(game).equipped) ?? careerCues[0];
}

function saveCareer(progress: Career, game: Game) {
  try { localStorage.setItem(careerKey(game), JSON.stringify(progress)); return true; }
  catch { return false; }
}

export function equipCareerCue(id: CareerCue, game: Game = 'pool') {
  const progress = careerProgress(game);
  const cue = careerCues.find(entry => entry.id === id);
  if (!cue) return false;
  if (!progress.owned.includes(id)) {
    if (progress.coins < cue.price) return false;
    progress.coins -= cue.price;
    progress.owned.push(id);
  }
  progress.equipped = id;
  return saveCareer(progress, game);
}

export function careerClears(city: City, progress: Career) {
  return careerStages.filter((_, index) => progress.clears[city.id]?.[index]).length;
}

export function careerCityStatus(city: City, progress: Career, game: Game = 'pool') {
  const previous = cities.find(entry => entry.id === city.requires);
  if (previous && careerClears(previous, progress) < careerStages.length && !(game === 'pool' && computerProgress()[previous.id]?.wins)) return 'Locked';
  return careerClears(city, progress) === careerStages.length ? 'Completed' : 'Unlocked';
}

export function careerStageStatus(city: City, index: number, progress: Career, game: Game = 'pool') {
  if (!careerStages[index] || careerCityStatus(city, progress, game) === 'Locked') return 'Locked';
  const cleared = progress.clears[city.id] ?? {};
  if (cleared[index]) return 'Completed';
  if (index === 0) return 'Unlocked';
  const required = index >= 8 ? index : 1 + 2 * Math.floor((index - 1) / 2);
  return careerStages.slice(0, required).every((_, stage) => cleared[stage]) ? 'Unlocked' : 'Locked';
}

export function careerDifficulty(city: City, index: number) {
  return difficulties[Math.min(difficulties.length - 1, careerStages[index].rating + Math.floor(city.level / 2))];
}

export function careerReward(index: number) {
  return { coins: index === 9 ? 175 : index === 8 ? 125 : 75, points: (index + 1) * 10 };
}

export function finishCareerStage(city: City, index: number, matchId: string, won: boolean, skillGoal = false, game: Game = 'pool') {
  const progress = careerProgress(game);
  const status = careerStageStatus(city, index, progress, game);
  if (status === 'Locked') return '';
  if (!won) return t('Return to the game list to try again.');
  const reward = careerReward(index);
  const newBonus = skillGoal && !progress.bonuses[city.id]?.[index];
  if (status !== 'Completed') {
    (progress.clears[city.id] ??= {})[index] = matchId;
    progress.coins += reward.coins;
    progress.points += reward.points;
  }
  if (newBonus) {
    (progress.bonuses[city.id] ??= {})[index] = matchId;
    progress.coins += careerBonus.coins;
    progress.points += careerBonus.points;
  }
  if ((status !== 'Completed' || newBonus) && !saveCareer(progress, game)) return t('This browser could not save your tournament result.');
  const firstClear = progress.clears[city.id][index] === matchId;
  const earned = firstClear ? t('Game cleared! +{coins} coins · +{points} career points', reward) : t('Game cleared again.');
  const bonus = progress.bonuses[city.id]?.[index] === matchId
    ? ' ' + t('Skill bonus! +{coins} coins · +{points} career points', careerBonus) : '';
  if (!firstClear || index !== careerStages.length - 1) return earned + bonus;
  const next = cities.find(entry => entry.requires === city.id);
  return earned + bonus + ' ' + (next
    ? t('{city} completed. {next} is now unlocked!', { city: t(city.name), next: t(next.name) })
    : t('{city} completed. You won the circuit!', { city: t(city.name) }))
    + ' ' + t('Table finish unlocked: {finish}.', { finish: t(cityFinishes[city.id].name) });
}
