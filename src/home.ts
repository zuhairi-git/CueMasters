import { cities, cityDifficulty, cityStatus, computerProgress, getPlayerSecret, type Circuit, type Mode, type Progress } from './circuit';
import { difficulties } from './difficulty';
import { validGame, type SavedGame } from './saved-game';
import { remoteKey } from './tv-controls';
import helsinki from './helsinki-harbor.svg?raw';
import stockholm from './stockholm-skyline.svg?raw';
import copenhagen from './copenhagen-skyline.svg?raw';
import berlin from './berlin-skyline.svg?raw';
import london from './london-skyline.svg?raw';

const cityArt: Record<string, string> = { helsinki, stockholm, copenhagen, berlin, london };
const trainingNotes = ['Learn the basics', 'Practice straightforward pots', 'Play a balanced opponent', 'Face planned shots', 'Face precise shots with position play'];

function tableArt(level: number) {
  const colors = ['#d7ac58', '#57a9d2', '#cc6e67', '#9f83ce', '#f1b368'];
  const positions = [[178, 69], [204, 54], [204, 84], [230, 40], [230, 98]];
  const balls = positions.slice(0, level).map(([x, y], index) =>
    `<circle cx="${x}" cy="${y + 2}" r="8" fill="#082022" opacity=".55"/><circle cx="${x}" cy="${y}" r="7" fill="${colors[index]}"/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="#fff" opacity=".48"/>`).join('');
  return `<svg class="selection-art" viewBox="0 0 320 140" aria-hidden="true" focusable="false">
    <path fill="#142b32" d="M0 0h320v140H0z"/>
    <rect x="27" y="13" width="266" height="114" rx="19" fill="#805643" stroke="#b38662" stroke-width="2"/>
    <rect x="36" y="22" width="248" height="96" rx="11" fill="#265e58" stroke="#102e30" stroke-width="4"/>
    <path d="M80 25v90m80-90v90" stroke="#99cbad" stroke-width="1" opacity=".16"/>
    <path d="M43 28h234m-234 84h234" stroke="#9ddab4" stroke-width="2" opacity=".22"/>
    <g fill="#0b2026"><circle cx="43" cy="29" r="7"/><circle cx="160" cy="25" r="7"/><circle cx="277" cy="29" r="7"/><circle cx="43" cy="111" r="7"/><circle cx="160" cy="115" r="7"/><circle cx="277" cy="111" r="7"/></g>
    <path d="M35 107l61-28" stroke="#d9aa76" stroke-width="4" stroke-linecap="round"/>
    <path d="M112 72l55-23" stroke="#dbf1d2" stroke-dasharray="3 5" opacity=".7"/>
    <circle cx="107" cy="75" r="7" fill="#f5edda"/>
    ${balls}
  </svg>`;
}

function selectionCard(options: { title: string; subtitle: string; detail: string; artwork: string; status?: string; action?: string; play?: () => void }) {
  const card = options.play ? document.createElement('button') : document.createElement('article');
  card.className = 'selection-card';
  if (options.status) card.dataset.status = options.status.toLowerCase();
  if (card instanceof HTMLButtonElement) {
    card.type = 'button';
    card.onclick = options.play!;
  }
  card.innerHTML = `<span class="selection-scene" aria-hidden="true">${options.artwork}</span>
    ${options.status ? `<span class="city-status">${options.status}</span>` : ''}
    <span class="selection-copy">
      <span class="selection-subtitle">${options.subtitle}</span>
      <strong class="selection-title">${options.title}</strong>
      <span class="selection-detail">${options.detail}</span>
      ${options.action ? `<span class="selection-action">${options.action} <span aria-hidden="true">→</span></span>` : ''}
    </span>`;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  card.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--scene-x', ((event.clientX - bounds.left) / bounds.width - .5) * 8 + 'px');
    card.style.setProperty('--scene-y', ((event.clientY - bounds.top) / bounds.height - .5) * 4 + 'px');
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--scene-x');
    card.style.removeProperty('--scene-y');
  });
  return card;
}

const saveKey = 'billiard-game-v1';
const solo: Extract<Mode, { kind: 'training' }> = { kind: 'training', opponent: 'solo', difficulty: 'Medium' };
export let launch: { mode: Mode; state?: SavedGame; awaitingOnline?: boolean } = { mode: solo };

