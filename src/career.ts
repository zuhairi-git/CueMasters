import { cities, computerProgress, type City } from './circuit';
import { difficulties } from './difficulty';
import { t } from './i18n';
import { rack } from './physics';

type Position = [number, number, number];
type Challenge = { kind: 'pot' | 'bank' | 'contact'; attempts: number; ball: number };
type Stage = {
  title: string;
  objective: string;
  rating: number;
  layout?: Position[];
  challenge?: Challenge;
  oneVisit?: boolean;
  bestOfThree?: boolean;
};

export const careerStages: Stage[] = [
  { title: 'Opening Match', objective: 'Win a standard eight-ball rack.', rating: 0 },
  { title: 'Two-Ball Finish', objective: 'Pot your last ball, then call and pot the eight.', rating: 0,
    layout: [[0, .09, -.38], [1, .41, -.13], [8, -.42, .22]] },
  { title: 'The Cut Shot', objective: 'Pot ball 1 within two attempts.', rating: 1,
    layout: [[0, -.19, -.27], [1, .35, .14]], challenge: { kind: 'pot', attempts: 2, ball: 1 } },
  { title: 'Comeback Rack', objective: 'Win with three balls left while your opponent is on the eight.', rating: 1,
    layout: [[0, -.17, -.48], [1, .39, -.16], [2, -.31, .26], [3, .29, .68], [8, -.32, .81]] },
  { title: 'Position Play', objective: 'Pot both solids in the same visit.', rating: 1,
    layout: [[0, .10, -.32], [1, .43, -.12], [2, -.38, .22]], oneVisit: true },
  { title: 'Bank Shot', objective: 'Pot ball 1 after it hits a cushion, within three attempts.', rating: 2,
    layout: [[0, .17, -.42], [1, .22, -.03]], challenge: { kind: 'bank', attempts: 3, ball: 1 } },
  { title: 'Safety Escape', objective: 'Hit ball 1 first without scratching, within two attempts.', rating: 1,
    layout: [[0, -.29, -.58], [1, -.29, .33], [9, -.29, -.11], [10, -.13, -.11]],
    challenge: { kind: 'contact', attempts: 2, ball: 1 } },
  { title: 'Club Match', objective: 'Win a full rack against a stronger opponent.', rating: 2 },
  { title: 'Semifinal', objective: 'Win the eight-ball endgame on a crowded table.', rating: 2,
    layout: [[0, -.22, -.35], [1, .28, -.44], [2, .13, .46], [3, -.34, .77], [8, .16, .91], [9, .32, -.27], [10, -.17, .24], [11, .35, .72]] },
  { title: 'City Final', objective: 'Beat the city champion on a spread table.', rating: 2,
    layout: [[0, -.05, -.56], [1, -.46, -.29], [2, .27, -.83], [3, -.19, -.96], [4, .33, -.38],
      [5, .38, .27], [6, -.25, .42], [7, .22, .82], [8, .05, .28], [9, -.45, .87],
      [10, .44, .96], [11, .04, -.23], [12, -.38, .12], [13, .48, -.73], [14, -.39, -.76], [15, -.08, .98]] },
];

const cityStages: Record<string, Record<number, Partial<Stage>>> = {
  stockholm: {
    4: { title: 'Stockholm Run', objective: 'Clear all your solids in one visit.',
      layout: [[0, .10, -.32], [1, .43, -.12], [2, -.38, .22], [3, -.38, .92]] },
  },
  copenhagen: {
    5: { title: 'Copenhagen Long Bank', objective: 'Bank ball 1 into any pocket within two attempts.',
      layout: [[0, .17, -.55], [1, .20, -.19]], challenge: { kind: 'bank', ball: 1, attempts: 2 } },
  },
  berlin: {
    6: { title: 'Berlin Safety', objective: 'Escape the snooker in one attempt. Hit ball 1 first without scratching.',
      layout: [[0, -.40, -.66], [1, -.11, .39], [9, -.25, -.15], [10, -.12, -.15], [11, .01, -.15]],
      challenge: { kind: 'contact', ball: 1, attempts: 1 } },
  },
  london: {
    9: { title: 'London Championship', objective: 'Win two racks against the city champion.', bestOfThree: true },
  },
};

