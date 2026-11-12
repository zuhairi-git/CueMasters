import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';

const { installLanguagePicker, t } = await loadSource('i18n');

test('language selection translates labels, preserves English fallback, and survives reload', () => {
  const storage = new Map();
  const render = () => {
    const title = { data: 'Choose your game', parentElement: { closest: () => null } };
    const picker = { append(...buttons) { this.buttons = buttons; } };
    globalThis.NodeFilter = { SHOW_TEXT: 4 };
    globalThis.localStorage = {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    };
    globalThis.document = {
      documentElement: { lang: 'en' },
      querySelector: () => picker,
      querySelectorAll: () => [],
      createTreeWalker() {
        let visited = false;
        return {
          currentNode: title,
          nextNode() {
            if (visited) return false;
            visited = true;
            return true;
          },
        };
      },
      createElement: () => ({
        attributes: {},
        setAttribute(key, value) { this.attributes[key] = value; },
      }),
    };
    installLanguagePicker();
    return { title, buttons: picker.buttons };
  };

  const { title, buttons: [english, finnish] } = render();
  finnish.onclick();
  assert.equal(title.data, 'Valitse pelimuoto');
  assert.equal(document.documentElement.lang, 'fi');
  assert.equal(finnish.attributes['aria-pressed'], 'true');
  assert.equal(t('Level {level}', { level: 3 }), 'Taso 3');
  assert.equal(t('Untranslated {number}', { number: 4 }), 'Untranslated 4');
  english.onclick();
  assert.equal(title.data, 'Choose your game');
  finnish.onclick();
  assert.equal(render().title.data, 'Valitse pelimuoto');
});