export function saveSession(mode: Mode, state: SavedGame, awaitingOnline = false) {
  try { localStorage.setItem(saveKey, JSON.stringify({ mode, state, awaitingOnline })); } catch {}
}
export function clearSession() {
  try { localStorage.removeItem(saveKey); } catch {}
}

function savedSession(): typeof launch | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey) ?? 'null');
    if (validGame(saved)) {
      return { mode: saved.onlineMode ? { kind: 'casual' } : { ...solo, opponent: saved.versusComputer ? 'computer' : 'solo' }, state: saved };
    }
    if (!saved || !validGame(saved.state)) return;
    const mode = saved.mode;
    if (mode?.kind === 'casual') return { mode, state: saved.state };
    if (mode?.kind === 'training' && ['solo', 'computer'].includes(mode.opponent) && difficulties.includes(mode.difficulty)) {
      return { mode, state: saved.state };
    }
    const city = cities.find(entry => entry.id === mode?.city?.id);
    if (mode?.kind === 'online' && city) return { mode: { kind: 'online', city }, state: saved.state, awaitingOnline: saved.awaitingOnline === true };
    if (mode?.kind === 'computer' && city && typeof mode.matchId === 'string' && cityStatus(city, computerProgress()) !== 'Locked') {
      return { mode: { kind: 'computer', city, matchId: mode.matchId }, state: saved.state };
    }
  } catch {}
}

export function labelGame(mode: Mode) {
  const name = 'city' in mode ? mode.city.name : mode.kind === 'training' ? 'Training' : 'Invite play';
  document.querySelector<HTMLElement>('#gameCity')!.textContent = name;
  document.querySelector<HTMLElement>('#gameMenuTitle')!.textContent = name + ' · Game menu';
  document.title = name + ' · Billiard';
}

