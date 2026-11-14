import { cities, cityDifficulty, cityStatus, fetchOnlineProgress, getPlayerSecret, onlineMedalName, type Circuit, type Game, type Mode, type Progress } from './circuit';
import { difficulties } from './difficulty';
import { validGame, type SavedGame } from './saved-game';
import { remoteKey } from './tv-controls';
import { t } from './i18n';
import { careerBonus, careerCityStatus, careerClears, careerCues, careerDifficulty, careerGoal, careerProgress, careerRank, careerReward, careerStage, careerStages, careerStageStatus, equipCareerCue } from './career';
import { challengeCompleted, challenges, getChallenge } from './challenges';
import { cityFinishes } from './table-finishes';
import helsinki from './helsinki-harbor.svg?raw';
import stockholm from './stockholm-skyline.svg?raw';
import copenhagen from './copenhagen-skyline.svg?raw';
import berlin from './berlin-skyline.svg?raw';
import london from './london-skyline.svg?raw';

const cityArt: Record<string, string> = { helsinki, stockholm, copenhagen, berlin, london };
const trainingNotes = ['Face a computer that attempts simple pots', 'Practice straightforward pots', 'Play a balanced opponent', 'Face planned shots', 'Face precise shots with position play'];

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
    ${options.status ? `<span class="city-status">${t(options.status)}</span>` : ''}
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

const legacySaveKey = 'billiard-game-v1';
const preferenceKey = 'cue-master-game';
const sessionKey = (game: Game) => 'cue-master-session-' + game;
const solo: Extract<Mode, { kind: 'training' }> = { kind: 'training', game: 'pool', opponent: 'solo', difficulty: 'Medium' };
export let launch: { mode: Mode; state?: SavedGame; awaitingOnline?: boolean } = { mode: solo };

export function preferredGame(): Game {
  try { return localStorage.getItem(preferenceKey) === 'snooker' ? 'snooker' : 'pool'; }
  catch { return 'pool'; }
}

export function saveSession(mode: Mode, state: SavedGame, awaitingOnline = false) {
  try {
    localStorage.setItem(sessionKey(state.snooker ? 'snooker' : 'pool'), JSON.stringify({ mode, state, awaitingOnline }));
  } catch {}
}

export function clearSession(game: Game) {
  try {
    localStorage.removeItem(sessionKey(game));
    const legacy = JSON.parse(localStorage.getItem(legacySaveKey) ?? 'null');
    if (legacy && Boolean((legacy.state ?? legacy).snooker) === (game === 'snooker')) localStorage.removeItem(legacySaveKey);
  } catch {}
}

function savedSession(game: Game): typeof launch | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey(game)) ?? localStorage.getItem(legacySaveKey) ?? 'null');
    if (validGame(saved) && saved.snooker === (game === 'snooker')) {
      return { mode: saved.onlineMode ? { kind: 'casual' } : { ...solo, game, opponent: saved.versusComputer ? 'computer' : 'solo' }, state: saved };
    }
    if (!saved || !validGame(saved.state) || saved.state.snooker !== (game === 'snooker')) return;
    const mode = saved.mode;
    if (game === 'pool' && mode?.kind === 'casual') return { mode, state: saved.state };
    if (mode?.kind === 'training' && ['solo', 'computer'].includes(mode.opponent) && difficulties.includes(mode.difficulty)) {
      return { mode: { ...mode, game }, state: saved.state };
    }
    if (mode?.kind === 'challenge' && getChallenge(game, mode.challenge)) {
      return { mode: { kind: 'challenge', game, challenge: mode.challenge }, state: saved.state };
    }
    const city = cities.find(entry => entry.id === mode?.city?.id);
    if (game === 'pool' && mode?.kind === 'online' && city) return { mode: { kind: 'online', city }, state: saved.state, awaitingOnline: saved.awaitingOnline === true };
    if (mode?.kind === 'computer' && city && typeof mode.matchId === 'string') {
      const stage = mode.stage ?? 0;
      const fullMatch = mode.game === game || (game === 'pool' && mode.game === undefined && (stage === 0 || stage === 7));
      if (fullMatch && Number.isInteger(stage) && careerStageStatus(city, stage, careerProgress(game), game) !== 'Locked' && (mode.stage !== undefined || !saved.state.finished)) {
        return { mode: { kind: 'computer', game, city, stage, matchId: mode.matchId }, state: saved.state };
      }
    }
  } catch {}
}

