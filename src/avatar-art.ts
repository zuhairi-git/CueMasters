// Player portraits are drawn as inline SVG so each one can blink, breathe and
// react (see the avatar rules in glass.css). Everything sits on a 100 × 100 grid.

type Hair = 'crop' | 'side' | 'long' | 'bun' | 'curly' | 'bald' | 'pony' | 'spiky' | 'bob' | 'cap' | 'scarf' | 'afro' | 'braids' | 'band';
type Extra = 'glasses' | 'shades' | 'beard' | 'moustache' | 'earrings' | 'bowtie' | 'freckles' | 'collar' | 'stripe';
type Mouth = 'smile' | 'grin' | 'smirk';

interface Look {
  /** Backdrop and its soft highlight. */
  bg: [string, string];
  /** Skin and its shadow. */
  skin: [string, string];
  hair: string;
  style: Hair;
  shirt: string;
  /** Collars, stripes, headbands, caps and scarves. */
  trim: string;
  mouth: Mouth;
  extras?: Extra[];
}

const skins: Record<string, [string, string]> = {
  pale: ['#ffdfc8', '#f0c1a3'],
  light: ['#f6cfa8', '#e2ad86'],
  tan: ['#e2ad7e', '#c88d5e'],
  olive: ['#cf9c6a', '#b37d4c'],
  brown: ['#a5693f', '#89512d'],
  dark: ['#74482b', '#5b351d'],
};

export const avatarLooks: Look[] = [
  { bg: ['#1fa58d', '#7fe3cf'], skin: skins.light, hair: '#3b2a21', style: 'crop', shirt: '#f5c451', trim: '#fff6dc', mouth: 'smile', extras: ['collar'] },
  { bg: ['#e9a418', '#ffe08a'], skin: skins.tan, hair: '#1d1a23', style: 'long', shirt: '#3567d6', trim: '#cfe0ff', mouth: 'grin', extras: ['earrings'] },
  { bg: ['#4f6fe8', '#a9bcff'], skin: skins.brown, hair: '#151318', style: 'curly', shirt: '#ff7a59', trim: '#ffe1d6', mouth: 'smile', extras: ['glasses'] },
  { bg: ['#f2705f', '#ffc2b5'], skin: skins.pale, hair: '#c4552c', style: 'bob', shirt: '#1d8a6f', trim: '#c9f2e3', mouth: 'smirk', extras: ['freckles', 'stripe'] },
  { bg: ['#7a55e6', '#c3b1ff'], skin: skins.dark, hair: '#17141a', style: 'bald', shirt: '#f4f1ea', trim: '#c2253b', mouth: 'grin', extras: ['beard', 'bowtie'] },
  { bg: ['#21aecb', '#9be8f6'], skin: skins.light, hair: '#e3bd5c', style: 'pony', shirt: '#e0457b', trim: '#ffd3e2', mouth: 'grin', extras: ['collar'] },
  { bg: ['#e58a1f', '#ffd08a'], skin: skins.olive, hair: '#2a2320', style: 'side', shirt: '#27364f', trim: '#e9c46a', mouth: 'smirk', extras: ['moustache', 'bowtie'] },
  { bg: ['#e2527f', '#ffb5cc'], skin: skins.dark, hair: '#1a1418', style: 'afro', shirt: '#ffd166', trim: '#7a4b00', mouth: 'grin', extras: ['earrings', 'stripe'] },
  { bg: ['#3c9a58', '#a8e6b5'], skin: skins.tan, hair: '#33261f', style: 'cap', shirt: '#f4f1ea', trim: '#d63d3d', mouth: 'smile', extras: ['stripe'] },
  { bg: ['#4c6cb3', '#a9c1f2'], skin: skins.light, hair: '#2a2024', style: 'scarf', shirt: '#6a3fc4', trim: '#8a5be0', mouth: 'smile' },
  { bg: ['#d9653a', '#ffbf9e'], skin: skins.pale, hair: '#a7afb8', style: 'side', shirt: '#35506e', trim: '#dfe8f2', mouth: 'smile', extras: ['glasses', 'moustache', 'collar'] },
  { bg: ['#1fa39c', '#93e4dd'], skin: skins.brown, hair: '#231a16', style: 'bun', shirt: '#f2f2f2', trim: '#1fa39c', mouth: 'smile', extras: ['earrings', 'stripe'] },
  { bg: ['#b446c2', '#ecaef4'], skin: skins.olive, hair: '#15131a', style: 'spiky', shirt: '#161a24', trim: '#63ddf1', mouth: 'smirk', extras: ['shades', 'stripe'] },
  { bg: ['#e6ae25', '#ffe69a'], skin: skins.dark, hair: '#1b1719', style: 'braids', shirt: '#2f93f0', trim: '#ffd166', mouth: 'grin' },
  { bg: ['#63b43a', '#c3ee9f'], skin: skins.light, hair: '#6b4a2e', style: 'band', shirt: '#ff5d5d', trim: '#ffffff', mouth: 'grin', extras: ['stripe'] },
  { bg: ['#3f5273', '#9db3d9'], skin: skins.tan, hair: '#dcd5c8', style: 'long', shirt: '#b3475a', trim: '#f6d7dd', mouth: 'smile', extras: ['glasses', 'collar'] },
];

