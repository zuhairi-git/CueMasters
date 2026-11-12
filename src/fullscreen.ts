import { t } from './i18n';
type FullscreenDocument = Partial<Pick<Document, 'fullscreenElement' | 'exitFullscreen'>> & {
  webkitFullscreenElement?: Element | null;
  webkitCurrentFullScreenElement?: Element | null;
  webkitIsFullScreen?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
  webkitCancelFullScreen?: () => void | Promise<void>;
};
type FullscreenElement = Partial<Pick<HTMLElement, 'requestFullscreen'>> & {
  webkitRequestFullscreen?: () => void | Promise<void>;
  webkitRequestFullScreen?: () => void | Promise<void>;
};

export function fullscreenActive(doc: FullscreenDocument) {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.webkitCurrentFullScreenElement || doc.webkitIsFullScreen);
}

export function fullscreenSupported(doc: FullscreenDocument, element: FullscreenElement) {
  return Boolean((element.requestFullscreen || element.webkitRequestFullscreen || element.webkitRequestFullScreen) &&
    (doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen));
}

export async function toggleFullscreen(doc: FullscreenDocument, element: FullscreenElement) {
  if (fullscreenActive(doc)) {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen;
    if (!exit) throw new Error('Fullscreen exit is unavailable');
    await exit.call(doc);
  } else if (element.requestFullscreen) {
    await element.requestFullscreen({ navigationUI: 'hide' });
  } else {
    const enter = element.webkitRequestFullscreen || element.webkitRequestFullScreen;
    if (!enter) throw new Error('Fullscreen is unavailable');
    await enter.call(element);
  }
}

export function installFullscreenControl(button: HTMLButtonElement, notice: HTMLElement) {
  const doc = document;
  const root = doc.documentElement;
  let pending = false;
  let noticeTimeout: number | undefined;
  function sync() {
    const active = fullscreenActive(doc);
    const supported = fullscreenSupported(doc, root);
    const label = t(active ? 'Exit full screen' : 'Full screen');
    button.querySelector<HTMLElement>('.hud-label')!.textContent = label;
    button.setAttribute('aria-label', active ? t('Exit full screen and show browser navigation') : t('Enter full screen and hide browser navigation'));
    button.setAttribute('aria-pressed', String(active));
    button.title = supported ? label : t('This browser does not support full screen');
    const description = button.querySelector<HTMLElement>('.menu-description');
    if (description) description.textContent = supported ? active ? t('Show the browser navigation again') : t('Hide browser navigation while you play') : t('Full screen is unavailable in this browser');
  }
  button.onclick = async () => {
    if (pending) return;
    pending = true;
    notice.hidden = true;
    window.clearTimeout(noticeTimeout);
    try { await toggleFullscreen(doc, root); }
    catch {
      notice.textContent = t('This browser could not change full screen. Use its full-screen control if available.');
      notice.hidden = false;
      noticeTimeout = window.setTimeout(() => { notice.hidden = true; }, 8000);
    } finally { pending = false; sync(); }
  };
  // Native Escape/Back and browser controls can also change the current state.
  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('webkitfullscreenchange', sync);
  sync();
}
