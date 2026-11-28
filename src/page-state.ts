import { isGame, type Game } from './circuit';

const views = ['home', 'training', 'difficulty', 'challenges', 'online', 'computer', 'stages', 'shop', 'match'] as const;
export type PageView = typeof views[number];
export type Page = {
  game: Game;
  view: PageView;
  city?: string;
  panel?: 'app-settings' | 'background-settings' | 'game-settings';
};

const key = 'cue-master-page';

function validPage(value: unknown): value is Page {
  if (!value || typeof value !== 'object') return false;
  const { game, view, city, panel } = value as Page;
  return isGame(game) && views.includes(view)
    && (view !== 'challenges' || game !== 'nineball')
    && (view !== 'online' || game === 'pool')
    && (view !== 'stages' || typeof city === 'string')
    && (city === undefined || typeof city === 'string' && (view === 'stages' || view === 'shop'))
    && (panel === undefined || (view === 'match'
      ? panel === 'game-settings' : panel === 'app-settings' || panel === 'background-settings'));
}

export function pageInHistory(): Page | undefined {
  const page: unknown = history.state?.cueMasterPage;
  if (validPage(page)) return page;
}

export function savedPage(): Page | undefined {
  const current = pageInHistory();
  if (current) return current;
  try {
    const page: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (validPage(page)) return page;
  } catch {}
}

export function savePage(page: Page, url?: URL) {
  try { localStorage.setItem(key, JSON.stringify(page)); } catch {}
  try { history.replaceState({ ...history.state, cueMasterPage: page }, '', url?.href); } catch {}
}

export function savePagePanel(panel: Page['panel']) {
  const page = savedPage();
  if (page) savePage({ ...page, panel });
}

export function linkedPage(url: URL, preferredGame: Game): Page | undefined {
  const params = url.searchParams;
  const requestedGame = params.get('game');
  const game = isGame(requestedGame) ? requestedGame : preferredGame;
  if (params.get('table') === '3d') return { game, view: 'match' };
  const circuit = params.get('circuit');
  if (circuit === 'computer') {
    const city = params.get('careerCity') ?? undefined;
    if (params.get('careerShop') === '1') return { game, view: 'shop', city };
    if (city) return { game, view: 'stages', city };
    return { game, view: 'computer' };
  }
  if (circuit === 'challenges' && game !== 'nineball' || circuit === 'online' && game === 'pool') return { game, view: circuit };
  if (requestedGame || circuit) return { game, view: 'home' };
}
