// The winning moment: fireworks, streamers and confetti over the table.
// Everything is plain DOM and CSS so it also runs over the TV and SVG tables.

const palette = ['#f5c451', '#fff0b7', '#63ddf1', '#ff8fa3', '#8ef0c0', '#c9a7ff', '#ffffff'];
let cleanup: number | undefined;
let timers: number[] = [];

export function stopCelebration(layer: HTMLElement) {
  window.clearTimeout(cleanup);
  for (const timer of timers) window.clearTimeout(timer);
  timers = [];
  layer.replaceChildren();
  delete layer.dataset.active;
}

function firework(layer: HTMLElement, x: number, y: number, color: string, random: () => number) {
  const burst = document.createElement('span');
  burst.className = 'firework';
  burst.style.left = x + '%';
  burst.style.top = y + '%';
  burst.style.setProperty('--spark', color);
  const sparks = 16;
  for (let i = 0; i < sparks; i++) {
    const spark = document.createElement('i');
    const angle = i / sparks * Math.PI * 2 + random() * 0.3;
    const reach = 54 + random() * 62;
    spark.style.setProperty('--dx', Math.cos(angle) * reach + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * reach + 'px');
    spark.style.setProperty('--late', random() * 0.12 + 's');
    burst.append(spark);
  }
  layer.append(burst);
  timers.push(window.setTimeout(() => burst.remove(), 1700));
}

/**
 * Plays the celebration into a fixed, pointer-transparent layer.
 * `grand` adds a second wave for finals and city titles.
 */
export function celebrate(layer: HTMLElement, grand = false, random: () => number = Math.random) {
  stopCelebration(layer);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  layer.dataset.active = grand ? 'grand' : 'win';

  const flash = document.createElement('span');
  flash.className = 'victory-flash';
  layer.append(flash);

  const pieces = document.createDocumentFragment();
  const count = grand ? 96 : 64;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece' + (i % 5 === 0 ? ' streamer' : '');
    piece.style.left = (i / count * 100 + random() * 2 - 1) + '%';
    piece.style.setProperty('--confetti-color', palette[i % palette.length]);
    piece.style.setProperty('--fall-time', (2.8 + random() * 1.5) + 's');
    piece.style.setProperty('--fall-delay', (random() * (grand ? 1.6 : 0.8)) + 's');
    piece.style.setProperty('--drift', (random() * 180 - 90) + 'px');
    piece.style.setProperty('--spin', (random() * 1080 - 540) + 'deg');
    pieces.append(piece);
  }
  layer.append(pieces);

  const bursts = grand ? 9 : 5;
  for (let i = 0; i < bursts; i++) {
    timers.push(window.setTimeout(() => {
      firework(layer, 12 + random() * 76, 10 + random() * 38, palette[Math.floor(random() * (palette.length - 1))], random);
    }, 120 + i * (grand ? 330 : 380) + random() * 140));
  }
  cleanup = window.setTimeout(() => stopCelebration(layer), grand ? 6400 : 5200);
}
