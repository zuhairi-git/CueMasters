import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './load-source.mjs';
const { careerTable, challengeTable, championshipInlays, railSights } = await loadSource('table-finishes');
const { SvgTable, svgViewport } = await loadSource('svg-table');
const { width, length, pockets } = await loadSource('physics');

test('all six pocket rims and openings render above the overhead table materials', () => {
  const table = { innerHTML: '' };
  const renderer = Object.assign(Object.create(SvgTable.prototype), { table });
  renderer.artwork({ snooker: false, tableStyle: 'Club Green', balls: [] });
  const layer = table.innerHTML.match(/<g class="sv-pockets">(.*)<\/g>$/)?.[1];
  assert.ok(layer);
  assert.equal([...layer.matchAll(/stroke="#b7a27e"/g)].length, pockets.length);
  assert.equal([...layer.matchAll(/fill="url\(#sv-pocket\)"/g)].length, pockets.length);
  assert.ok(table.innerHTML.lastIndexOf('<path') < table.innerHTML.indexOf('<g class="sv-pockets">'));
});

test('the London championship renders the gold inlay in both games', () => {
  const table = { innerHTML: '' };
  const renderer = Object.assign(Object.create(SvgTable.prototype), { table });
  for (const snooker of [false, true]) {
    const state = { snooker, tableStyle: 'Club Green', balls: [] };
    renderer.artwork({ ...state, venue: careerTable('london', 9, snooker) });
    assert.equal([...table.innerHTML.matchAll(/transform="rotate\(45 /g)].length,
      championshipInlays.filter(piece => piece.diamond).length);
    assert.equal([...table.innerHTML.matchAll(/stroke="#f3ca75" stroke-width="5"/g)].length, pockets.length);
    renderer.artwork({ ...state, venue: careerTable('london', 8, snooker) });
    assert.doesNotMatch(table.innerHTML, /#f3ca75/);
  }
});

test('every city and challenge tier has its own table design', () => {
  const cities = ['helsinki', 'stockholm', 'copenhagen', 'berlin', 'london'];
  assert.equal(new Set(cities.map(city => careerTable(city, 0, false).motif)).size, cities.length);
  assert.equal(new Set(cities.map(city => careerTable(city, 0, false).trim)).size, cities.length);
  for (const city of cities) {
    const { motif } = careerTable(city, 0, false);
    for (let stage = 1; stage < 10; stage++) assert.equal(careerTable(city, stage, false).motif, motif);
  }
  for (const snooker of [false, true]) {
    const tables = ['Rookie', 'Pro', 'Master'].flatMap(tier => [false, true].map(timed => challengeTable(tier, timed, snooker)));
    assert.equal(new Set(tables.map(table => table.id)).size, tables.length);
    assert.equal(new Set(tables.map(table => table.colors[0])).size, tables.length);
    assert.ok(tables.every(table => /^#[0-9a-f]{6}$/.test(table.colors.join('').slice(0, 7)) && !table.championship));
  }
});

test('rail sights stay on the rails and render for every motif', () => {
  const table = { innerHTML: '' };
  const renderer = Object.assign(Object.create(SvgTable.prototype), { table });
  const state = { snooker: false, tableStyle: 'Club Green', balls: [] };
  renderer.artwork(state);
  const plain = table.innerHTML;
  for (const city of ['helsinki', 'stockholm', 'copenhagen', 'berlin', 'london']) {
    const venue = careerTable(city, 0, false);
    for (const piece of railSights(venue.motif, width / 2 + .078, length / 2 + .078)) {
      const onSide = Math.abs(piece.x) - piece.width > width / 2 + .03 && Math.abs(piece.x) + piece.width < width / 2 + .122;
      const onEnd = Math.abs(piece.z) - piece.depth > length / 2 + .03 && Math.abs(piece.z) + piece.depth < length / 2 + .122;
      assert.ok(onSide || onEnd, city);
    }
    renderer.artwork({ ...state, venue });
    assert.notEqual(table.innerHTML, plain);
    assert.equal([...table.innerHTML.matchAll(new RegExp('stroke="' + venue.trim + '" stroke-width="2"', 'g'))].length, pockets.length);
    assert.doesNotMatch(table.innerHTML, /NaN|undefined/);
  }
});

test('SVG table framing fits the complete rails between the controls', () => {
  for (const [w,h,top,bottom] of [[390,844,80,760],[1440,900,100,810],[844,390,70,310]]) {
    const v = svgViewport(w,h,top,bottom);
    const wide = (v.landscape ? length : width) + .30;
    const tall = (v.landscape ? width : length) + .30;
    assert.ok(wide * v.scale <= w - 20 + 1e-8);
    assert.ok(tall * v.scale <= bottom - top + 1e-8);
  }
});
test('SVG picking matches projected ball and pocket positions after zooming and panning', () => {
  const element = { setAttribute() {} };
  const renderer = Object.assign(Object.create(SvgTable.prototype), {
    svg: element, root: element, panX: 0, panY: 0,
  });
  for (const [w,h] of [[390,844],[1440,900]]) for (const zoom of [.65,1,2.5]) {
    renderer.resize(w,h,90,h-90,zoom);
    const view = svgViewport(w,h,90,h-90,zoom);
    renderer.panBy(10000,-10000);
    const center = renderer.project(0,0);
    assert.equal(center.x, view.cx + view.maxPanX);
    assert.equal(center.y, view.cy - view.maxPanY);
    if (zoom <= 1) assert.deepEqual(center, { x: view.cx, y: view.cy });
    for (const p of [{x:0,z:0},{x:.22,z:-.74},...pockets]) {
      const screen = renderer.project(p.x,p.z);
      const hit = renderer.pick(screen.x,screen.y,true);
      assert.ok(hit);
      assert.ok(Math.abs(hit.x-p.x)<1e-10 && Math.abs(hit.z-p.z)<1e-10);
    }
    assert.equal(renderer.pick(-10000,-10000,true),undefined);
  }
  renderer.resize(1440,900,90,810);
  assert.deepEqual(renderer.project(0,0), { x: 720, y: 450 });
});