export function careerStage(city: City, index: number): Stage {
  return { ...careerStages[index], ...cityStages[city.id]?.[index] };
}

export const careerCues = [
  { id: 'Carbon Black', price: 0, description: 'Standard cue', power: 1, spin: 1 },
  { id: 'Classic Maple', price: 300, description: 'Finer control at low power', power: 1.08, spin: 1 },
  { id: 'Rosewood', price: 600, description: 'Slightly more spin', power: 1, spin: 1.08 },
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
export function careerGoal(city: City, index: number) {
  return careerStage(city, index).challenge ? 'Clear on your first attempt' : 'Clear without scratching';
}

const key = 'billiard-career-v1';
export function careerProgress(): Career {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Career | null;
    if (saved?.clears && typeof saved.clears === 'object' && Array.isArray(saved.owned)
      && Number.isSafeInteger(saved.coins) && saved.coins >= 0
      && Number.isSafeInteger(saved.points) && saved.points >= 0
      && saved.owned.includes(saved.equipped)) return { ...saved, bonuses: saved.bonuses ?? {} };
  } catch {}
  return { clears: {}, bonuses: {}, coins: 0, points: 0, owned: ['Carbon Black'], equipped: 'Carbon Black' };
}

export function careerCue() {
  return careerCues.find(cue => cue.id === careerProgress().equipped) ?? careerCues[0];
}

function saveCareer(progress: Career) {
  try { localStorage.setItem(key, JSON.stringify(progress)); return true; }
  catch { return false; }
}

export function equipCareerCue(id: CareerCue) {
  const progress = careerProgress();
  const cue = careerCues.find(entry => entry.id === id);
  if (!cue) return false;
  if (!progress.owned.includes(id)) {
    if (progress.coins < cue.price) return false;
    progress.coins -= cue.price;
    progress.owned.push(id);
  }
  progress.equipped = id;
  return saveCareer(progress);
}

export function careerClears(city: City, progress: Career) {
  return careerStages.filter((_, index) => progress.clears[city.id]?.[index]).length;
}

export function careerCityStatus(city: City, progress: Career) {
  const previous = cities.find(entry => entry.id === city.requires);
  if (previous && careerClears(previous, progress) < careerStages.length && !computerProgress()[previous.id]?.wins) return 'Locked';
  return careerClears(city, progress) === careerStages.length ? 'Completed' : 'Unlocked';
}

export function careerStageStatus(city: City, index: number, progress: Career) {
  if (!careerStages[index] || careerCityStatus(city, progress) === 'Locked') return 'Locked';
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

export function finishCareerStage(city: City, index: number, matchId: string, won: boolean, skillGoal = false) {
  const progress = careerProgress();
  const status = careerStageStatus(city, index, progress);
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
  if ((status !== 'Completed' || newBonus) && !saveCareer(progress)) return t('This browser could not save your tournament result.');
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

export const cityFinishes: Record<string, { name: string; colors: [string, string, string] }> = {
  helsinki: { name: 'Helsinki Harbor', colors: ['#327d89', '#1b555d', '#1d293a'] },
  stockholm: { name: 'Stockholm Amber', colors: ['#a86d36', '#704421', '#30272b'] },
  copenhagen: { name: 'Copenhagen Brick', colors: ['#a84e47', '#73322f', '#362229'] },
  berlin: { name: 'Berlin Slate', colors: ['#535f80', '#343f5e', '#202532'] },
  london: { name: 'London Emerald', colors: ['#248451', '#165437', '#23352d'] },
};

export function careerLayout(city: City, index: number, rackNumber = 0) {
  const stage = careerStage(city, index);
  if (!stage.layout) return;
  const balls = rack();
  for (const ball of balls) ball.pocketed = true;
  const side = (city.level + rackNumber) % 2 ? 1 : -1;
  for (const [number, x, z] of stage.layout) {
    const offset = number === 0 ? (city.level - 1) * .065 : 0;
    Object.assign(balls[number], { x: side * (x + offset), z: (rackNumber === 2 ? -1 : 1) * (z + (number === 0 ? offset * .6 : 0)), pocketed: false });
  }
  return balls;
}
