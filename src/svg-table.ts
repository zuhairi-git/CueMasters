import { cueArtwork } from './svg-cue';
import { championshipInlays, mix, railSights, shade, tableFinish } from './table-finishes';
import { ballArtwork } from './svg-ball';
import { ballMarkings } from './ball-markings';
import { traceShot } from './aim-guide';
import { cushions, width, length, radius, pockets, pocketMouthRadius, type BallOrientation } from './physics';
import { calledPocketBorderWidth, calledPocketColor, type TableState } from './tv-table';

const ns = 'http://www.w3.org/2000/svg';
const random = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
// A large, deterministic tile gives the cloth fine fibres without a dot grid.
function feltFibres() {
  const next = random(7319);
  let light = '', dark = '';
  for (let i = 0; i < 700; i++) {
    const x = (next() * 127).toFixed(2), y = (next() * 131).toFixed(2);
    const fibre = 'M' + x + ' ' + y + 'l.3 ' + (.5 + next() * 1.3).toFixed(2);
    if (i % 2) light += fibre; else dark += fibre;
  }
  return '<path d="'+light+'" stroke="#fff" stroke-opacity=".055" stroke-width=".65"/><path d="'+dark+'" stroke="#02131b" stroke-opacity=".07" stroke-width=".65"/>';
}
// Wood figure running along a rail. Every line closes on itself over the tile and
// stays clear of its long edges, so the grain repeats without a seam.
const grainAcross = 98, grainAlong = 512;
function woodGrain(vertical: boolean) {
  const next = random(9157);
  const layers = ['', '', ''];
  for (let i = 0; i < 26; i++) {
    const at = 8 + next() * (grainAcross - 16), sway = 1 + next() * 4.5, ripple = next() * 1.5;
    const phase = next() * 6.283, phase2 = next() * 6.283;
    let line = '';
    for (let step = 0; step <= 16; step++) {
      const across = (at + sway * Math.sin(phase + step * Math.PI / 8) + ripple * Math.sin(phase2 + step * Math.PI * 3 / 8)).toFixed(1);
      const along = step * grainAlong / 16;
      line += (step ? 'L' : 'M') + (vertical ? across + ' ' + along : along + ' ' + across);
    }
    layers[i % 3] += line;
  }
  const stroke = (d: string, color: string, opacity: number, thickness: number) =>
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-opacity="' + opacity + '" stroke-width="' + thickness + '" stroke-linejoin="round"/>';
  const size = vertical ? 'width="' + grainAcross + '" height="' + grainAlong + '"' : 'width="' + grainAlong + '" height="' + grainAcross + '"';
  return '<pattern id="sv-grain-' + (vertical ? 'v' : 'h') + '" ' + size + ' patternUnits="userSpaceOnUse">' +
    stroke(layers[0], '#000', .22, .9) + stroke(layers[1], '#000', .11, 2.8) + stroke(layers[2], '#fff', .05, 1.1) + '</pattern>';
}
type Stop = [offset: number, color: string, opacity?: number];
const stops = (list: Stop[]) => list.map(([offset, color, opacity]) =>
  '<stop offset="' + offset + '" stop-color="' + color + '"' + (opacity === undefined ? '' : ' stop-opacity="' + opacity + '"') + '/>').join('');
/** A gradient laid across one rail in table millimetres, so it never stretches along the rail's length. */
const across = (id: string, x1: number, y1: number, x2: number, y2: number, list: Stop[]) =>
  '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stops(list) + '</linearGradient>';
const tint = (color: string, share: number) => mix(color, '#ffffff', share);
// Frame, in table millimetres: the outer edge, its corner radius and the line where wood meets cushion cloth.
const frameX = 775, frameY = 1410, frameRadius = 105, cushionDepth = 65;
const cornerCap = 152, sideCap = 128;