const face = 'M29 43C29 27 38.5 19 50 19s21 8 21 24c0 15-9.5 25-21 25S29 58 29 43Z';
const cropHair = 'M28 44C26 25 37 14.5 50 14.5S74 25 72 44C71.5 38 70 34.5 67.5 32 61 28.5 39 28.5 32.5 32 30 34.5 28.5 38 28 44Z';
const partedHair = 'M50 16.5C39 17 30 25 28.5 44 33 36 41 30 50 25.5 59 30 67 36 71.5 44 70 25 61 17 50 16.5Z';

/** Hair that falls behind the face: drawn before the neck and ears. */
function hairBehind({ style, hair, trim }: Look) {
  switch (style) {
    case 'long': return `<path d="M23 46C21 23 35 10.5 50 10.5S79 23 77 46L79 80C72 85 64 82 62 74L38 74C36 82 28 85 21 80Z" fill="${hair}"/>`;
    case 'bob': return `<path d="M24.5 45C22.5 23 36 11.5 50 11.5S77.5 23 75.5 45L76.5 63C73 67.5 66.5 67 64.5 61L35.5 61C33.5 67 27 67.5 23.5 63Z" fill="${hair}"/>`;
    case 'bun': return `<circle cx="50" cy="10.5" r="8.5" fill="${hair}"/>`;
    case 'pony': return `<path d="M66 20C80 16 90 30 84 50 82 58 78 62 75 64 78 52 76 40 68 32Z" fill="${hair}"/><circle cx="70" cy="24" r="3" fill="${trim}"/>`;
    case 'afro': return `<circle cx="50" cy="31" r="28" fill="${hair}"/>`;
    case 'braids': return `<path d="M27.5 44C25.5 24 37 12.5 50 12.5S74.5 24 72.5 44Z" fill="${hair}"/>`
      + `<path d="M25 42C21 52 21.5 70 24.5 82 27 84.5 31 84.5 33 82 31 70 31 54 33 44ZM75 42C79 52 78.5 70 75.5 82 73 84.5 69 84.5 67 82 69 70 69 54 67 44Z" fill="${hair}"/>`
      + `<path d="M23.4 74h8.4v3.4h-8.2ZM68.2 74h8.4l-.2 3.4h-8.2Z" fill="${trim}"/>`;
    case 'scarf': return `<path d="M21.5 50C19.5 24 35 9.5 50 9.5S80.5 24 78.5 50C78.5 68 72 82 62 88L38 88C28 82 21.5 68 21.5 50Z" fill="${trim}"/>`;
    default: return '';
  }
}