export async function chooseGame() {
  const picker = document.querySelector<HTMLElement>('#cityPicker')!;
  const modes = document.querySelector<HTMLElement>('#homeModes')!;
  const setup = document.querySelector<HTMLElement>('#modeSetup')!;
  const title = document.querySelector<HTMLElement>('#setupTitle')!;
  const status = document.querySelector<HTMLElement>('#setupStatus')!;
  const list = document.querySelector<HTMLElement>('#cityList')!;
  const back = document.querySelector<HTMLButtonElement>('#modeBack')!;
  const resume = document.querySelector<HTMLButtonElement>('#resumeMatch')!;
  const url = new URL(location.href);
  const saved = savedSession();
  if (url.searchParams.get('table') === '3d' && saved) launch = saved;
  else if (/^[a-f0-9]{12}$/i.test(url.searchParams.get('join') ?? '')) launch = { mode: { kind: 'casual' } };
  else launch = await new Promise<typeof launch>(resolve => {
    let request: AbortController | undefined;
    let previousButton: HTMLButtonElement | undefined;
    let view: Circuit | 'training' | 'difficulty' | undefined;
    const start = (mode: Mode) => resolve({ mode });

    resume.hidden = !saved;
    if (saved) resume.onclick = () => resolve(saved);
    document.querySelector<HTMLButtonElement>('#casualOnline')!.onclick = () => start({ kind: 'casual' });

    back.onclick = () => {
      request?.abort();
      if (view === 'difficulty') {
        showTraining().focus();
        return;
      }
      view = undefined;
      modes.hidden = false;
      setup.hidden = true;
      previousButton?.focus();
    };

    function showTraining() {
      view = 'training';
      back.textContent = '← Game modes';
      title.textContent = 'Training';
      list.dataset.layout = 'training';
      const computer = selectionCard({
        title: 'Against Computer', subtitle: 'Practice match', detail: 'Play eight-ball at any difficulty.',
        artwork: tableArt(5), action: 'Choose difficulty',
        play: () => {
          view = 'difficulty';
          back.textContent = '← Training';
          title.textContent = 'Choose your opponent';
          list.dataset.layout = 'difficulty';
          list.replaceChildren(...difficulties.map((difficulty, index) => selectionCard({
            title: difficulty, subtitle: 'Level ' + (index + 1), detail: trainingNotes[index],
            artwork: tableArt(index + 1), action: 'Play',
            play: () => start({ kind: 'training', opponent: 'computer', difficulty }),
          })));
          back.focus();
        },
      });
      list.replaceChildren(selectionCard({
        title: 'Solo Training', subtitle: 'Open table', detail: 'Control both sides and practice your shots.',
        artwork: tableArt(1), action: 'Play', play: () => start(solo),
      }), computer);
      return computer;
    }

    async function showSetup(mode: Circuit | 'training') {
      request?.abort();
      view = mode;
      modes.hidden = true;
      setup.hidden = false;
      list.replaceChildren();
      list.dataset.layout = 'cities';
      back.textContent = '← Game modes';
      title.textContent = mode === 'online' ? 'Online city circuit' : mode === 'computer' ? 'Computer city circuit' : 'Training';
      status.textContent = '';
      back.focus();
      if (mode === 'training') {
        showTraining();
        return;
      }
      let progress = computerProgress();
      if (mode === 'online') {
        const pending = request = new AbortController();
        status.textContent = 'Loading online progress…';
        try {
          const response = await fetch('/circuit-progress', {
            method: 'POST', headers: { 'X-Player-Secret': getPlayerSecret() }, signal: pending.signal,
          });
          if (!response.ok) throw new Error('Progress unavailable');
          progress = await response.json();
          if (pending.signal.aborted) return;
        } catch {
          if (pending.signal.aborted) return;
          status.textContent = 'Could not load online progress.';
          const retry = document.createElement('button');
          retry.className = 'home-action';
          retry.textContent = 'Try again';
          retry.onclick = () => { void showSetup(mode); };
          list.append(retry);
          return;
        }
      }
      status.textContent = cities.filter(city => cityStatus(city, progress) === 'Completed').length + ' of ' + cities.length + ' cities completed. Win a match to complete a city.';
      for (const city of cities) {
        const availability = cityStatus(city, progress);
        const prerequisite = cities.find(entry => entry.id === city.requires);
        const stats = progress[city.id];
        const locked = availability === 'Locked';
        list.append(selectionCard({
          title: city.name,
          subtitle: city.country + ' · Level ' + city.level + ' · ' + cityDifficulty(city),
          detail: locked ? 'Win in ' + prerequisite?.name + ' to unlock' : (stats?.wins ?? 0) + ' wins · ' + (stats?.losses ?? 0) + ' losses',
          artwork: cityArt[city.id],
          status: availability,
          action: locked ? undefined : availability === 'Completed' ? 'Replay' : mode === 'online' ? 'Join tournament' : 'Play tournament',
          play: locked ? undefined : () => {
            if (mode === 'online') start({ kind: mode, city });
            else if (cityStatus(city, computerProgress()) !== 'Locked') {
              const matchId = Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-');
              start({ kind: mode, city, matchId });
            }
          },
        }));
      }
    }

    const buttons = [...modes.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
    for (const button of buttons) button.onclick = () => {
      previousButton = button;
      void showSetup(button.dataset.mode as Circuit | 'training');
    };
    const circuit = url.searchParams.get('circuit');
    if (circuit === 'computer' || circuit === 'online') {
      previousButton = buttons.find(button => button.dataset.mode === circuit);
      void showSetup(circuit);
    } else buttons[0].focus();

    picker.onkeydown = event => {
      const key = remoteKey(event.key, event.keyCode);
      const active = document.activeElement;
      if (!key) return;
      if (key === 'back') {
        if (view) { event.preventDefault(); back.click(); }
        return;
      }
      const controls = [...(view ? setup : modes).querySelectorAll('button')].filter(control => control.getClientRects().length);
      event.preventDefault();
      if (key === 'ok') {
        if (!event.repeat && active instanceof HTMLButtonElement) active.click();
      } else {
        const step = key === 'left' || key === 'up' ? -1 : 1;
        const index = active instanceof HTMLButtonElement ? controls.indexOf(active) : -1;
        controls[(index + step + controls.length) % controls.length]?.focus();
      }
    };
  });
  picker.onkeydown = null;
  url.searchParams.delete('circuit');
  try { history.replaceState(null, '', url.href); } catch {}
  labelGame(launch.mode);
  picker.hidden = true;
}
