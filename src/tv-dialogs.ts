import type { RemoteKey } from './tv-controls';

export function dismissDialog(dialog: HTMLDialogElement) {
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close('');
}

export function installDialogDismissal() {
  const stack: HTMLDialogElement[] = [];
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
    const showModal = dialog.showModal.bind(dialog);
    dialog.showModal = () => {
      const wasOpen = dialog.open;
      showModal();
      if (!wasOpen) stack.push(dialog);
    };
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      const index = stack.indexOf(dialog);
      if (index >= 0) stack.splice(index, 1);
    });
  }
  const top = () => stack.filter(dialog => dialog.open).slice(-1)[0];
  const outside = (dialog: HTMLDialogElement, event: MouseEvent) => {
    if (event.target !== dialog && dialog.contains(event.target as Node)) return false;
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  let pressedOutside: HTMLDialogElement | null | undefined;
  document.addEventListener('pointerdown', event => {
    const dialog = top();
    pressedOutside = dialog && outside(dialog, event) ? dialog : null;
    if (pressedOutside) event.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', event => {
    const dialog = top();
    const startedOutside = pressedOutside;
    pressedOutside = undefined;
    if (!dialog || !outside(dialog, event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Releasing a drag outside a dialog should not dismiss it.
    if (startedOutside === null || startedOutside && startedOutside !== dialog) return;
    dismissDialog(dialog);
  }, true);
}

// Older TV browsers support Canvas 2D but may predate native modal dialogs.
export function installDialogFallback() {
  const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog')];
  if (!dialogs.length || typeof dialogs[0].showModal === 'function') return;
  const previousFocus = new WeakMap<HTMLDialogElement, HTMLElement>();
  for (const dialog of dialogs) {
    dialog.classList.add('dialog-fallback');
    dialog.showModal = () => {
      if (dialog.open) return;
      previousFocus.set(dialog, document.activeElement as HTMLElement);
      dialog.setAttribute('open', '');
      // Some TV browsers expose <dialog> as an unknown element.
      if (!dialog.open) Object.defineProperty(dialog, 'open', { configurable: true, get: () => dialog.hasAttribute('open') });
      dialog.querySelector<HTMLElement>('[autofocus], button, input, select')?.focus();
    };
    dialog.close = (value?: string) => {
      if (!dialog.hasAttribute('open')) return;
      if (value !== undefined) dialog.returnValue = value;
      dialog.removeAttribute('open');
      previousFocus.get(dialog)?.focus();
      // Native close events are queued; match that ordering for nested menus.
      setTimeout(() => dialog.dispatchEvent(new Event('close')), 0);
    };
    dialog.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.type === 'button' || button.form?.getAttribute('method') !== 'dialog') return;
      event.preventDefault();
      dialog.close(button.value);
    });
  }
  document.addEventListener('keydown', event => {
    const open = dialogs.filter(dialog => dialog.open);
    const dialog = open[open.length - 1];
    if (event.key !== 'Escape' || !dialog) return;
    event.preventDefault();
    dismissDialog(dialog);
  });
}

export function navigateTvDialog(dialog: HTMLDialogElement, key: RemoteKey) {
  if (key === 'back') {
    dismissDialog(dialog);
    return;
  }
  navigateTvControls(dialog, key);
}

export function navigateTvControls(container: HTMLElement, key: RemoteKey) {
  const controls = [...container.querySelectorAll<HTMLElement>('button, input, select, a[href]')]
    .filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
  if (!controls.length) return;
  const active = document.activeElement as HTMLElement;
  const index = controls.indexOf(active);
  if (key === 'left' || key === 'right') {
    const direction = key === 'right' ? 1 : -1;
    if (active instanceof HTMLSelectElement) {
      active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + direction));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (active instanceof HTMLInputElement && active.type === 'range') {
      direction > 0 ? active.stepUp() : active.stepDown();
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  if (key === 'ok' && index >= 0 && !(active instanceof HTMLSelectElement)) { active.click(); return; }
  const next = index < 0 ? controls[0] : controls[(index + (key === 'up' || key === 'left' ? -1 : 1) + controls.length) % controls.length];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}