/** Hair, hats and scarves that sit over the forehead. */
function hairInFront({ style, hair, trim }: Look) {
  switch (style) {
    case 'crop': case 'bun': case 'pony': return `<path d="${cropHair}" fill="${hair}"/>`;
    case 'side': return `<path d="M28 45C25 25 37 13.5 51 13.5S75 25 72 45C71.5 39 70 35 67.5 32 58 26.5 44 28 34 35 31 37.5 29 41 28 45Z" fill="${hair}"/>`;
    case 'long': case 'braids': return `<path d="${partedHair}" fill="${hair}"/>`;
    case 'curly': return `<path d="${cropHair}" fill="${hair}"/><g fill="${hair}"><circle cx="31" cy="31" r="7"/><circle cx="36" cy="22" r="8"/><circle cx="45" cy="16.5" r="8.5"/><circle cx="55" cy="16.5" r="8.5"/><circle cx="64" cy="22" r="8"/><circle cx="69" cy="31" r="7"/></g>`;
    case 'bald': return '<ellipse cx="42" cy="27" rx="7" ry="3.6" transform="rotate(-24 42 27)" fill="#fff" opacity=".2"/>';
    case 'spiky': return `<path d="M28 44L26.5 27 33.5 31 35.5 16.5 43 25.5 48 11.5 54 24.5 61.5 14.5 63.5 27.5 72 22.5 72 44C71 37 69 33.5 66.5 31.5 60 28 40 28 33.5 31.5 31 33.5 29 37 28 44Z" fill="${hair}"/>`;
    case 'bob': return `<path d="M30 41C30 26 39 17 50 17S70 26 70 41C63 33.5 37 33.5 30 41Z" fill="${hair}"/>`;
    case 'afro': return `<path d="M30.5 40C31 28 39 20.5 50 20.5S69 28 69.5 40C64 32 57 29 50 29S36 32 30.5 40Z" fill="${hair}"/>`;
    case 'band': return `<path d="${cropHair}" fill="${hair}"/><path d="M28.5 36C36 30.5 64 30.5 71.5 36L71.8 41C64 35.5 36 35.5 28.2 41Z" fill="${trim}"/>`;
    case 'cap': return `<path d="M28 44C27.5 40 28 37 29 35L33 35C31 38 29.5 41 28 44ZM72 44C72.5 40 72 37 71 35L67 35C69 38 70.5 41 72 44Z" fill="${hair}"/>`
      + `<path d="M27.5 37C26.5 22 38 12.5 50 12.5S73.5 22 72.5 37Z" fill="${trim}"/><path d="M50 12.5V34" stroke="#000" stroke-opacity=".16" stroke-width="1.2"/>`
      + `<path d="M25 36.5C40 31.5 60 31.5 75 36.5 82 39 80 43.5 74 42 60 37.5 40 37.5 26 42 20 43.5 18 39 25 36.5Z" fill="${trim}"/>`
      + '<path d="M25 36.5C40 31.5 60 31.5 75 36.5 82 39 80 43.5 74 42 60 37.5 40 37.5 26 42 20 43.5 18 39 25 36.5Z" fill="#000" opacity=".22"/><circle cx="50" cy="12.5" r="2" fill="#fff" opacity=".7"/>';
    case 'scarf': return `<path d="M30 41C30 26.5 39 18.5 50 18.5S70 26.5 70 41C65 31 57.5 26.5 50 26.5S35 31 30 41Z" fill="${hair}"/>`
      + `<path d="M30.5 50C33 64 41 72 50 72S67 64 69.5 50C70.5 60 70 74 62 84L38 84C30 74 29.5 60 30.5 50Z" fill="${trim}"/>`
      + '<path d="M30.5 50C33 64 41 72 50 72S67 64 69.5 50C69.8 53 69.8 56 69.4 59 66 69 58.5 75.5 50 75.5S34 69 30.6 59C30.2 56 30.2 53 30.5 50Z" fill="#000" opacity=".14"/>';
  }
}

function mouth(kind: Mouth, small: boolean) {
  if (kind === 'grin' && !small) {
    return '<g class="av-mouth"><path d="M43 56.5Q50 66 57 56.5Z" fill="#6f2330"/><path d="M44.4 57.3Q50 60 55.6 57.3L55.2 56.6H44.8Z" fill="#fff"/></g>';
  }
  const curve = small ? 'M45 59.6Q50 63 55 59.6' : kind === 'smirk' ? 'M44.5 58.6Q51 61.6 56.5 56.4' : 'M43.5 57.5Q50 63 56.5 57.5';
  return `<path class="av-mouth" d="${curve}" fill="none" stroke="#7d2d38" stroke-width="2.1" stroke-linecap="round"/>`;
}

