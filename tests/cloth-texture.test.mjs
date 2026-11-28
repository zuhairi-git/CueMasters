import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { paintCloth } = await loadSource('cloth-texture');
const { configureTable, pockets } = await loadSource('physics');

test('the 3D cloth is lit, shaded and cut out for every pocket in both games', () => {
  for (const game of ['snooker', 'pool']) {
    configureTable(game);
    const holes = [];
    const gradients = [];
    let cutting = false;
    const finite = (name, args) => { for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), name); };
    const gradient = kind => (...args) => {
      finite(kind, args);
      const stops = [];
      gradients.push({ kind, stops });
      return { addColorStop: (offset, color) => { assert.ok(offset >= 0 && offset <= 1); assert.equal(typeof color, 'string'); stops.push(offset); } };
    };
    const context = new Proxy({}, {
      get: (_target, key) => key === 'createRadialGradient' ? gradient('radial') : key === 'createLinearGradient' ? gradient('linear')
        : (...args) => { finite(String(key), args); if (key === 'arc' && cutting) holes.push(args); },
      set: (_target, key, value) => { if (key === 'globalCompositeOperation') cutting = value === 'destination-out'; return true; },
    });
    paintCloth(context, 256, 512);
    // One lamp, a shadow under each of the four cushions and a drop at every pocket.
    assert.equal(gradients.filter(g => g.kind === 'linear').length, 4);
    assert.equal(gradients.filter(g => g.kind === 'radial').length, 1 + pockets.length);
    for (const { stops } of gradients) assert.deepEqual(stops, [...stops].sort((a, b) => a - b));
    assert.equal(holes.length, pockets.length);
    assert.equal(cutting, false);
  }
});
