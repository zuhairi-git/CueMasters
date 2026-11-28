// Text contrast for the glass skin (src/glass.css), checked without a browser.
// Each pairing below is one place text is drawn: an ink token, the stack of
// translucent panes under it, and the brightest and darkest things that can
// sit behind that glass. See .claude/skills/contrast/SKILL.md before editing.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/glass.css', import.meta.url), 'utf8');

function parse(color) {
  const value = color.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length <= 4 ? [...hex].map(digit => digit + digit).join('') : hex;
    const channel = at => parseInt(full.slice(at, at + 2), 16);
    return [channel(0), channel(2), channel(4), full.length === 8 ? channel(6) / 255 : 1];
  }
  const parts = /^rgba?\(([^)]+)\)$/.exec(value)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  assert.ok(parts && parts.length >= 3 && parts.every(Number.isFinite), 'unreadable colour: ' + color);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}
/** Paints a possibly translucent colour over an opaque one. */
function over(top, bottom) {
  const [r, g, b, a] = parse(top);
  const under = parse(bottom);
  const mix = (front, back) => Math.round(front * a + back * (1 - a));
  return 'rgb(' + [mix(r, under[0]), mix(g, under[1]), mix(b, under[2])].join(', ') + ')';
}
function luminance(color) {
  const [r, g, b] = parse(color).map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const blocks = {};
for (const [, name, body] of css.matchAll(/\/\* @tokens (\w+) \*\/[^{]*\{([^}]*)\}/g)) {
  blocks[name] = Object.fromEntries([...body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map(([, token, value]) => [token, value.trim()]));
}
// Midnight, ivory and the table overlays only restate what differs from the default theme.
const themes = {
  club: blocks.club,
  midnight: { ...blocks.club, ...blocks.midnight },
  ivory: { ...blocks.club, ...blocks.ivory },
  table: { ...blocks.club, ...blocks.table },
};

// What can end up behind the glass.
const brightestPhoto = '#ffe9b8'; // lamp highlights in the lounge photographs
const felt = ['#58b4e8', '#258bd0', '#199d85', '#b44876', '#851e39', '#a86d36', '#535f80', '#0b2233', '#1a2b40', '#080f1d'];
const artwork = ['#ffffff', '#000000'];
const backdrops = {
  // Veiled photographs, plus the brightest point of the Emerald and Twilight glow backgrounds.
  photo: tokens => [over(tokens['--veil'], brightestPhoto), over(tokens['--veil'], '#000000'), '#2d6b54', '#46457a', '#071513', '#0e1024'],
  // The start-up card floats on a dimmed, blurred photograph.
  loader: () => ['#4e4b45', '#080f20'],
  page: tokens => [tokens['--page'], tokens['--page-glow'],
    ...['--aurora-a', '--aurora-b', '--aurora-c'].map(glow => over(parse(tokens[glow]).slice(0, 3).reduce((rgba, channel) => rgba + channel + ', ', 'rgba(') + '.34)', tokens['--page']))],
  felt: () => felt,
  artwork: () => artwork,
  none: () => ['#000000'],
};

const AA = 4.5;
// Finishes are the highlights painted over a surface; text must survive the brightest and the plainest part.
const finishes = {
  glass: tokens => [[], [tokens['--sheen-peak'], 'rgba(255, 255, 255, .06)']],
  gold: tokens => [[], [tokens['--sheen-button']], ['rgba(0, 0, 0, .14)']],
  button: () => [[], ['rgba(255, 255, 255, .06)', 'rgba(255, 255, 255, .08)']],
  tint: () => [[], ['rgba(255, 255, 255, .45)'], ['rgba(0, 0, 0, .18)']],
  flat: () => [[]],
};

const pageThemes = ['club', 'midnight', 'ivory'];
const everywhere = ['photo', 'page'];
const pairs = [
  // Home and selection screens
  ...['--ink', '--ink-soft', '--ink-gold'].map(ink => ({ where: 'cards, chips, kicker and game switch', themes: pageThemes, ink, on: ['--pane'], over: everywhere })),
  { where: 'card action pills and city finals', themes: pageThemes, ink: '--ink-gold', on: ['--pane', '--pane-gold'], over: everywhere },
  { where: 'final card title text', themes: pageThemes, ink: '--ink', on: ['--pane', '--pane-gold'], over: everywhere },
  ...['rgba(141, 228, 241, .14)', 'rgba(255, 208, 139, .14)', 'rgba(213, 183, 244, .14)', 'rgba(156, 228, 186, .14)'].flatMap(tint => ['--ink', '--ink-soft'].map(ink => (
    { where: 'mode cards with their colour wash (' + tint + ')', themes: pageThemes, ink, on: ['--pane', tint], over: everywhere }))),
  ...['--ink', '--ink-soft'].map(ink => ({ where: 'mode card arrow chip', themes: pageThemes, ink, on: ['--pane', '--pane-control'], over: everywhere })),
  { where: 'buttons on cards', themes: pageThemes, ink: '--ink', on: ['--pane', '--pane-control'], over: everywhere },
  ...['--ink', '--ink-soft'].map(ink => ({ where: 'titles and tier headings on the plain page', themes: pageThemes, ink, on: [], over: ['page'], finish: 'flat' })),
  { where: 'headline and tagline on a veiled photo', themes: pageThemes, ink: '--ink-photo', on: [], over: ['photo'], finish: 'flat' },
  ...['--ink-badge', '--ink-badge-good', '--ink-badge-gold'].map(ink => ({ where: 'status badges and stage numbers over artwork', themes: pageThemes, ink, on: ['--pane-badge'], over: ['artwork'], finish: 'flat' })),
  ...['#8de4f1', '#ffd08b', '#d5b7f4', '#9ce4ba', '#ffe08a', '#d99a22'].map(fill => ({ where: 'mode icons, stand-alone actions and ribbons (' + fill + ')', themes: pageThemes, ink: '--ink-on-tint', on: [fill], over: ['none'], finish: 'tint' })),
  // Dialogs open over the home screen and over the table.
  ...['--ink', '--ink-soft', '--ink-gold', '--ink-link', '--ink-good', '--ink-danger'].flatMap(ink => [
    { where: 'dialogs', themes: pageThemes, ink, on: ['--pane-strong'], over: [...everywhere, 'felt'] },
    { where: 'dialog field groups', themes: pageThemes, ink, on: ['--pane-strong', '--pane-inset'], over: [...everywhere, 'felt'] },
  ]),
  ...['--panel', '--control', '--hover'].flatMap(surface => ['--ink', '--ink-soft', '--ink-gold'].map(ink => (
    { where: 'buttons, selects and menus (' + surface + ')', themes: [...pageThemes, 'table'], ink, on: [surface], over: ['none'], finish: 'button' }))),
  { where: 'primary and switched-on buttons', themes: [...pageThemes, 'table'], ink: '--ink-on-gold', on: ['--ink-gold'], over: ['none'], finish: 'gold' },
  // Match HUD and everything else drawn over the cloth
  ...['--ink', '--ink-soft', '--ink-gold', '--ink-link', '--ink-good', '--ink-danger'].flatMap(ink => [
    { where: 'HUD strips, shot controls and zoom rail', themes: ['table'], ink, on: ['--pane'], over: ['felt'] },
    { where: 'player seats, hint chips, callouts, pocket picker and result card', themes: ['table'], ink, on: ['--pane-strong'], over: ['felt'] },
  ]),
  ...['--ink', '--ink-soft', '--ink-gold'].map(ink => ({ where: 'active seat, ball on and shot clock', themes: ['table'], ink, on: ['--pane-strong', '--pane-gold'], over: ['felt'] })),
  { where: 'HUD buttons', themes: ['table'], ink: '--ink', on: ['--pane', '--pane-control'], over: ['felt'] },
  { where: 'hovered HUD buttons', themes: ['table'], ink: '--ink', on: ['--pane', 'rgba(255, 255, 255, .14)'], over: ['felt'] },
  ...['#ffe08a', '#d99a22'].map(fill => ({ where: 'streak callout (' + fill + ')', themes: ['table'], ink: '--ink-on-gold', on: [fill], over: ['none'], finish: 'flat' })),
  ...['#0d1a33e0', '#04070ef5', '#3a2a08e6'].flatMap(wash => ['--ink', '--ink-soft', '--ink-gold'].map(ink => (
    { where: 'match intro (' + wash + ')', themes: ['table'], ink, on: [wash], over: ['felt'], finish: 'flat' }))),
  { where: 'match intro versus pill', themes: ['table'], ink: '--ink', on: ['#0d1a33e0', '--pane-control'], over: ['felt'], finish: 'flat' },
  { where: 'loading card', themes: ['table'], ink: '#f4f7ff', on: ['#0a1221cc', '#ffffff1f'], over: ['loader'], finish: 'flat' },
];

function weakest(pair, tokens) {
  const colour = value => value.startsWith('--') ? tokens[value] : value;
  const behind = pair.over.flatMap(name => backdrops[name](tokens));
  let worst = { contrast: Infinity };
  for (const backdrop of behind) {
    for (const finish of finishes[pair.finish ?? 'glass'](tokens)) {
      const surface = [...pair.on.map(colour), ...finish].reduce((under, layer) => over(layer, under), backdrop);
      const contrast = ratio(colour(pair.ink), surface);
      if (contrast < worst.contrast) worst = { contrast, backdrop, surface };
    }
  }
  return worst;
}

test('every theme defines the ink and pane tokens with literal colours', () => {
  assert.deepEqual(Object.keys(blocks).sort(), ['club', 'ivory', 'midnight', 'table']);
  for (const [name, tokens] of Object.entries(themes)) {
    for (const [token, value] of Object.entries(tokens)) {
      assert.doesNotThrow(() => parse(value), name + ' ' + token + ' must be a hex or rgba() literal');
    }
  }
  for (const name of ['midnight', 'ivory', 'table']) {
    for (const ink of ['--ink', '--ink-soft', '--ink-gold', '--ink-on-gold', '--ink-link', '--ink-good', '--ink-danger', '--pane', '--pane-strong']) {
      assert.ok(blocks[name][ink], name + ' restates ' + ink);
    }
  }
});

test('text meets WCAG AA on every glass surface, in every theme, over the brightest and darkest backdrops', () => {
  const failures = [];
  for (const pair of pairs) {
    for (const name of pair.themes) {
      const { contrast, backdrop, surface } = weakest(pair, themes[name]);
      if (contrast < (pair.min ?? AA)) {
        failures.push(`${name}: ${pair.ink} on ${pair.on.join(' + ') || 'the backdrop'} (${pair.where}) is ${contrast.toFixed(2)}:1 over ${backdrop} -> ${surface}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('no ink token is left unchecked and the stylesheet never bypasses the tokens', () => {
  const checked = new Set(pairs.map(pair => pair.ink));
  const inks = new Set(Object.values(blocks).flatMap(tokens => Object.keys(tokens)).filter(token => token.startsWith('--ink')));
  assert.deepEqual([...inks].filter(ink => !checked.has(ink)), [], 'every --ink-* token needs a pairing above');

  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const literal = [...rules.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)].map(match => match[1].trim())
    .filter(value => !/^(var\(--ink[\w-]*\)|inherit|color-mix\(in srgb, var\(--ink[\w-]*\) \d+%, transparent\))( !important)?$/.test(value));
  assert.deepEqual(literal, [], 'text colours in glass.css must be --ink-* tokens');
  const usedInks = new Set([...rules.matchAll(/color\s*:[^;}]*var\((--ink[\w-]*)\)/g)].map(match => match[1]));
  assert.deepEqual([...usedInks].filter(ink => !inks.has(ink)), [], 'an undefined ink token is used');
});

test('the contrast maths matches the WCAG reference values', () => {
  assert.equal(ratio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#ffffff').toFixed(2), '4.48');
  assert.equal(over('rgba(0, 0, 0, .5)', '#ffffff'), 'rgb(128, 128, 128)');
  assert.equal(over('#00000080', '#ffffff'), 'rgb(127, 127, 127)');
});
