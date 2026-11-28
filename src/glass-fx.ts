// Makes the glass react: a soft light follows the pointer across panes and
// buttons, mode cards lean towards it, and presses send out a ring.
// All of it is decoration set through CSS variables; glass.css draws it.

const panes = '.mode-card, .selection-card, .wallet-chip, .home-games, .ui-dialog, .game-notice, footer.game-hud, '
  + '.camera-zoom.game-hud, header.game-hud > .game-heading, header.game-hud > #score, header.game-hud > nav';
const buttons = '.ui-button:not(#stroke, #tip, #fineAim, #spinBall), .home-back';
const pressable = '.ui-button:not(#stroke, #tip, #fineAim, #spinBall), .home-back, .mode-card, button.selection-card, .avatar-choice';
const maxTilt = 5;

export function installGlassFx() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lit: HTMLElement[] = [];
  let pending: PointerEvent | undefined;
  let frame = 0;

  function clear(keep: HTMLElement[]) {
    for (const element of lit) {
      if (keep.includes(element)) continue;
      element.classList.remove('is-lit');
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
    }
    lit = keep;
  }

  function light() {
    frame = 0;
    const event = pending;
    if (!event || !(event.target instanceof Element)) return;
    // Touches have no hover to follow; the press ring is their feedback.
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') { clear([]); return; }
    const targets = [event.target.closest<HTMLElement>(buttons), event.target.closest<HTMLElement>(panes)]
      .filter((element): element is HTMLElement => Boolean(element));
    clear(targets);
    for (const element of targets) {
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      element.style.setProperty('--mx', x.toFixed(1) + 'px');
      element.style.setProperty('--my', y.toFixed(1) + 'px');
      element.classList.add('is-lit');
      if (element.matches('.mode-card') && !reducedMotion.matches) {
        element.style.setProperty('--tilt-y', ((x / bounds.width - .5) * 2 * maxTilt).toFixed(2) + 'deg');
        element.style.setProperty('--tilt-x', ((.5 - y / bounds.height) * 2 * maxTilt).toFixed(2) + 'deg');
      }
    }
  }

  document.addEventListener('pointermove', event => {
    pending = event;
    frame ||= requestAnimationFrame(light);
  }, { passive: true });
  document.addEventListener('pointerleave', () => clear([]));
  window.addEventListener('blur', () => clear([]));

  document.addEventListener('pointerdown', event => {
    if (reducedMotion.matches || !(event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>(pressable);
    if (!element || element.matches(':disabled')) return;
    element.classList.remove('fx-press');
    // Restart the ring when presses come quickly.
    void element.offsetWidth;
    element.classList.add('fx-press');
    element.addEventListener('animationend', () => element.classList.remove('fx-press'), { once: true });
  }, { passive: true });
}
