/// <reference types="vite/client" />

import { chooseGame } from './home';
import { shouldAskAboutTv } from './tv-detection';
import { remoteKey } from './tv-controls';
import { installDialogFallback, installDialogDismissal } from './tv-dialogs';
import { t } from './i18n';
import { installAppSettings, setTvPreference, tvPreference } from './app-settings';
import { setupPwa } from './pwa';

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
    try { history.replaceState(null, '', url.href); } catch {}
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
}

void start().catch(() => {
  document.querySelector<HTMLElement>('#status')!.textContent = t('The game could not start. Please reload this page.');
});