function person(look: Look) {
  const [skin, shade] = look.skin;
  const has = (extra: Extra) => look.extras?.includes(extra) ?? false;
  const covered = look.style === 'scarf';
  const brow = ['bald', 'scarf', 'cap'].includes(look.style) ? '#2a2024' : look.hair;
  const shadesOn = has('shades');
  let body = `<path d="M11 101C11 81 29 70.5 50 70.5S89 81 89 101Z" fill="${look.shirt}"/>`;
  if (!covered) body += `<path d="M42 70.5 50 81 58 70.5C55 73 45 73 42 70.5Z" fill="${shade}"/>`;
  if (has('stripe')) body += `<path d="M14 90C30 86 70 86 86 90L86 95C70 91 30 91 14 95Z" fill="${look.trim}"/>`;
  if (has('collar')) body += `<path d="M41.5 70 50 80.5 44.5 83 37.5 73.5ZM58.5 70 50 80.5 55.5 83 62.5 73.5Z" fill="${look.trim}"/>`;
  if (has('bowtie')) body += `<path d="M50 76.5 41.5 72.5V80.5ZM50 76.5 58.5 72.5V80.5Z" fill="${look.trim}"/><circle cx="50" cy="76.5" r="2.2" fill="#000" opacity=".35"/>`;

  let head = hairBehind(look);
  head += `<path d="M43 57h14v13.5c0 5-14 5-14 0Z" fill="${shade}"/>`;
  if (!covered) head += `<ellipse cx="29" cy="46" rx="3.6" ry="5" fill="${skin}"/><ellipse cx="71" cy="46" rx="3.6" ry="5" fill="${skin}"/>`;
  head += `<path d="${face}" fill="${skin}"/>`;
  head += `<path d="M29 45C30 58.5 39.5 68 50 68S70 58.5 71 45C69 56 60.5 63.5 50 63.5S31 56 29 45Z" fill="${shade}" opacity=".55"/>`;
  if (has('beard')) {
    head += `<path d="M30.5 47C30 62 39.5 71.5 50 71.5S70 62 69.5 47C67.5 55 62 58.5 57 57.5 53 56 47 56 43 57.5 38 58.5 32.5 55 30.5 47Z" fill="${look.hair}"/>`
      + `<ellipse cx="50" cy="59.8" rx="6.6" ry="3.8" fill="${skin}"/>`;
  }
  head += hairInFront(look);
  head += '<circle cx="36" cy="53" r="3.6" fill="#ff7d7d" opacity=".24"/><circle cx="64" cy="53" r="3.6" fill="#ff7d7d" opacity=".24"/>';
  if (has('freckles')) {
    head += '<g fill="#b5651d" opacity=".5"><circle cx="36" cy="50" r=".8"/><circle cx="38.5" cy="52" r=".8"/><circle cx="34.5" cy="52.5" r=".8"/><circle cx="64" cy="50" r=".8"/><circle cx="61.5" cy="52" r=".8"/><circle cx="65.5" cy="52.5" r=".8"/></g>';
  }
  if (!shadesOn) {
    head += `<path d="M36 38.4q5-3 10 0M54 38.4q5-3 10 0" fill="none" stroke="${brow}" stroke-width="2" stroke-linecap="round"/>`
      + '<g class="av-eyes"><ellipse cx="41" cy="45" rx="2.8" ry="3.4" fill="#1f1b24"/><ellipse cx="59" cy="45" rx="2.8" ry="3.4" fill="#1f1b24"/>'
      + '<circle cx="42" cy="43.7" r=".95" fill="#fff"/><circle cx="60" cy="43.7" r=".95" fill="#fff"/></g>';
  }
  head += `<path d="M50 47.5q-2.4 4.6 0 6" fill="none" stroke="${shade}" stroke-width="1.5" stroke-linecap="round"/>`;
  if (has('moustache')) head += `<path d="M40.5 56.5C43.5 52 48 52.6 50 54.6 52 52.6 56.5 52 59.5 56.5 56 57.4 52.5 57 50 56.2 47.5 57 44 57.4 40.5 56.5Z" fill="${look.hair}"/>`;
  head += mouth(look.mouth, has('moustache') || has('beard'));
  if (has('glasses')) {
    head += '<g fill="#fff" fill-opacity=".16" stroke="#1d2433" stroke-width="1.8"><circle cx="41" cy="45" r="6.2"/><circle cx="59" cy="45" r="6.2"/></g>'
      + '<path d="M47.2 45h5.6M34.8 44l-5-2M65.2 44l5-2" fill="none" stroke="#1d2433" stroke-width="1.8" stroke-linecap="round"/>';
  }
  if (shadesOn) {
    head += '<path d="M33 41.5h14.5a1.5 1.5 0 0 1 1.5 1.5v3a6 6 0 0 1-6 6h-5.5a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 1.5-1.5ZM52.5 41.5h14.5a1.5 1.5 0 0 1 1.5 1.5v3a6 6 0 0 1-6 6h-5.5a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 1.5-1.5Z" fill="#14161d"/>'
      + '<path d="M49 43.6h3M31.5 43l-3-1M68.5 43l3-1" fill="none" stroke="#14161d" stroke-width="1.8" stroke-linecap="round"/>'
      + '<g class="av-glint" fill="#fff" opacity=".55"><path d="M36.5 43.2h3.6l-3 6.6h-3.6ZM56 43.2h3.6l-3 6.6h-3.6Z"/></g>';
  }
  if (has('earrings') && !covered) head += '<circle cx="27.6" cy="53.4" r="1.9" fill="#f5c451"/><circle cx="72.4" cy="53.4" r="1.9" fill="#f5c451"/>';

  return `<rect width="100" height="100" fill="${look.bg[0]}"/><circle cx="50" cy="32" r="42" fill="${look.bg[1]}" opacity=".5"/>`
    + '<path d="M0 100V72C22 86 78 86 100 72V100Z" fill="#000" opacity=".1"/>'
    + `<g class="av-body">${body}</g><g class="av-head">${head}</g>`;
}

