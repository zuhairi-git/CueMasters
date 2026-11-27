type Colors = [string, string, string];

export const cityFinishes: Record<string, { name: string; colors: Colors }> = {
  helsinki: { name: 'Helsinki Harbor', colors: ['#327d89', '#1b555d', '#1d293a'] },
  stockholm: { name: 'Stockholm Amber', colors: ['#a86d36', '#704421', '#30272b'] },
  copenhagen: { name: 'Copenhagen Brick', colors: ['#a84e47', '#73322f', '#362229'] },
  berlin: { name: 'Berlin Slate', colors: ['#535f80', '#343f5e', '#202532'] },
  london: { name: 'London Emerald', colors: ['#248451', '#165437', '#23352d'] },
};

const standard: Record<string, Colors> = {
  'Club Green': ['#199d85', '#116858', '#182e35'],
  'Tournament Blue': ['#258bd0', '#125283', '#182b43'],
  'Burgundy Lounge': ['#b44876', '#742c54', '#30233c'],
};

export function tableFinish(style: string, snooker: boolean, venue?: CareerTable): Colors {
  if (venue) return venue.colors;
  if (snooker) return ['#851e39', '#4d142c', '#211a29'];
  return cityFinishes[style]?.colors ?? standard[style] ?? standard['Tournament Blue'];
}

// Each city is its own venue: a family of cloths, two cabinet woods, a rail motif and pocket metal.
export type Motif = 'diamond' | 'portholes' | 'bars' | 'bricks' | 'dashes' | 'crown';
const venues: Record<string, { cloths: Colors; rails: [string, string]; accent: string; motif: Motif; trim: string }> = {
  // Harbor hall: sea cloths, weathered navy rails, steel portholes.
  helsinki: { cloths: ['#327d89', '#3f6f9c', '#4f8f86'], rails: ['#1d2f42', '#2a4450'], accent: '#9edfe1', motif: 'portholes', trim: '#a9c3cc' },
  // Amber room: warm cloths on honey oak with slim brass bars.
  stockholm: { cloths: ['#a86d36', '#2f6f8f', '#a8872e'], rails: ['#4a3220', '#30272b'], accent: '#efc896', motif: 'bars', trim: '#d9a95c' },
  // Canal house: brick and verdigris cloths, copper fittings, brick-course sights.
  copenhagen: { cloths: ['#a84e47', '#3d7a6a', '#b0683c'], rails: ['#40262a', '#2c3a36'], accent: '#eab1a3', motif: 'bricks', trim: '#c98562' },
  // Industrial loft: slate and concrete cloths, gunmetal rails, twin steel dashes.
  berlin: { cloths: ['#535f80', '#55606b', '#6b4f7a'], rails: ['#202532', '#2b2b31'], accent: '#bbc9f3', motif: 'dashes', trim: '#8f99ad' },
  // Members' club: greens and burgundy on mahogany, triple diamonds in old gold.
  london: { cloths: ['#248451', '#1f6b5c', '#7a2e3e'], rails: ['#3a211c', '#23352d'], accent: '#c4e5be', motif: 'crown', trim: '#d8b46a' },
};
const snookerRed = '#8a2a42';
// The room gets brighter as a city's field narrows towards the final.
const roomLight = [.88, 1, 1.1];
const championshipColors: Colors = ['#124b48', '#103331', '#10151f'];
const championshipGold = '#f3ca75';

const channels = (color: string) => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16));
const hex = (rgb: number[]) => '#' + rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('');
const mix = (from: string, to: string, share: number) => hex(channels(from).map((value, i) => value + (channels(to)[i] - value) * share));
const shade = (color: string, light: number) => hex(channels(color).map(value => value * light));

// Snooker finals keep a red cloth, tinted for the host city.
const finalReds: Record<string, string> = {
  helsinki: '#7a2f4b',
  stockholm: '#8c3a2e',
  copenhagen: '#7d2233',
  berlin: '#5e2440',
};

export interface CareerTable {
  id: string;
  colors: Colors;
  accent: string;
  championship: boolean;
  motif: Motif;
  /** Pocket rims and cabinet metalwork. */
  trim: string;
}

const finalStage = 9;

