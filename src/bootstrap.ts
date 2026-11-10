/// <reference types="vite/client" />

import helsinkiHarbor from './helsinki-harbor.svg?raw';
import { shouldAskAboutTv } from './tv-detection';
import { remoteKey } from './tv-controls';
import { installDialogFallback, installDialogDismissal } from './tv-dialogs';

function installHarborParallax(card: HTMLButtonElement, scene: HTMLElement) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  card.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const bounds = card.getBoundingClientRect();
    scene.style.setProperty('--harbor-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 8}px`);
    scene.style.setProperty('--harbor-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 4}px`);
  });
  card.addEventListener('pointerleave', () => {
    scene.style.removeProperty('--harbor-x');
    scene.style.removeProperty('--harbor-y');
  });
}

async function pickCity() {
  const picker = document.querySelector<HTMLElement>('#cityPicker')!;
  const choices = [...picker.querySelectorAll<HTMLButtonElement>('button[data-city]')];
  const helsinki = picker.querySelector<HTMLButtonElement>('[data-city="helsinki"]')!;
  const harbor = helsinki.querySelector<HTMLElement>('.city-card-scene')!;
  harbor.innerHTML = helsinkiHarbor;
  installHarborParallax(helsinki, harbor);
  const city = await new Promise<HTMLButtonElement>(resolve => {
    picker.onkeydown = event => {
      const key = remoteKey(event.key, event.keyCode);
      if (!key || key === 'back') return;
      event.preventDefault();
      if (key === 'ok') {
        if (!event.repeat) (event.target as HTMLButtonElement).click();
      } else {
        const step = key === 'left' || key === 'up' ? -1 : 1;
        const index = choices.indexOf(event.target as HTMLButtonElement);
        choices[(index + step + choices.length) % choices.length].focus();
      }
    };
    for (const choice of choices) {
      choice.addEventListener('click', () => {
        picker.onkeydown = null;
        resolve(choice);
      }, { once: true });
    }
    choices[0].focus();
  });
  const name = city.dataset.cityName!;
  document.body.dataset.city = city.dataset.city;
  document.querySelector<HTMLElement>('#gameCity')!.textContent = name;
  document.querySelector<HTMLElement>('#gameMenuTitle')!.textContent = `${name} · Game menu`;
  document.title = `${name} · Billiard`;
  picker.hidden = true;
}

async function start() {
  await pickCity();
  installDialogFallback();
  installDialogDismissal();
  let preference: string | null = null;
  try { preference = localStorage.getItem('billiard-tv'); } catch {}
  const url = new URL(location.href);
  if (url.searchParams.get('table') === '3d') {
    preference = 'off';
    document.documentElement.dataset.tvChoice = 'off';
    url.searchParams.delete('table');
    try { history.replaceState(null, '', url.href); } catch {}
  }
  if (shouldAskAboutTv(navigator.userAgent, preference)) {
    const dialog = document.querySelector<HTMLDialogElement>('#tvDetection')!;
    const choices = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    await new Promise<void>(resolve => {
      const choose = (enabled: boolean) => {
        // The attribute also works if browser storage is unavailable.
        document.documentElement.dataset.tvChoice = enabled ? 'on' : 'off';
        try { localStorage.setItem('billiard-tv', enabled ? 'on' : 'off'); } catch {}
        document.removeEventListener('keydown', navigate, true);
        dialog.close();
        resolve();
      };
      const navigate = (event: KeyboardEvent) => {
        const key = remoteKey(event.key, event.keyCode);
        if (!key) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        if (key === 'ok') (document.activeElement as HTMLButtonElement)?.click();
        else if (key === 'back') choose(false);
        else choices[(choices.indexOf(document.activeElement as HTMLButtonElement) + 1) % choices.length].focus();
      };
      choices[0].onclick = () => choose(true);
      choices[1].onclick = () => choose(false);
      dialog.addEventListener('cancel', event => { event.preventDefault(); choose(false); }, { once: true });
      document.addEventListener('keydown', navigate, true);
      dialog.showModal();
      choices[0].focus();
    });
  }
  await import('./main');
}

void start().catch(() => {
  document.querySelector<HTMLElement>('#status')!.textContent = 'The game could not start. Please reload this page.';
});
