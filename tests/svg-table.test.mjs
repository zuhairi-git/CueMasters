import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './load-source.mjs';
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
