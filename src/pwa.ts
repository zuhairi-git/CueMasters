import { fullscreenActive, fullscreenSupported, toggleFullscreen } from './fullscreen';

interface InstallPrompt extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function installHelpId() {
  const { userAgent, maxTouchPoints } = navigator;
  if (!window.isSecureContext) return 'installSecure';
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'installAppleMobile';
  if (/Android/i.test(userAgent)) return 'installAndroid';
  if (/Macintosh/i.test(userAgent)) return 'installMac';
  return 'installDesktop';
}

export function setupPwa() {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const worker = new URL('cue-master-sw.js', manifest.href);
    void navigator.serviceWorker.register(worker).catch(error => {
      console.warn('Cue Master service worker could not start.', error);
    });
  }

  const displayFullscreen = () => window.matchMedia('(display-mode: fullscreen)').matches;
  const installed = displayFullscreen() || window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed) {
    const root = document.documentElement;
    if (!displayFullscreen() && fullscreenSupported(document, root)) {
      // The browser requires a user gesture when the app launches in standalone mode.
      document.addEventListener('click', function enterFullscreen(event) {
        if (!event.isTrusted) return;
        document.removeEventListener('click', enterFullscreen, true);
        if (event.target instanceof Element && event.target.closest('#fullscreen')) return;
        if (!displayFullscreen() && !fullscreenActive(document)) {
          void toggleFullscreen(document, root).catch(() => {});
        }
      }, true);
    }
    return;
  }

  const button = document.querySelector<HTMLButtonElement>('#installApp')!;
  const help = document.querySelector<HTMLElement>('#installHelp')!;
  document.getElementById(installHelpId())!.hidden = false;
  let installPrompt: InstallPrompt | undefined;
  let prompting = false;
  const showHelp = (visible: boolean) => {
    help.hidden = !visible;
    button.setAttribute('aria-expanded', String(visible));
  };
  button.hidden = false;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined;
    button.hidden = true;
    showHelp(false);
  });
  button.onclick = async () => {
    if (prompting) return;
    if (!installPrompt) {
      showHelp(help.hidden);
      return;
    }

    const prompt = installPrompt;
    installPrompt = undefined;
    prompting = true;
    showHelp(false);
    try {
      const { outcome } = await prompt.prompt();
      if (outcome === 'accepted') button.hidden = true;
    } catch {
      showHelp(true);
    } finally {
      prompting = false;
    }
  };
}
