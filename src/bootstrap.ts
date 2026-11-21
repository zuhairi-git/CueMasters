/// <reference types="vite/client" />

import { chooseGame } from './home';
import { shouldAskAboutTv } from './tv-detection';
import { remoteKey } from './tv-controls';
import { installDialogFallback, installDialogDismissal } from './tv-dialogs';
import { t } from './i18n';
import { installAppSettings, setTvPreference, tvPreference } from './app-settings';
import { setupPwa } from './pwa';

// Reusable for future async screens: showCueLoader('Loading match…'); hideCueLoader().
const loader = document.querySelector<HTMLElement>('#cueLoader');
const launchStarted = performance.now();
let loadingDepth = 0;
export function showCueLoader(message = 'Loading…') {
  loadingDepth++;
  if (!loader) return;
  loader.classList.remove('cue-loader--leaving');
  loader.hidden = false;
  const label = loader.querySelector<HTMLElement>('.cue-loader__label');
  if (label) label.textContent = message;
}
export function hideCueLoader() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth || !loader) return;
  loader.classList.add('cue-loader--leaving');
  window.setTimeout(() => { if (!loadingDepth) loader.hidden = true; }, 400);
}
async function start() {
  installDialogFallback();
  installDialogDismissal();
  installAppSettings();
  setupPwa();
  await chooseGame();
  const url = new URL(location.href);
  if (url.searchParams.get('table') === '3d') {
    setTvPreference(false, false);
    url.searchParams.delete('table');
    try { history.replaceState(history.state, '', url.href); } catch {}
  }
  if (shouldAskAboutTv(navigator.userAgent, tvPreference())) {
    const dialog = document.querySelector<HTMLDialogElement>('#tvDetection')!;
    const choices = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    await new Promise<void>(resolve => {
      const choose = (enabled: boolean) => {
        setTvPreference(enabled);
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
  // Always display the initial branded loader for at least three seconds.
  await new Promise<void>(resolve => window.setTimeout(resolve, Math.max(0, 3000 - (performance.now() - launchStarted))));
  hideCueLoader();
}

void start().catch(() => {
  hideCueLoader();
  document.querySelector<HTMLElement>('#status')!.textContent = t('The game could not start. Please reload this page.');
});