export function careerTable(city: string, stage: number, snooker: boolean): CareerTable {
  const venue = venues[city] ?? venues.london;
  const { motif } = venue;
  const id = city + '-' + stage;
  // Every city final is a championship table on the city's own cloth; London keeps the gold-trimmed green.
  const championship = stage === finalStage;
  if (championship) {
    const cityCloth = cityFinishes[city]?.colors;
    const colors: Colors = city === 'london' || !cityCloth ? championshipColors
      : snooker ? [finalReds[city], '#4b2438', '#15131c'] : [cityCloth[0], cityCloth[1], '#15131c'];
    return { id, colors, accent: championshipGold, championship, motif, trim: championshipGold };
  }
  // Three cloths under three levels of light give every stage its own table.
  const pool = shade(venue.cloths[stage % 3], roomLight[Math.floor(stage / 3)]);
  const cloth = snooker ? mix(pool, snookerRed, .72) : pool;
  return { id, colors: [cloth, shade(cloth, .64), venue.rails[stage % 2]], accent: venue.accent, championship, motif, trim: venue.trim };
}

// Challenge tables step up with the tier; timed challenges swap in an ember-lit speed table.
const challengeTables: Record<string, { cloth: string; rail: string; accent: string; motif: Motif; trim: string }> = {
  Rookie: { cloth: '#2f8f5b', rail: '#3d2c20', accent: '#e9e4d2', motif: 'diamond', trim: '#c9c2ad' },
  Pro: { cloth: '#1f6fb3', rail: '#1b2230', accent: '#8fd3ff', motif: 'bars', trim: '#b9c6d6' },
  Master: { cloth: '#4a2f6e', rail: '#16121f', accent: '#e7bf68', motif: 'crown', trim: '#e7bf68' },
};

export function challengeTable(tier: string, timed: boolean, snooker: boolean): CareerTable {
  const table = challengeTables[tier] ?? challengeTables.Rookie;
  const base = timed ? shade(table.cloth, .82) : table.cloth;
  const cloth = snooker ? mix(base, snookerRed, .72) : base;
  return {
    id: 'challenge-' + tier + (timed ? '-timed' : ''),
    colors: [cloth, shade(cloth, .64), timed ? '#221a1c' : table.rail],
    accent: timed ? '#ff9d5c' : table.accent,
    championship: false,
    motif: timed ? 'dashes' : table.motif,
    trim: timed ? '#d98a5a' : table.trim,
  };
}

// Physical coordinates shared by the overhead, TV and 3D tables. The inlay stays clear of the bed and pocket mouths.
export interface RailInlay {
  x: number;
  z: number;
  width: number;
  depth: number;
  diamond?: boolean;
  round?: boolean;
}

export const championshipInlays: RailInlay[] = [-1, 1].flatMap(side => [
  ...[-1, 1].flatMap(end => [
    { x: side * .73, z: end * .62, width: .007, depth: .86 },
    { x: side * .747, z: end * .62, width: .003, depth: .83 },
    { x: side * .709, z: end * .60, width: .016, depth: .016, diamond: true },
  ]),
  { x: 0, z: side * 1.37, width: .88, depth: .006 },
  { x: 0, z: side * 1.355, width: .67, depth: .003 },
  ...[-.053, 0, .053].map(x => ({
    x, z: side * 1.335, width: x ? .016 : .027, depth: x ? .016 : .027, diamond: true,
  })),
]);

// One sight's marks, measured along and across its rail.
type Mark = { along?: number; across?: number; size: [along: number, across: number]; diamond?: boolean; round?: boolean };
const flank = (size: number, gap: number, shape: Partial<Mark>): Mark[] =>
  [-gap, gap].map(along => ({ along, size: [size, size], ...shape }));
const motifs: Record<Motif, Mark[]> = {
  diamond: [{ size: [.012, .012], diamond: true }],
  portholes: [{ size: [.014, .014], round: true }, ...flank(.006, .026, { round: true })],
  bars: [{ size: [.005, .036] }],
  bricks: [{ size: [.022, .011] }, ...flank(.011, .027, {})],
  dashes: [-.007, .007].map(across => ({ across, size: [.05, .004] })),
  crown: [{ size: [.013, .013], diamond: true }, ...flank(.007, .024, { diamond: true })],
};

/** Rail sights for a motif. Each renderer passes the line its own rails carry their sights on. */
export function railSights(motif: Motif | undefined, sideX: number, endZ: number): RailInlay[] {
  const pieces: RailInlay[] = [];
  for (const side of [-1, 1]) for (const { along = 0, across = 0, size, diamond, round } of motifs[motif ?? 'diamond']) {
    for (const z of [-.92, -.63, -.34, .34, .63, .92]) pieces.push({ x: side * (sideX + across), z: z + along, width: size[1], depth: size[0], diamond, round });
    for (const x of [-.31, 0, .31]) pieces.push({ x: x + along, z: side * (endZ + across), width: size[0], depth: size[1], diamond, round });
  }
  return pieces;
}