export function labelGame(mode: Mode) {
  const city = t('city' in mode ? mode.city.name : mode.kind === 'training' ? 'Training' : 'Invite play');
  const name = mode.kind === 'computer' ? city + ' · ' + t(careerStage(mode.city, mode.stage, mode.game).title)
    : mode.kind === 'challenge' ? t(getChallenge(mode.game, mode.challenge)!.title) : city;
  document.querySelector<HTMLElement>('#gameCity')!.textContent = name;
  document.querySelector<HTMLElement>('#gameMenuTitle')!.textContent = name + ' · ' + t('Game menu');
  document.title = name + ' · Cue Master';
}

export async function chooseGame() {
  const picker = document.querySelector<HTMLElement>('#cityPicker')!;
  const modes = document.querySelector<HTMLElement>('#homeModes')!;
  const settingsAvatar = document.querySelector<HTMLButtonElement>('#openAppSettings')!;
  const setup = document.querySelector<HTMLElement>('#modeSetup')!;
  const title = document.querySelector<HTMLElement>('#setupTitle')!;
  const status = document.querySelector<HTMLElement>('#setupStatus')!;
  const list = document.querySelector<HTMLElement>('#cityList')!;
  const back = document.querySelector<HTMLButtonElement>('#modeBack')!;
  const shop = document.querySelector<HTMLButtonElement>('#careerShop')!;
  const resume = document.querySelector<HTMLButtonElement>('#resumeMatch')!;
  const url = new URL(location.href);
  const requestedGame = url.searchParams.get('game');
  let game = requestedGame === 'snooker' || requestedGame === 'pool' ? requestedGame : preferredGame();
  const saved = savedSession(game);
  if (url.searchParams.get('table') === '3d' && saved) launch = saved;
  else if (/^[a-f0-9]{12}$/i.test(url.searchParams.get('join') ?? '')) launch = { mode: { kind: 'casual' } };
  else launch = await new Promise<typeof launch>(resolve => {
    let request: AbortController | undefined;
    let previousButton: HTMLButtonElement | undefined;
    type Setup = Circuit | 'training' | 'challenges';
    let view: Setup | 'difficulty' | 'stages' | 'shop' | undefined;
    let selectedCity: typeof cities[number] | undefined;
    const start = (mode: Mode) => resolve({ mode });
    const gameName = () => t(game === 'snooker' ? 'Snooker' : 'Billiard');

    const gameButtons = [...modes.querySelectorAll<HTMLButtonElement>('button[data-game]')];
    const updateGame = () => {
      for (const button of gameButtons) button.setAttribute('aria-pressed', String(button.dataset.game === game));
      document.querySelector<HTMLElement>('#onlineModeCard')!.hidden = game === 'snooker';
      document.querySelector<HTMLElement>('#casualOnline')!.hidden = game === 'snooker';
      const session = savedSession(game);
      resume.hidden = !session;
      resume.onclick = session ? () => resolve(session) : null;
    };
    for (const button of gameButtons) button.onclick = () => {
      game = button.dataset.game === 'snooker' ? 'snooker' : 'pool';
      try { localStorage.setItem(preferenceKey, game); } catch {}
      updateGame();
    };
    updateGame();
    document.querySelector<HTMLButtonElement>('#casualOnline')!.onclick = () => start({ kind: 'casual' });

    back.onclick = () => {
      request?.abort();
      if (view === 'shop' && selectedCity) { showStages(selectedCity); return; }
      if (view === 'stages' || view === 'shop') { void showSetup('computer'); return; }
      if (view === 'difficulty') {
        showTraining().focus();
        return;
      }
      view = undefined;
      modes.hidden = false;
      setup.hidden = true;
      previousButton?.focus();
    };

    function wallet() {
      const { coins, points } = careerProgress(game);
      return t(careerRank(points)) + ' · ' + t('{coins} coins · {points} career points', { coins, points });
    }

    function showStages(city: typeof cities[number]) {
      selectedCity = city;
      view = 'stages';
      shop.hidden = false;
      back.textContent = t('← Cities');
      title.textContent = t(city.name) + ' · ' + gameName();
      status.textContent = t('{cleared}/{total} games cleared', { cleared: careerClears(city, careerProgress(game)), total: careerStages.length }) + ' · ' + wallet();
      const progress = careerProgress(game);
      list.dataset.layout = 'stages';
      list.replaceChildren(...careerStages.map((_, index) => {
        const stage = careerStage(city, index, game);
        const availability = careerStageStatus(city, index, progress, game);
        const locked = availability === 'Locked';
        const bonus = progress.bonuses[city.id]?.[index] ? t('Skill goal completed')
          : t('{goal} for +{coins} coins and +{points} points', { goal: t(careerGoal), ...careerBonus });
        return selectionCard({
          title: t(stage.title), subtitle: t('Game {number}', { number: index + 1 }) + ' · ' + t(careerDifficulty(city, index)),
          detail: [t(stage.objective), availability !== 'Completed' ? t('{coins} coins · {points} career points', careerReward(index)) : '', bonus].filter(Boolean).join(' · '),
          status: availability, artwork: tableArt(index % 5 + 1),
          action: locked ? undefined : t(availability === 'Completed' ? 'Replay' : 'Play'),
          play: locked ? undefined : () => start({ kind: 'computer', game, city, stage: index, matchId: crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-') }),
        });
      }));
      back.focus();
    }

    function showShop(focusIndex = -1) {
      view = 'shop';
      shop.hidden = true;
      back.textContent = selectedCity ? t('← Games') : t('← Cities');
      title.textContent = t('Equipment shop');
      status.textContent = wallet();
      list.dataset.layout = 'training';
      const progress = careerProgress(game);
      list.replaceChildren(...careerCues.map((cue, index) => {
        const equipped = progress.equipped === cue.id;
        const owned = progress.owned.includes(cue.id);
        const affordable = progress.coins >= cue.price;
        return selectionCard({
          title: t(cue.id), subtitle: owned ? t(equipped ? 'Equipped' : 'Owned') : t('{coins} coins', { coins: cue.price }),
          detail: t(cue.description), artwork: tableArt(index + 1),
          action: equipped ? undefined : t(owned ? 'Equip' : affordable ? 'Buy and equip' : 'More coins needed'),
          play: equipped || !affordable && !owned ? undefined : () => {
            if (equipCareerCue(cue.id, game)) showShop(index);
            else status.textContent = t('Could not save equipment. Try again.');
          },
        });
      }));
      const focus = list.children[focusIndex] as HTMLElement | undefined;
      if (focus) { focus.tabIndex = 0; focus.focus(); } else back.focus();
    }
    shop.onclick = () => showShop();

    function showTraining() {
      view = 'training';
      back.textContent = t('← Game modes');
      title.textContent = t('Training') + ' · ' + gameName();
      list.dataset.layout = 'training';
      const computer = selectionCard({
        title: t('Against Computer'), subtitle: t('Practice match'), detail: t(game === 'snooker' ? 'Play snooker at any difficulty.' : 'Play eight-ball at any difficulty.'),
        artwork: tableArt(5), action: t('Choose difficulty'),
        play: () => {
          view = 'difficulty';
          back.textContent = t('← Training');
          title.textContent = t('Choose your opponent');
          list.dataset.layout = 'difficulty';
          list.replaceChildren(...difficulties.map((difficulty, index) => selectionCard({
            title: t(difficulty), subtitle: t('Level {level}', { level: index + 1 }), detail: t(trainingNotes[index]),
            artwork: tableArt(index + 1), action: t('Play'),
            play: () => start({ kind: 'training', game, opponent: 'computer', difficulty }),
          })));
          back.focus();
        },
      });
      list.replaceChildren(selectionCard({
        title: t('Solo Training'), subtitle: t('Open table'), detail: t('Control both sides and practice your shots.'),
        artwork: tableArt(1), action: t('Play'), play: () => start({ ...solo, game }),
      }), computer);
      return computer;
    }

    async function showSetup(mode: Setup) {
      request?.abort();
      view = mode;
      selectedCity = undefined;
      shop.hidden = mode !== 'computer';
      modes.hidden = true;
      setup.hidden = false;
      list.replaceChildren();
      list.dataset.layout = 'cities';
      back.textContent = t('← Game modes');
      title.textContent = t(mode === 'online' ? 'Online city circuit' : mode === 'computer' ? 'Computer Career' : mode === 'challenges' ? 'Challenges' : 'Training');
      if (mode !== 'online') title.textContent += ' · ' + gameName();
      status.textContent = '';
      back.focus();
      if (mode === 'training') {
        showTraining();
        return;
      }
      if (mode === 'challenges') {
        list.replaceChildren(...challenges.filter(challenge => challenge.game === game).map((challenge, index) => {
          const completed = challengeCompleted(challenge);
          return selectionCard({
            title: t(challenge.title), subtitle: gameName(),
            detail: t(challenge.objective), artwork: tableArt(index + 1),
            status: completed ? 'Completed' : undefined, action: t(completed ? 'Replay' : 'Play'),
            play: () => start({ kind: 'challenge', game, challenge: challenge.id }),
          });
        }));
        return;
      }
      if (mode === 'computer') {
        const progress = careerProgress(game);
        status.textContent = wallet();
        for (const city of cities) {
          const availability = careerCityStatus(city, progress, game);
          const prerequisite = cities.find(entry => entry.id === city.requires);
          const locked = availability === 'Locked';
          list.append(selectionCard({
            title: t(city.name), subtitle: t(city.country),
            detail: locked && prerequisite ? t('Clear all games in {city} to unlock', { city: t(prerequisite.name) })
              : t('{cleared}/{total} games cleared', { cleared: careerClears(city, progress), total: careerStages.length })
                + (availability === 'Completed' ? ' · ' + t('Table finish unlocked: {finish}.', { finish: t(cityFinishes[city.id].name) }) : ''),
            status: availability, artwork: cityArt[city.id],
            action: locked ? undefined : t('View games'),
            play: locked ? undefined : () => showStages(city),
          }));
        }
        return;
      }
      let progress: Progress = {};
      if (mode === 'online') {
        const pending = request = new AbortController();
        status.textContent = t('Loading online progress…');
        try {
          progress = await fetchOnlineProgress(getPlayerSecret(), pending.signal);
          if (pending.signal.aborted) return;
        } catch {
          if (pending.signal.aborted) return;
          status.textContent = t('Could not load online progress.');
          const retry = document.createElement('button');
          retry.className = 'home-action';
          retry.textContent = t('Try again');
          retry.onclick = () => { void showSetup(mode); };
          list.append(retry);
          return;
        }
      }
      status.textContent = t('{completed} of {total} cities completed. Win a match to complete a city.', {
        completed: cities.filter(city => cityStatus(city, progress) === 'Completed').length, total: cities.length,
      });
      for (const city of cities) {
        const availability = cityStatus(city, progress);
        const prerequisite = cities.find(entry => entry.id === city.requires);
        const stats = progress[city.id];
        const locked = availability === 'Locked';
        list.append(selectionCard({
          title: t(city.name),
          subtitle: [t(city.country), t('Level {level}', { level: city.level }), t(cityDifficulty(city))].join(' · '),
          detail: locked && prerequisite ? t('Win in {city} to unlock', { city: t(prerequisite.name) })
            : t('{wins} wins · {losses} losses', { wins: stats?.wins ?? 0, losses: stats?.losses ?? 0 }) + ' · '
              + (availability === 'Completed' ? onlineMedalName(city) : t('First win earns a city medal')),
          artwork: cityArt[city.id],
          status: availability,
          action: locked ? undefined : t(availability === 'Completed' ? 'Replay' : 'Join tournament'),
          play: locked ? undefined : () => start({ kind: mode, city }),
        }));
      }
    }

    const buttons = [...modes.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
    for (const button of buttons) button.onclick = () => {
      previousButton = button;
      void showSetup(button.dataset.mode as Setup);
    };
    const circuit = url.searchParams.get('circuit');
    if (circuit === 'computer' || circuit === 'challenges' || circuit === 'online' && game === 'pool') {
      previousButton = buttons.find(button => button.dataset.mode === circuit);
      void showSetup(circuit);
      const city = cities.find(entry => entry.id === url.searchParams.get('careerCity'));
      if (circuit === 'computer' && city && careerCityStatus(city, careerProgress(game), game) !== 'Locked') showStages(city);
      if (circuit === 'computer' && url.searchParams.get('careerShop') === '1') showShop();
    } else gameButtons[0].focus();

    picker.onkeydown = event => {
      const key = remoteKey(event.key, event.keyCode);
      const active = document.activeElement;
      if (!key) return;
      if (key === 'back') {
        if (view) { event.preventDefault(); back.click(); }
        return;
      }
      const controls = [settingsAvatar, ...(view ? setup : modes).querySelectorAll('button')]
        .filter(control => control.getClientRects().length);
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
  url.searchParams.delete('game');
  url.searchParams.delete('careerCity');
  url.searchParams.delete('careerShop');
  try { history.replaceState(null, '', url.href); } catch {}
  labelGame(launch.mode);
  picker.hidden = true;
}
