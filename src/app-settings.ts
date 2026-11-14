import { installLanguagePicker, t } from './i18n';
import { isTvBrowser } from './tv-detection';
import { remoteKey } from './tv-controls';
import { navigateTvDialog } from './tv-dialogs';
import { avatarMarkup, installAvatarPicker, playerAvatar } from './player-avatars';

const tvKey = 'billiard-tv';
const soundKey = '3dbilliard-sound';
const graphicsKey = 'billiard-graphics';
const backgroundKey = 'billiard-home-background';
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

  const renderBackgroundName = installHomeBackground(dialog);

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
    renderBackgroundName();
    translateAvatars?.();
  });
  translateAvatars = installAvatarPicker(() => {
    open.innerHTML = avatarMarkup(playerAvatar(0));
  });
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
  installSettingsRemote(dialog);
}

function installHomeBackground(settings: HTMLDialogElement) {
  const dialog = document.querySelector<HTMLDialogElement>('#homeBackgroundSettings')!;
  const open = document.querySelector<HTMLButtonElement>('#openHomeBackground')!;
  const currentName = document.querySelector<HTMLElement>('#currentHomeBackground')!;
  const backdrop = document.querySelector<HTMLElement>('.home-backdrop')!;
  const choices = [...dialog.querySelectorAll<HTMLButtonElement>('[data-background-choice]')];
  let selected = choices[0];

  function renderName() {
    currentName.textContent = selected.querySelector('.background-name')!.textContent;
  }

  function apply(choice: HTMLButtonElement) {
    selected = choice;
    backdrop.dataset.background = choice.dataset.backgroundChoice!;
    for (const button of choices) button.setAttribute('aria-pressed', String(button === choice));
    renderName();
  }

  try {
    const saved = localStorage.getItem(backgroundKey);
    const choice = choices.find(button => button.dataset.backgroundChoice === saved);
    if (choice) apply(choice);
  } catch {}

  for (const choice of choices) {
    choice.onclick = () => {
      apply(choice);
      try { localStorage.setItem(backgroundKey, backdrop.dataset.background!); } catch {}
    };
  }
  open.onclick = () => {
    dialog.showModal();
    settings.classList.add('modal-parent');
    settings.setAttribute('inert', '');
    selected.focus();
  };
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    settings.classList.remove('modal-parent');
    settings.removeAttribute('inert');
    if (settings.open) open.focus();
  });
  installSettingsRemote(dialog);
  return renderName;
}

function installSettingsRemote(dialog: HTMLDialogElement) {
  dialog.addEventListener('keydown', event => {
    if (tvPreference() !== 'on' && !isTvBrowser(navigator.userAgent)) return;
    const key = remoteKey(event.key, event.keyCode);
    if (!key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat || (key !== 'ok' && key !== 'back')) navigateTvDialog(dialog, key);
  });
}