/** The computer opponent: a friendly table-side robot with a glowing antenna. */
function robot() {
  return '<rect width="100" height="100" fill="#22314a"/><circle cx="50" cy="32" r="42" fill="#4d74a8" opacity=".45"/>'
    + '<path d="M0 100V72C22 86 78 86 100 72V100Z" fill="#000" opacity=".14"/>'
    + '<g class="av-body"><path d="M17 101C17 83 31 73 50 73S83 83 83 101Z" fill="#8fa3bd"/><path d="M30 101C30 90 38 84 50 84S70 90 70 101Z" fill="#6f84a3"/>'
    + '<circle class="av-glow" cx="50" cy="91" r="3.6" fill="#63ddf1"/></g>'
    + '<g class="av-head"><rect x="44" y="60" width="12" height="14" fill="#5f7391"/>'
    + '<path d="M50 22V12" stroke="#9fb3cc" stroke-width="2.6" stroke-linecap="round"/><circle class="av-glow" cx="50" cy="10" r="3.8" fill="#ff7a66"/>'
    + '<rect x="24" y="37" width="6" height="13" rx="2.5" fill="#7f93ae"/><rect x="70" y="37" width="6" height="13" rx="2.5" fill="#7f93ae"/>'
    + '<rect x="29" y="21" width="42" height="43" rx="12" fill="#dfe7f2"/><path d="M29 44v8c0 7 5 12 12 12h18c7 0 12-5 12-12v-8c0 7-5 12-12 12H41c-7 0-12-5-12-12Z" fill="#000" opacity=".1"/>'
    + '<rect x="33.5" y="29.5" width="33" height="22" rx="9" fill="#141d2b"/>'
    + '<g class="av-eyes"><circle cx="42" cy="40.5" r="4.2" fill="#63ddf1"/><circle cx="58" cy="40.5" r="4.2" fill="#63ddf1"/>'
    + '<circle cx="43.3" cy="39.2" r="1.2" fill="#fff"/><circle cx="59.3" cy="39.2" r="1.2" fill="#fff"/></g>'
    + '<path class="av-mouth" d="M43.5 57.2Q50 60.4 56.5 57.2" fill="none" stroke="#6f84a3" stroke-width="2.3" stroke-linecap="round"/></g>';
}

export const robotAvatar = 'robot';

/** Inline SVG for an avatar id: "illustrated-1" to "illustrated-16", or the robot. */
export function avatarArt(id: string) {
  const number = Number(/^illustrated-(\d+)$/.exec(id)?.[1]);
  const index = Number.isInteger(number) && number >= 1 && number <= avatarLooks.length ? number - 1 : 0;
  const art = id === robotAvatar ? robot() : person(avatarLooks[index]);
  // Offset each portrait's idle loop so a row of them never blinks in unison.
  const delay = id === robotAvatar ? 1.3 : (index * 1.37) % 5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" focusable="false" style="--av-delay:-${delay.toFixed(2)}s">${art}</svg>`;
}

/** A stable portrait for a named rival, never the one the player wears. */
export function rivalAvatar(name: string, taken: string) {
  let hash = 0;
  for (const letter of name) hash = (hash * 31 + letter.codePointAt(0)!) % 9973;
  const pick = (offset: number) => 'illustrated-' + ((hash + offset) % avatarLooks.length + 1);
  return pick(0) === taken ? pick(1) : pick(0);
}
