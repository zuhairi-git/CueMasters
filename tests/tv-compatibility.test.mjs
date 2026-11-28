import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { isTvBrowser, shouldAskAboutTv } = await loadSource('tv-detection');
const { TvTable, tvViewport } = await loadSource('tv-table');
const { rack, width, length } = await loadSource('physics');
const { careerTable, challengeTable } = await loadSource('table-finishes');

test('TV detection recognizes TV platforms while leaving computers and phones alone', () => {
  for (const ua of [
    'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 SamsungBrowser/4.0 TV Safari/537.36',
    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/87.0.4280.88 Safari/537.36 WebAppManager',
    'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 Chrome/88.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/80.5.3 Safari/537.36',
    'Opera/9.80 (Linux armv7l; HbbTV/1.2.1) Presto/2.12.362 Version/12.11',
  ]) assert.equal(isTvBrowser(ua), true, ua);
  for (const ua of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
  ]) assert.equal(isTvBrowser(ua), false, ua);
});

test('the TV prompt respects both saved answers and never assumes desktop is a TV', () => {
  assert.equal(shouldAskAboutTv('SmartTV', null), true);
  assert.equal(shouldAskAboutTv('SmartTV', 'on'), false);
  assert.equal(shouldAskAboutTv('SmartTV', 'off'), false);
  assert.equal(shouldAskAboutTv('Windows Chrome', null), false);
});

test('TV table fits between HUD surfaces in landscape and portrait', () => {
  for (const [w, h, top, bottom] of [[1920, 1080, 180, 950], [3840, 2160, 200, 1960], [720, 1280, 210, 1120]]) {
    const view = tvViewport(w, h, top, bottom);
    const tableW = (view.landscape ? length : width) + 0.30;
    const tableH = (view.landscape ? width : length) + 0.30;
    assert.ok(view.cx - tableW * view.scale / 2 >= 0);
    assert.ok(view.cx + tableW * view.scale / 2 <= w);
    assert.ok(view.cy - tableH * view.scale / 2 >= top);
    assert.ok(view.cy + tableH * view.scale / 2 <= bottom);
  }
});
test('TV renderer uses only Canvas 2D, caps its buffer, and preserves game state', () => {
  const requests = [];
  const context = new Proxy({}, {
    get: (_target, key) => key === 'fillStyle' ? '#ffffff' : (...args) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), String(key));
    },
    set: (_target, key, value) => { if (key === 'fillStyle' || key === 'strokeStyle') assert.equal(typeof value, 'string'); return true; },
  });
  const canvas = { width: 0, height: 0, getContext: type => { requests.push(type); return context; } };
  const renderer = new TvTable(canvas);
  renderer.resize(3840, 2160, 200, 1960);
  assert.ok(canvas.width <= 1920 && canvas.height <= 1080);
  for (const snooker of [false, true]) {
    const balls = rack(snooker);
    const before = structuredClone(balls);
    for (const rolling of [false, true]) for (const tableStyle of ['Club Green', 'Tournament Blue', 'Burgundy Lounge']) {
      renderer.draw({ balls, aim: { x: 0, z: 1 }, rolling, finished: false, placement: !rolling, guides: true, callEligible: true, calledPocket: 2, snooker, tableStyle, cueStyle: 'Classic Maple', pull: 0.5 });
    }
    // Venue tables draw the same banded rails, cushions and pocket plates in their own colours.
    for (const venue of [careerTable('helsinki', 3, snooker), careerTable('london', 9, snooker), challengeTable('Master', true, snooker)]) {
      renderer.draw({ balls, aim: { x: 0, z: 1 }, rolling: false, finished: false, placement: false, guides: true, callEligible: false, snooker, tableStyle: 'Club Green', venue, cueStyle: 'Classic Maple', pull: 0 });
    }
    assert.deepEqual(balls, before);
  }
  assert.deepEqual(requests, ['2d']);
});

test('compatibility table pointer coordinates match balls and pockets at every orientation', () => {
  const renderer = new TvTable({ getContext: () => ({}) });
  for (const [w, h] of [[1920, 1080], [3840, 2160], [720, 1280]]) {
    renderer.resize(w, h, 160, h - 140);
    for (const [x, z] of [[0, -0.65], [0.2, 0.4]]) {
      const screen = renderer.project(x, z);
      const hit = renderer.pick(screen.x, screen.y);
      assert.ok(Math.abs(hit.x - x) < 1e-10);
      assert.ok(Math.abs(hit.z - z) < 1e-10);
    }
    const pocket = renderer.project(width / 2 + 0.016, length / 2 + 0.016);
    assert.equal(renderer.pick(pocket.x, pocket.y), undefined);
    assert.ok(renderer.pick(pocket.x, pocket.y, true));
    assert.equal(renderer.pick(-100, -100, true), undefined);
  }
});
