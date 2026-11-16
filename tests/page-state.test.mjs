import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const { linkedPage, savedPage, savePage, savePagePanel } = await loadSource('page-state');

function resetStorage() {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.history = {
    state: null,
    replaceState(state) { this.state = state; },
  };
}

test('each page and its game or city survive in local storage', () => {
  resetStorage();
  for (const page of [
    { game: 'snooker', view: 'home' },
    { game: 'pool', view: 'training' },
    { game: 'snooker', view: 'difficulty' },
    { game: 'pool', view: 'challenges' },
    { game: 'pool', view: 'online' },
    { game: 'snooker', view: 'computer' },
    { game: 'snooker', view: 'stages', city: 'helsinki' },
    { game: 'pool', view: 'shop', city: 'stockholm' },
    { game: 'snooker', view: 'match', panel: 'game-settings' },
  ]) {
    savePage(page);
    history.state = null;
    assert.deepEqual(savedPage(), page);
  }
});

test('a refresh keeps its own page when a different tab writes to local storage', () => {
  resetStorage();
  savePage({ game: 'snooker', view: 'difficulty' });
  savePagePanel('background-settings');
  const tab = history.state;
  globalThis.history = { ...history, state: null };
  savePage({ game: 'pool', view: 'match' });
  history.state = tab;
  assert.deepEqual(savedPage(), { game: 'snooker', view: 'difficulty', panel: 'background-settings' });
  savePagePanel(undefined);
  assert.equal(savedPage().panel, undefined);
});

test('explicit home and career destinations override the saved page and invalid storage is ignored', () => {
  resetStorage();
  localStorage.setItem('cue-master-page', '{"game":"snooker","view":"online"}');
  assert.equal(savedPage(), undefined);
  localStorage.setItem('cue-master-page', '{');
  assert.equal(savedPage(), undefined);
  savePage({ game: 'pool', view: 'match' });
  const destination = query => linkedPage(new URL(query, 'https://example.test/'), 'pool') ?? savedPage();
  assert.deepEqual(destination('?game=snooker'), { game: 'snooker', view: 'home' });
  assert.deepEqual(destination('?game=snooker&circuit=computer&careerCity=helsinki&careerShop=1'),
    { game: 'snooker', view: 'shop', city: 'helsinki' });
  assert.deepEqual(destination('?circuit=challenges'), { game: 'pool', view: 'challenges' });
  assert.deepEqual(destination('?game=snooker&table=3d'), { game: 'snooker', view: 'match' });
});
