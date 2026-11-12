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

export function tableFinish(style: string, snooker: boolean): Colors {
  if (snooker) return ['#851e39', '#4d142c', '#211a29'];
  return cityFinishes[style]?.colors ?? standard[style] ?? standard['Tournament Blue'];
}
