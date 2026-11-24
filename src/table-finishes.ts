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

// Career venues use their own cloth, cabinet and rail finishes.
const careerFinishes: [pool: string, snooker: string, cushion: string, rail: string][] = [
  ['#177b69', '#863349', '#105145', '#273b36'],
  ['#216191', '#7b293a', '#143c60', '#1c2c45'],
  ['#81516c', '#8a3556', '#512d48', '#342436'],
  ['#847236', '#804537', '#514823', '#3a3023'],
  ['#277681', '#74384d', '#185059', '#192e3d'],
  ['#464e94', '#672f51', '#2b3066', '#242640'],
  ['#467444', '#96344a', '#2a492a', '#263526'],
  ['#955032', '#923e3e', '#62311c', '#42291e'],
  ['#374b70', '#63263b', '#24334f', '#1a2235'],
  ['#15624d', '#6e243a', '#113d32', '#172c28'],
];
const championshipColors: Colors = ['#124b48', '#103331', '#10151f'];
const cityAccents: Record<string, string> = {
  helsinki: '#9edfe1',
  stockholm: '#efc896',
  copenhagen: '#eab1a3',
  berlin: '#bbc9f3',
  london: '#c4e5be',
};

export interface CareerTable {
  id: string;
  colors: Colors;
  accent: string;
  championship: boolean;
}

export function careerTable(city: string, stage: number, snooker: boolean): CareerTable {
  const [pool, red, cushion, rail] = careerFinishes[stage];
  const championship = city === 'london' && stage === careerFinishes.length - 1;
  return {
    id: city + '-' + stage,
    colors: championship ? championshipColors : [snooker ? red : pool, snooker ? '#4b2438' : cushion, rail],
    accent: championship ? '#f3ca75' : cityAccents[city],
    championship,
  };
}

// Physical coordinates shared by the overhead, TV and 3D tables. The inlay stays clear of the bed and pocket mouths.
export interface RailInlay {
  x: number;
  z: number;
  width: number;
  depth: number;
  diamond?: boolean;
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
