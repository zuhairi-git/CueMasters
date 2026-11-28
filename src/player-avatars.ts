import { avatarArt, avatarLooks } from './avatar-art';
import { t } from './i18n';

export { rivalAvatar, robotAvatar } from './avatar-art';

const illustratedAvatars = avatarLooks.map((_, index) => ({
  id: 'illustrated-' + (index + 1),
  label: 'Avatar {number}',
  number: index + 1,
}));
const selections = ['illustrated-1', 'illustrated-2'];
const storageKey = (seat: number) => 'billiard-player-' + (seat + 1) + '-avatar';

export function playerAvatar(seat: number) {
  return selections[seat];
}

export function installAvatarPicker(onPrimaryAvatarChange: () => void) {
  const seat = document.querySelector<HTMLSelectElement>('#avatarSeat')!;
  const choices = document.querySelector<HTMLElement>('#avatarChoices')!;
  const options = illustratedAvatars;
  for (const player of [0, 1]) {
    try {
      const saved = localStorage.getItem(storageKey(player));
      if (saved && options.some(option => option.id === saved)) selections[player] = saved;
    } catch {}
  }

  const buttons = options.map(({ id }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-choice';
    button.innerHTML = avatarMarkup(id);
    button.onclick = () => {
      const player = seat.selectedIndex;
      selections[player] = id;
      try { localStorage.setItem(storageKey(player), id); } catch {}
      renderSelection();
      if (player === 0) onPrimaryAvatarChange();
    };
    return button;
  });
  function renderSelection() {
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(options[index].id === selections[seat.selectedIndex]));
    });
  }
  seat.onchange = renderSelection;
  choices.append(...buttons);
  renderSelection();
  onPrimaryAvatarChange();

  return () => {
    buttons.forEach((button, index) => {
      const option = options[index];
      const label = t(option.label, { number: option.number });
      button.title = label;
      button.setAttribute('aria-label', label);
    });
  };
}

/** An animated portrait. The wrapper clips it to a circle and is hidden from assistive tech. */
export function avatarMarkup(id: string) {
  return `<span class="avatar-illustration" aria-hidden="true">${avatarArt(id)}</span>`;
}