export function svgViewport(w: number, h: number, top: number, bottom: number, zoom = 1) {
  const landscape = w > h;
  const tableWidth = (landscape ? length : width) + .30;
  const tableHeight = (landscape ? width : length) + .30;
  const availableWidth = Math.max(1, w - 20);
  const availableHeight = Math.max(1, bottom - top);
  const scale = Math.min(availableWidth / tableWidth, availableHeight / tableHeight) * zoom;
  const maxPanX = Math.max(0, (tableWidth * scale - availableWidth) / 2);
  const maxPanY = Math.max(0, (tableHeight * scale - availableHeight) / 2);
  return { landscape, scale, cx: w / 2, cy: (top + bottom) / 2, maxPanX, maxPanY };
}
export class SvgTable {
  private view = svgViewport(1280, 720, 100, 620);
  private panX = 0;
  private panY = 0;
  private root: SVGGElement;
  private table: SVGGElement;
  private guides: SVGGElement;
  private cue: SVGGElement;
  private balls: SVGGElement[];
  private orientations: (BallOrientation | null)[] = [];
  private finish = '';
  constructor(private svg: SVGSVGElement) {
    svg.innerHTML = `<defs>
      <radialGradient id="sv-felt" r=".72">${stops([[0, '#fff6dc', .11], [.18, '#fff6dc', .095], [.36, '#fff6dc', .055], [.52, '#fff6dc', .02], [.64, '#fff6dc', 0], [.64, '#00090f', 0], [.76, '#00090f', .04], [.88, '#00090f', .14], [1, '#00090f', .32]])}</radialGradient>
      <radialGradient id="sv-lamp" r=".74">${stops([[.5, '#fff3d6', .1], [.66, '#fff3d6', 0], [.66, '#000', 0], [.84, '#000', .12], [1, '#000', .3]])}</radialGradient>
      <radialGradient id="sv-pocket">${stops([[0, '#000'], [.6, '#020203'], [.82, '#0e0b0b'], [.94, '#251e1c'], [1, '#3b312d']])}</radialGradient>
      <radialGradient id="sv-pocket-fall">${stops([[.55, '#000', .5], [.78, '#000', .2], [1, '#000', 0]])}</radialGradient>
      ${woodGrain(true)}${woodGrain(false)}
      <clipPath id="sv-frame"><rect x="${-frameX}" y="${-frameY}" width="${2 * frameX}" height="${2 * frameY}" rx="${frameRadius}"/></clipPath>
      <radialGradient id="sv-resin" cx=".3" cy=".23" r=".85"><stop stop-color="#fff" stop-opacity=".54"/><stop offset=".38" stop-color="#fff" stop-opacity=".03"/><stop offset=".7" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
      <radialGradient id="sv-contact"><stop stop-color="#000" stop-opacity=".65"/><stop offset=".65" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <linearGradient id="sv-maple" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffeab6"/><stop offset=".35" stop-color="#e5b86e"/><stop offset=".65" stop-color="#fff0c5"/><stop offset="1" stop-color="#99682e"/></linearGradient>
      <pattern id="sv-fibre" width="127" height="131" patternUnits="userSpaceOnUse">${feltFibres()}</pattern>
      <clipPath id="sv-ball-clip"><circle r="35"/></clipPath>
    </defs><g class="sv-world"><g class="sv-table"></g><g class="sv-guides"></g><g class="sv-balls"></g><g class="sv-cue"></g></g>`;
    this.root = svg.querySelector('.sv-world')!;
    this.table = svg.querySelector('.sv-table')!;
    this.guides = svg.querySelector('.sv-guides')!;
    this.cue = svg.querySelector('.sv-cue')!;
    const layer = svg.querySelector('.sv-balls')!;
    this.balls = Array.from({length: 22}, () => {
      const g = document.createElementNS(ns, 'g'); layer.append(g); return g;
    });
  }
  resize(w: number, h: number, top: number, bottom: number, zoom = 1) {
    this.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    this.view = svgViewport(w, h, top, bottom, zoom);
    this.panBy(0, 0);
  }
  panBy(dx: number, dy: number) {
    const v = this.view;
    this.panX = Math.max(-v.maxPanX, Math.min(v.maxPanX, this.panX + dx));
    this.panY = Math.max(-v.maxPanY, Math.min(v.maxPanY, this.panY + dy));
    this.root.setAttribute('transform', 'translate(' + (v.cx + this.panX) + ' ' + (v.cy + this.panY) + ') scale(' + v.scale / 1000 + ') rotate(' + (v.landscape ? 90 : 0) + ')');
  }
  resetPan() {
    this.panBy(-this.panX, -this.panY);
  }
  project(x: number, z: number) {
    const v = this.view;
    return { x: v.cx + this.panX + (v.landscape ? z : x) * v.scale, y: v.cy + this.panY + (v.landscape ? x : -z) * v.scale };
  }
  pick(sx: number, sy: number, rails = false) {
    const v = this.view;
    const dx = sx - v.cx - this.panX;
    const dy = sy - v.cy - this.panY;
    const x = (v.landscape ? dy : dx) / v.scale;
    const z = (v.landscape ? dx : -dy) / v.scale;
    const margin = rails ? .16 : 0;
    if (Math.abs(x) > width / 2 + margin || Math.abs(z) > length / 2 + margin) return;
    return {x, z};
  }
  private artwork(state: TableState) {
    const { venue } = state;
    const [, cushionColor, wood] = tableFinish(state.tableStyle, state.snooker, venue);
    const accent = venue?.accent ?? '#c4aa77';
    const felt = venue ? venue.colors[0] : state.snooker ? '#90213e' : state.tableStyle === 'Club Green' ? '#138875'
      : state.tableStyle === 'Burgundy Lounge' ? '#922e59' : state.tableStyle === 'Tournament Blue' ? '#197eb4'
      : tableFinish(state.tableStyle, false)[0];
    const trim = venue?.trim ?? '#b7a27e';
    const noseX = Math.round(width * 500 - 5), noseY = Math.round(length * 500 - 5);
    const backX = noseX + cushionDepth, backY = noseY + cushionDepth;
    const cloth = mix(felt, cushionColor, .45);
    // A rail from above: rolled outer edge, lacquer highlight on the crown, shade where the cloth tucks in.
    const railStops: Stop[] = [[0, shade(wood, .42)], [.1, shade(wood, .86)], [.2, tint(wood, .25)], [.34, tint(wood, .08)],
      [.78, wood], [.92, shade(wood, .78)], [1, shade(wood, .5)]];
    // Cushion cloth climbs out of the rail groove to a lit nose, then rolls under it.
    const cushionStops: Stop[] = [[0, shade(cloth, .58)], [.14, shade(cloth, .9)], [.5, tint(cloth, .05)],
      [.86, tint(cloth, .16)], [.95, tint(cloth, .3)], [1, shade(cloth, .82)]];
    const shadowStops: Stop[] = [[0, '#000', .42], [.35, '#000', .16], [1, '#000', 0]];
    const reach = 34, r = frameRadius, mitre = r * (1 - Math.SQRT1_2);
    let defs = '', rails = '', shadows = '';
    for (const [id, nx, ny] of [['l', -1, 0], ['r', 1, 0], ['t', 0, -1], ['b', 0, 1]] as const) {
      const side = nx !== 0, sign = nx + ny;
      // Every material is shaded along its rail's own normal, from the outside in.
      defs += across('sv-rail-' + id, nx * frameX, ny * frameY, nx * backX, ny * backY, railStops)
        + across('sv-cushion-' + id, nx * backX, ny * backY, nx * noseX, ny * noseY, cushionStops)
        + across('sv-shade-' + id, nx * noseX, ny * noseY, nx * (noseX - reach), ny * (noseY - reach), shadowStops);
      // Rails meet on the corner mitres, under the pocket castings.
      const d = side
        ? `M${sign * (frameX - mitre)} ${mitre - frameY}A${r} ${r} 0 0 ${nx < 0 ? 0 : 1} ${sign * frameX} ${r - frameY}V${frameY - r}A${r} ${r} 0 0 ${nx < 0 ? 0 : 1} ${sign * (frameX - mitre)} ${frameY - mitre}L${sign * backX} ${backY}V${-backY}Z`
        : `M${mitre - frameX} ${sign * (frameY - mitre)}A${r} ${r} 0 0 ${ny < 0 ? 1 : 0} ${r - frameX} ${sign * frameY}H${frameX - r}A${r} ${r} 0 0 ${ny < 0 ? 1 : 0} ${frameX - mitre} ${sign * (frameY - mitre)}L${backX} ${sign * backY}H${-backX}Z`;
      rails += `<path d="${d}" fill="url(#sv-rail-${id})"/><path d="${d}" fill="url(#sv-grain-${side ? 'v' : 'h'})"/>`;
      shadows += side
        ? `<rect x="${nx < 0 ? -noseX : noseX - reach}" y="${-noseY}" width="${reach}" height="${2 * noseY}" fill="url(#sv-shade-${id})"/>`
        : `<rect x="${-noseX}" y="${ny < 0 ? -noseY : noseY - reach}" width="${2 * noseX}" height="${reach}" fill="url(#sv-shade-${id})"/>`;
    }
    // Domed metal plates carry the pockets; the frame's outline trims them to the rails.
    defs += '<radialGradient id="sv-cap">' + stops([[.48, tint(trim, .24)], [.6, trim], [.8, shade(trim, .64)], [.94, shade(trim, .44)], [1, shade(trim, .32)]]) + '</radialGradient>';
    let castings = '', falls = '';
    for (const p of pockets) {
      const at = 'cx="' + p.x * 1000 + '" cy="' + -p.z * 1000 + '"', mouth = pocketMouthRadius(p) * 1000;
      castings += `<circle ${at} r="${p.z ? cornerCap : sideCap}" fill="url(#sv-cap)" stroke="${tint(trim, .4)}" stroke-opacity=".55" stroke-width="1.5"/>`;
      // Two screws fix each plate to the rails either side of its pocket.
      const sx = Math.sign(p.x), sz = Math.sign(p.z);
      const railX = (backX + frameX) / 2, railY = (backY + frameY) / 2;
      for (const [x, y] of sz ? [[sx * railX, -sz * (railY - 187)], [sx * (railX - 187), -sz * railY]] : [[sx * railX, -74], [sx * railX, 74]]) {
        castings += `<circle cx="${x}" cy="${y}" r="6.5" fill="${shade(trim, .36)}"/><circle cx="${x}" cy="${y}" r="4.6" fill="${tint(trim, .12)}"/><path d="M${x - 3.2} ${y - 3.2}l6.4 6.4" stroke="${shade(trim, .3)}" stroke-width="1.4"/>`;
      }
      // The cloth darkens as it rolls over the slate into the drop.
      falls += `<circle ${at} r="${mouth + 34}" fill="url(#sv-pocket-fall)"/>`;
    }
    let s = `<defs>${defs}</defs>
      <rect x="${-frameX - 18}" y="${-frameY - 18}" width="${2 * frameX + 36}" height="${2 * frameY + 36}" rx="${r + 18}" fill="#000" opacity=".16"/>
      <rect x="${-frameX - 9}" y="${-frameY - 9}" width="${2 * frameX + 18}" height="${2 * frameY + 18}" rx="${r + 9}" fill="#000" opacity=".22"/>
      <rect x="${-frameX}" y="${-frameY}" width="${2 * frameX}" height="${2 * frameY}" rx="${r}" fill="${wood}"/>
      ${rails}
      <rect x="${17 - frameX}" y="${17 - frameY}" width="${2 * frameX - 34}" height="${2 * frameY - 34}" rx="${r - 17}" fill="none" stroke="${accent}" stroke-opacity=".9" stroke-width="${venue?.championship ? 6 : 3}"/>
      <rect x="${-frameX}" y="${-frameY}" width="${2 * frameX}" height="${2 * frameY}" rx="${r}" fill="url(#sv-lamp)" stroke="${shade(wood, .3)}" stroke-width="2.5"/>
      <g clip-path="url(#sv-frame)">${castings}</g>
      <rect x="-659" y="-1294" width="1318" height="2588" fill="${felt}"/>
      <rect x="-635" y="-1270" width="1270" height="2540" fill="url(#sv-felt)"/>
      <rect x="-635" y="-1270" width="1270" height="2540" fill="url(#sv-fibre)"/>
      ${falls}${shadows}`;
    const cushion = (d: string, id: string) => { s += '<path d="' + d + '" fill="url(#sv-cushion-' + id + ')" stroke="' + shade(cloth, .45) + '" stroke-opacity=".55" stroke-width="1"/>'; };
    // Each jaw follows the collision approach, then curves along the pocket lip.
    for (const c of cushions.filter(c => !c.jaw)) {
      const a = {x:c.ax*1000,y:-c.az*1000}, b = {x:c.bx*1000,y:-c.bz*1000};
      const distance = Math.hypot(b.x-a.x,b.y-a.y);
      const t = {x:(b.x-a.x)/distance,y:(b.y-a.y)/distance};
      const n = c.ax === c.bx ? {x:Math.sign(c.ax),y:0} : {x:0,y:-Math.sign(c.az)};
      const end = (v: typeof a, first: boolean) => {
        const jaw = cushions.find(j => j.jaw && Math.abs(j.ax*1000-v.x)<.01 && Math.abs(-j.az*1000-v.y)<.01)!;
        const p = pockets.reduce((best,p) => Math.hypot(p.x-jaw.bx,p.z-jaw.bz)<Math.hypot(best.x-jaw.bx,best.z-jaw.bz)?p:best);
        const center = {x:p.x*1000,y:-p.z*1000}, r = pocketMouthRadius(p) * 1000 + 3;
        const sideRail = c.ax === c.bx;
        const inwardX = -Math.sign(p.x);
        const inwardY = p.z === 0 ? Math.sign(v.y) : Math.sign(p.z);
        // Extend the nose around the rim, rather than ending at its first tangent.
        const angle = p.z === 0 ? Math.acos(.4) : sideRail ? Math.PI / 2 : Math.PI / 5;
        const tip={x:center.x+inwardX*r*Math.cos(angle),y:center.y+inwardY*r*Math.sin(angle)};
        const control=sideRail ? {x:v.x,y:tip.y} : {x:tip.x,y:v.y};
        const q={x:v.x+n.x*cushionDepth,y:v.y+n.y*cushionDepth};
        const px=q.x-center.x,py=q.y-center.y;
        const dot=px*t.x+py*t.y;
        const root=Math.sqrt(Math.max(0,dot*dot-px*px-py*py+r*r));
        const u=-dot+(first?root:-root);
        return {tip,control,outer:{x:q.x+t.x*u,y:q.y+t.y*u},r};
      };
      const start=end(a,true), finish=end(b,false);
      const sweep=t.x*n.y-t.y*n.x<0?1:0;
      cushion('M'+start.tip.x+' '+start.tip.y+' Q'+start.control.x+' '+start.control.y+' '+a.x+' '+a.y+' L'+b.x+' '+b.y+' Q'+finish.control.x+' '+finish.control.y+' '+finish.tip.x+' '+finish.tip.y+
        ' A'+finish.r+' '+finish.r+' 0 0 '+sweep+' '+finish.outer.x+' '+finish.outer.y+
        ' L'+start.outer.x+' '+start.outer.y+' A'+start.r+' '+start.r+' 0 0 '+sweep+' '+start.tip.x+' '+start.tip.y+' Z', n.x ? n.x < 0 ? 'l' : 'r' : n.y < 0 ? 't' : 'b');
    }
    if (venue?.championship) {
      for (const { x, z, width, depth, diamond } of championshipInlays) {
        const centerX = x * 1000, centerY = -z * 1000;
        const transform = diamond ? ` transform="rotate(45 ${centerX} ${centerY})"` : '';
        s += `<rect x="${centerX - width * 500}" y="${centerY - depth * 500}" width="${width * 1000}" height="${depth * 1000}" fill="${accent}"${transform}/>`;
      }
    }
    const sight = venue?.accent ?? '#d9c797';
    // A dark hairline seats each sight in the wood.
    const inlaid = 'fill="' + sight + '" stroke="#000" stroke-opacity=".45" stroke-width="1"';
    for (const { x, z, width, depth, diamond, round } of railSights(venue?.motif, .731, 1.362)) {
      const cx = x * 1000, cy = -z * 1000, w = width * 500, h = depth * 500;
      s += round ? `<circle cx="${cx}" cy="${cy}" r="${w}" ${inlaid}/>`
        : diamond ? `<path d="M${cx} ${cy - h} l${w} ${h} ${-w} ${h} ${-w} ${-h}Z" ${inlaid}/>`
        : `<rect x="${cx - w}" y="${cy - h}" width="${w * 2}" height="${h * 2}" rx="1.5" ${inlaid}/>`;
    }
    if (state.snooker) s += '<path d="M-635 740H635 M-220 740 A220 220 0 0 0 220 740" fill="none" stroke="#f6dfcd" stroke-opacity=".45" stroke-width="2"/>';
    // Head string, and the worn foot spot the rack is set on.
    else s += '<path d="M-635 635H635" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><circle cy="-480" r="7" fill="#000" opacity=".26"/>';
    // Paint the complete pocket over the cushion ends so the rim stays continuous.
    s += '<g class="sv-pockets">';
    for (const p of pockets) {
      const r = pocketMouthRadius(p) * 1000;
      const center = `<circle cx="${p.x * 1000}" cy="${-p.z * 1000}"`;
      // Leather liner with its metal rim, then the drop itself.
      s += `${center} r="${r + 7}" fill="#1c1617" stroke="${trim}" stroke-width="${venue?.championship ? 5 : 2}"/>`;
      s += `${center} r="${r}" fill="url(#sv-pocket)"/>`;
    }
    this.table.innerHTML = s + '</g>';
    state.balls.forEach((_, i) => {
      this.balls[i].innerHTML = ballArtwork(i, state.snooker, true);
    });
    this.orientations = [];
  }
  draw(state: TableState) {
    const key = state.snooker + (state.venue?.id ?? state.tableStyle) + state.balls.length;
    if (key !== this.finish) { this.artwork(state); this.finish = key; }
    state.balls.forEach((b, i) => {
      const g = this.balls[i];
      const drop = state.pocketDrops?.get(i);
      g.style.display = b.pocketed && !drop ? 'none' : '';
      g.style.opacity = drop ? String(drop.opacity) : '';
      const x = drop?.x ?? b.x, z = drop?.z ?? b.z;
      g.setAttribute('transform', 'translate(' + x * 1000 + ' ' + (-z * 1000) + ')' +
        (drop ? ' scale(' + drop.scale + ')' : ''));
      const orientation = b.orientation ?? null;
      if ((b.pocketed && !drop) || state.snooker && i > 0 || this.orientations[i] === orientation) return;
      this.orientations[i] = orientation;
      const { mark, caps } = ballMarkings(b.orientation, i > 8, i === 0);
      const size = radius * 1000;
      mark[4] *= size;
      mark[5] *= size;
      g.querySelector('.sv-ball-mark')?.setAttribute('transform', 'matrix(' + mark.join(' ') + ')');
      if (caps.length) {
        const path = caps.filter(points => points.length).map(points =>
          'M' + points.map(([x, y]) => (x * size).toFixed(2) + ' ' + (y * size).toFixed(2)).join('L') + 'Z');
        g.querySelector('.sv-ball-caps')?.setAttribute('d', path.join(' '));
      }
    });
    this.balls.forEach((g, i) => { if (i >= state.balls.length) g.style.display = 'none'; });
    const b = state.balls[0];
    let guides = '';
    const line = (a: {x:number;z:number}, b: {x:number;z:number}, color: string) => '<path d="M'+a.x*1000+' '+(-a.z*1000)+' L'+b.x*1000+' '+(-b.z*1000)+'" stroke="'+color+'" stroke-width="2.5" stroke-dasharray="10 9" fill="none"/>';
    if (!state.rolling && !state.finished && state.guides) {
      const g = traceShot(state.balls,state.aim.x,state.aim.z);
      guides += line(b,g.impact,'#fff4df');
      if (g.objectStart && g.objectEnd) guides += line(g.objectStart,g.objectEnd,'#f8d28b') + '<circle cx="'+g.impact.x*1000+'" cy="'+(-g.impact.z*1000)+'" r="35" fill="#ffffff0c" stroke="#fff8" stroke-width="2"/>';
    }
    if (state.callEligible) pockets.forEach((p, i) => {
      const called = state.calledPocket === i;
      const color = called ? calledPocketColor : '#ffffff66';
      const borderWidth = called ? calledPocketBorderWidth * 1000 : 4;
      guides += `<circle cx="${p.x * 1000}" cy="${-p.z * 1000}" r="${pocketMouthRadius(p) * 1000 + 4}" fill="none" stroke="${color}" stroke-width="${borderWidth}"/>`;
    });
    this.guides.innerHTML = guides;
    this.cue.style.display = state.rolling || state.finished ? 'none' : '';
    this.cue.setAttribute('transform','translate('+b.x*1000+' '+(-b.z*1000)+') rotate('+Math.atan2(-state.aim.z,state.aim.x)*180/Math.PI+') translate('+(-(radius+.018+state.pull*.12)*1000)+' 0)');
    const cueKey = state.cueStyle;
    if (this.cue.dataset.finish !== cueKey) {
      this.cue.dataset.finish = cueKey;
      this.cue.innerHTML = cueArtwork(cueKey, true);
    }
  }
}
