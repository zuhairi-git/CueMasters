import { installLanguagePicker, t } from './i18n';
import { isTvBrowser } from './tv-detection';
import { remoteKey } from './tv-controls';
import { navigateTvDialog } from './tv-dialogs';
import { installAvatarPicker } from './player-avatars';

const tvKey = 'billiard-tv';
const soundKey = '3dbilliard-sound';
const graphicsKey = 'billiard-graphics';
let tvChoice: 'on' | 'off' | null = null;
export const soundPreference = { enabled: true, volume: 0.45 };

export function tvPreference() {
  return tvChoice;
}

export function setTvPreference(enabled: boolean, persist = true) {
  tvChoice = enabled ? 'on' : 'off';
  if (persist) {
    try { localStorage.setItem(tvKey, tvChoice); } catch {}
  }
}

export function installAppSettings() {
  const dialog = document.querySelector<HTMLDialogElement>('#appSettings')!;
  const open = document.querySelector<HTMLButtonElement>('#openAppSettings')!;
  const tvToggle = document.querySelector<HTMLButtonElement>('#tvToggle')!;
  const soundToggle = document.querySelector<HTMLButtonElement>('#soundToggle')!;
  const volume = document.querySelector<HTMLInputElement>('#volume')!;
  const volumeLabel = document.querySelector<HTMLOutputElement>('#volumeLabel')!;
  const graphics = document.querySelector<HTMLSelectElement>('#quality')!;

  try {
    const saved = localStorage.getItem(tvKey);
    if (saved === 'on' || saved === 'off') tvChoice = saved;
  } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(soundKey) ?? 'null');
    if (saved && typeof saved.enabled === 'boolean' && Number.isFinite(saved.volume)) {
      soundPreference.enabled = saved.enabled;
      volume.value = String(Math.max(0, Math.min(100, saved.volume * 100)));
    }
  } catch {}
  soundPreference.volume = Number(volume.value) / 100;
  try {
    const saved = localStorage.getItem(graphicsKey);
    if (saved && [...graphics.options].some(option => option.value === saved)) graphics.value = saved;
  } catch {}

  function render() {
    const tvEnabled = tvPreference() === 'on';
    tvToggle.textContent = t(tvEnabled ? 'TV on' : 'TV off');
    tvToggle.setAttribute('aria-pressed', String(tvEnabled));
    soundToggle.textContent = t(soundPreference.enabled ? 'Sound on' : 'Sound off');
    soundToggle.setAttribute('aria-pressed', String(soundPreference.enabled));
    volumeLabel.value = volume.value + '%';
  }

  function saveSound() {
    soundPreference.volume = Number(volume.value) / 100;
    try { localStorage.setItem(soundKey, JSON.stringify(soundPreference)); } catch {}
    render();
  }

  // Capture static translations before generating avatar labels.
  let translateAvatars: (() => void) | undefined;
  installLanguagePicker(() => {
    render();
    translateAvatars?.();
  });
  translateAvatars = installAvatarPicker();
  translateAvatars();
  open.onclick = () => dialog.showModal();
  tvToggle.onclick = () => {
    setTvPreference(tvPreference() !== 'on');
    render();
  };
  soundToggle.onclick = () => {
    soundPreference.enabled = !soundPreference.enabled;
    saveSound();
  };
  volume.oninput = saveSound;
  graphics.onchange = () => {
    try { localStorage.setItem(graphicsKey, graphics.value); } catch {}
  };
  dialog.addEventListener('keydown', event => {
    if (tvPreference() !== 'on' && !isTvBrowser(navigator.userAgent)) return;
    const key = remoteKey(event.key, event.keyCode);
    if (!key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat || (key !== 'ok' && key !== 'back')) navigateTvDialog(dialog, key);
  });
}
