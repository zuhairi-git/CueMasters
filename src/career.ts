import { cities, computerProgress, type City, type Game } from './circuit';
import { difficulties } from './difficulty';
import { t } from './i18n';
import { cityFinishes } from './table-finishes';
import { nineBallRack, rack, radius } from './physics';

export const careerStages = [
  { title: 'Opening Match', rating: 0, opening: [0, -.65], opener: 0 },
  { title: 'Left-Side Break', rating: 0, opening: [-.19, -.68], opener: 0 },
  { title: 'Right-Side Break', rating: 1, opening: [.19, -.68], opener: 0 },
  { title: 'Away Match', rating: 1, opening: [-.10, -.78], opener: 1 },
  { title: 'Deep Break', rating: 1, opening: [0, -.93], opener: 0 },
  { title: 'Right-Rail Match', rating: 2, opening: [.34, -.72], opener: 0 },
  { title: 'Return Match', rating: 1, opening: [.10, -.78], opener: 1 },
  { title: 'Quarterfinal', rating: 2, opening: [-.34, -.72], opener: 0 },
  { title: 'Semifinal', rating: 2, opening: [-.23, -.87], opener: 1 },
  { title: 'City Final', rating: 2, opening: [.23, -.87], opener: 0 },
] as const;

// Every city ends in its own final: a named champion, a series format and a house rule.
export const cityFinals: Record<string, { title: string; champion: string; racks: number; breaks: 'you' | 'champion' | 'alternate'; twist: string }> = {
  helsinki: { title: 'Harbor Cup Final', champion: 'Aino Virtanen', racks: 2, breaks: 'you', twist: 'You break every rack.' },
  stockholm: { title: 'Amber Crown Final', champion: 'Elsa Lindqvist', racks: 2, breaks: 'champion', twist: 'The champion breaks every rack.' },
  copenhagen: { title: 'Canal Masters Final', champion: 'Magnus Holm', racks: 2, breaks: 'alternate', twist: 'Breaks alternate, champion first.' },
  berlin: { title: 'Iron Gate Final', champion: 'Lena Brandt', racks: 3, breaks: 'alternate', twist: 'A long race to three. Breaks alternate.' },
  london: { title: 'London Championship', champion: 'Sir Edmund Clarke', racks: 3, breaks: 'alternate', twist: 'The grand final on the gold table.' },
};
export const sixRedCount = 6;

export function careerOpening(city: City, stage: number, game: Game, round: number, random = Math.random) {
  const snooker = game === 'snooker';
  const balls = game === 'nineball' ? nineBallRack(random) : rack(snooker, random);
  const { opening: [x, z] } = careerStages[stage];
  const final = careerStage(city, stage, game);
  const opener = !final.final ? careerStages[stage].opener
    : final.breaks === 'you' ? 0 : final.breaks === 'champion' ? 1 : city.id === 'copenhagen' ? 1 : 0;
  if (final.sixRed) for (let index = sixRedCount + 1; index <= 15; index++) balls[index].pocketed = true;
  const openingX = round % 2 ? -x : x;
  Object.assign(balls[0], snooker ? { x: openingX * .48, z: -.755 + (z + .65) * .45 } : { x: openingX, z });
  // The cue ball never starts touching another ball: slide it along the baulk
  // side of the D until it has clear cloth around it.
  const cue = balls[0];
  const clear = (cx: number) => balls.every((ball, index) => !index || ball.pocketed
    || Math.hypot(ball.x - cx, ball.z - cue.z) >= 2 * radius + 0.012);
  if (!clear(cue.x)) {
    const direction = cue.x < 0 || round % 2 ? -1 : 1;
    for (let offset = 0.005; offset < 0.3; offset += 0.005) {
      const candidate = [cue.x + direction * offset, cue.x - direction * offset].find(clear);
      if (candidate !== undefined) { cue.x = candidate; break; }
    }
  }
  if (game === 'pool') {
    // Leave the eight and the opposite-group rear corners in their legal rack positions.
    const indices = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];
    const positions = indices.map(index => ({ x: balls[index].x, z: balls[index].z }));
    const rotation = (stage + (city.level - 1) * 3 + round * 5) % positions.length;
    indices.forEach((index, slot) => Object.assign(balls[index], positions[(slot + rotation) % positions.length]));
  }
  return { balls, opener: final.final && final.breaks !== 'alternate' ? opener : round % 2 ? 1 - opener : opener };
}

export function careerStage(city: City, index: number, game: Game = 'pool') {
  const final = index === careerStages.length - 1 ? cityFinals[city.id] : undefined;
  const snooker = game === 'snooker';
  // Snooker finals are quick six-red frames until the full-frame London championship.
  const sixRed = Boolean(final) && snooker && city.id !== 'london';
  const racksToWin = final ? snooker ? 2 : final.racks : 1;
  return {
    ...careerStages[index],
    title: final?.title ?? careerStages[index].title,
    objective: snooker
      ? sixRed ? 'Win two six-red frames.' : racksToWin > 1 ? 'Win two full snooker frames.' : 'Win a full snooker frame.'
      : game === 'nineball'
        ? racksToWin === 3 ? 'Be first to win three nine-ball racks.' : racksToWin === 2 ? 'Win two nine-ball racks.' : 'Win a nine-ball rack.'
      : racksToWin === 3 ? 'Be first to win three eight-ball racks.' : racksToWin === 2 ? 'Win two full eight-ball racks.' : 'Win a full eight-ball rack.',
    final: Boolean(final),
    champion: final?.champion,
    twist: final?.twist,
    breaks: final?.breaks ?? 'alternate',
    racksToWin,
    sixRed,
    bestOfThree: racksToWin === 2,
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
const careerKey = (game: Game) => game === 'snooker' ? 'snooker-career-v1' : game === 'nineball' ? 'nineball-career-v1' : key;

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
  // City champions from Copenhagen onward play a level above the rest of their field.
  const champion = index === careerStages.length - 1 && city.level >= 3 ? 1 : 0;
  return difficulties[Math.min(difficulties.length - 1, careerStages[index].rating + Math.floor(city.level / 2) + champion)];
}

export function careerReward(index: number) {
  return { coins: index === 9 ? 175 : index === 8 ? 125 : 75, points: (index + 1) * 10 };
}

export function cityTrophy(city: City, progress: Career) {
  return Boolean(progress.clears[city.id]?.[careerStages.length - 1]);
}

/** Adds coins earned outside career matches, such as challenge stars. */
export function awardCoins(coins: number, game: Game = 'pool') {
  const progress = careerProgress(game);
  progress.coins += Math.max(0, Math.round(coins));
  return saveCareer(progress, game);
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
