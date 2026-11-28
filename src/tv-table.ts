import { traceShot } from './aim-guide';
import { championshipInlays, mix, railSights, shade, tableFinish, type CareerTable } from './table-finishes';
import { ballMarkings } from './ball-markings';
import { cushions, length, pocketMouthRadius, pockets, radius, width, type Ball } from './physics';

import type { PocketDropPose } from './pocket-drop';

export const calledPocketColor = '#ffdc38';
export const calledPocketBorderWidth = 0.018;

const tint = (color: string, share: number) => mix(color, '#ffffff', share);
// The frame matches the overhead SVG table: outer edge, corner radius and where wood meets cushion cloth.
const frameX = width / 2 + 0.14, frameZ = length / 2 + 0.14, frameRadius = 0.105;
const noseX = width / 2 - 0.005, noseZ = length / 2 - 0.005, cushionDepth = 0.065;

export function tvViewport(screenWidth: number, screenHeight: number, top: number, bottom: number) {
  const landscape = screenWidth > screenHeight;
  const availableHeight = Math.max(1, bottom - top);
  const scale = Math.max(1, Math.min((screenWidth - 48) / ((landscape ? length : width) + 0.32),
    availableHeight / ((landscape ? width : length) + 0.32)));
  return { landscape, scale, cx: screenWidth / 2, cy: (top + bottom) / 2 };
}

export interface TableState {
  balls: Ball[];
  pocketDrops?: ReadonlyMap<number, PocketDropPose>;
  aim: { x: number; z: number };
  rolling: boolean;
  finished: boolean;
  placement: boolean;
  guides: boolean;
  callEligible: boolean;
  calledPocket?: number;
  snooker: boolean;
  tableStyle: string;
  venue?: CareerTable;
  cueStyle: string;
  pull: number;
}

// Independent Canvas 2D renderer: it never requests a WebGL context or shaders.
export class TvTable {
  private context: CanvasRenderingContext2D;
  private view = tvViewport(1280, 720, 100, 620);
  private pixelRatio = 1;
  private screenWidth = 1280;
  private screenHeight = 720;

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable');
    this.context = context;
  }

  resize(screenWidth: number, screenHeight: number, top: number, bottom: number) {
    this.screenWidth = Math.max(1, screenWidth);
    this.screenHeight = Math.max(1, screenHeight);
    // Cap the backing buffer for 4K televisions and low-memory TV browsers.
    this.pixelRatio = Math.min(1, 1920 / this.screenWidth, 1080 / this.screenHeight);
    this.canvas.width = Math.round(this.screenWidth * this.pixelRatio);
    this.canvas.height = Math.round(this.screenHeight * this.pixelRatio);
    this.view = tvViewport(this.screenWidth, this.screenHeight, top, bottom);
  }

  project(x: number, z: number) {
    const { landscape, scale, cx, cy } = this.view;
    return landscape ? { x: cx + z * scale, y: cy + x * scale } : { x: cx + x * scale, y: cy - z * scale };
  }

  pick(screenX: number, screenY: number, includeRails = false) {
    const { landscape, scale, cx, cy } = this.view;
    const x = (landscape ? screenY - cy : screenX - cx) / scale;
    const z = (landscape ? screenX - cx : cy - screenY) / scale;
    const margin = includeRails ? 0.16 : 0;
    if (Math.abs(x) > width / 2 + margin || Math.abs(z) > length / 2 + margin) return;
    return { x, z };
  }

  draw(state: TableState) {
    const ctx = this.context;
    const { scale } = this.view;
    const point = (x: number, z: number) => this.project(x, z);
    const line = (x: number, z: number, bx: number, bz: number, color: string, thickness: number) => {
      const a = point(x, z), b = point(bx, bz);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness * scale;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    const circle = (x: number, z: number, r: number, color: string, outline?: string, outlineWidth = 0.004) => {
      const p = point(x, z);
      ctx.beginPath(); ctx.arc(p.x, p.y, r * scale, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, scale * outlineWidth); ctx.stroke(); }
    };
    const rectangle = (w: number, h: number, color: string) => {
      const a = point(-w / 2, -h / 2), b = point(w / 2, h / 2);
      ctx.fillStyle = color;
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    };
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.fillStyle = '#080f20'; ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
    const { venue } = state;
    const [felt, cushion, wood] = tableFinish(state.tableStyle, state.snooker, venue);
    const trim = venue?.trim ?? '#c5ab79';
    const accent = venue?.accent ?? '#63ddf1';
    const cloth = mix(felt, cushion, 0.45);
    // Every material is a flat band stroked around the table: no gradients, and no
    // full-table fills stacked on each other, so slow TV browsers repaint little.
    const band = (inset: number, thickness: number, color: string, halfX = frameX, halfZ = frameZ, corner = frameRadius) => {
      const middle = inset + thickness / 2;
      const a = point(middle - halfX, middle - halfZ), b = point(halfX - middle, halfZ - middle);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      const r = Math.max(0, corner - middle) * scale;
      ctx.beginPath();
      if (r > 0) {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      } else ctx.rect(x, y, w, h);
      if (thickness) { ctx.strokeStyle = color; ctx.lineWidth = thickness * scale; ctx.stroke(); }
    };
    // Rail from the outside in: floor shadow, wood, rolled edge, lacquer highlight, inlay, cloth groove.
    band(-0.012, 0.012, '#04070c');
    band(0, 0.081, wood);
    band(0, 0.007, shade(wood, 0.5));
    band(0.009, 0.01, tint(wood, 0.2));
    band(0.022, venue?.championship ? 0.007 : 0.004, accent);
    band(0.072, 0.009, shade(wood, 0.6));
    // Metal plates carry the pockets, trimmed to the outline of the frame.
    ctx.save();
    band(0, 0, wood);
    ctx.clip();
    for (const p of pockets) {
      const plate = p.z ? 0.152 : 0.128, mouth = pocketMouthRadius(p);
      circle(p.x, p.z, plate, shade(trim, 0.42));
      circle(p.x, p.z, plate - 0.008, shade(trim, 0.66));
      circle(p.x, p.z, plate - 0.03, shade(trim, 0.86));
      circle(p.x, p.z, mouth + 0.04, tint(trim, 0.12));
    }
    ctx.restore();
    // Bed, with the shadow of the cushions lying along its edge.
    rectangle(2 * noseX, 2 * noseZ, felt);
    band(0, 0.016, shade(felt, 0.8), noseX, noseZ, 0);
    // Cushion cloth climbs from the rail groove to a lit nose.
    const cushionBand = (from: number, to: number, color: string) =>
      band(cushionDepth * from, cushionDepth * (to - from), color, noseX + cushionDepth, noseZ + cushionDepth, 0);
    cushionBand(0, 0.12, shade(cloth, 0.62));
    cushionBand(0.12, 0.42, shade(cloth, 0.93));
    cushionBand(0.42, 0.76, tint(cloth, 0.05));
    cushionBand(0.76, 0.93, tint(cloth, 0.15));
    cushionBand(0.93, 1, tint(cloth, 0.3));
    for (const c of cushions) if (c.jaw) line(c.ax, c.az, c.bx, c.bz, tint(cloth, 0.05), 0.022);
    // The plain table keeps round sights; venues draw their own rail motif.
    const sights = venue ? railSights(venue.motif, 0.731, 1.362) : railSights('diamond', 0.731, 1.362).map(piece => ({ ...piece, diamond: false, round: true }));
    const sight = venue?.accent ?? '#e8dfc9';
    for (const { x, z, width, depth, diamond, round } of [...(venue?.championship ? championshipInlays : []), ...sights]) {
      if (round) { circle(x, z, width / 2, sight); continue; }
      const center = point(x, z);
      ctx.fillStyle = sight;
      ctx.save();
      ctx.translate(center.x, center.y);
      if (diamond) ctx.rotate(Math.PI / 4);
      const w = (this.view.landscape ? depth : width) * scale;
      const h = (this.view.landscape ? width : depth) * scale;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 0.3;
    const baulk = state.snooker ? -0.74 : -length / 4;
    line(-width / 2, baulk, width / 2, baulk, '#e8dfc9', 0.003);
    if (state.snooker) for (let i = 0; i < 64; i++) {
      const a = i * Math.PI / 64, b = (i + 1) * Math.PI / 64;
      line(Math.cos(a) * 0.22, baulk - Math.sin(a) * 0.22, Math.cos(b) * 0.22, baulk - Math.sin(b) * 0.22, '#e8dfc9', 0.003);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < pockets.length; i++) {
      const p = pockets[i];
      const mouth = pocketMouthRadius(p);
      const called = state.callEligible && state.calledPocket === i;
      // Metal rim, leather liner, then a drop that darkens towards its middle.
      circle(p.x, p.z, mouth + 0.012, trim);
      circle(p.x, p.z, mouth + 0.009, '#1c1617');
      const outline = called ? calledPocketColor : state.callEligible ? '#63ddf1' : undefined;
      circle(p.x, p.z, mouth, '#2b2320', outline, called ? calledPocketBorderWidth : undefined);
      circle(p.x, p.z, mouth * 0.93, '#100c0c');
      circle(p.x, p.z, mouth * 0.8, '#030305');
      if (state.callEligible) {
        const label = point(p.x, p.z);
        ctx.fillStyle = called ? calledPocketColor : '#d6c49f';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.max(12, scale * 0.04) + 'px sans-serif';
        ctx.fillText(String(i + 1), label.x, label.y);
      }
    }
    const cue = state.balls[0];
    if (!state.rolling && !state.finished) {
      if (state.guides) {
        const guide = traceShot(state.balls, state.aim.x, state.aim.z);
        ctx.setLineDash([scale * 0.018, scale * 0.015]);
        line(cue.x, cue.z, guide.impact.x, guide.impact.z, '#f8f0d9', 0.003);
        if (guide.objectStart && guide.objectEnd) {
          line(guide.objectStart.x, guide.objectStart.z, guide.objectEnd.x, guide.objectEnd.z, '#ffe3a1', 0.004);
          circle(guide.impact.x, guide.impact.z, radius, '#ffffff22', '#ffffff99');
          if (guide.pocket) circle(guide.pocket.x, guide.pocket.z, 0.08, '#ffe3a133', '#ffe3a1');
        }
        ctx.setLineDash([]);
      }
      const gap = 0.05 + state.pull * 0.10;
      const shaft = state.cueStyle === 'Carbon Black' ? '#525762' : state.cueStyle === 'Rosewood' ? '#a95d45' : '#cb9358';
      line(cue.x - state.aim.x * (gap + 0.50), cue.z - state.aim.z * (gap + 0.50), cue.x - state.aim.x * gap, cue.z - state.aim.z * gap, shaft, 0.012);
    }
    const colors = ['#eee9dc', '#e6b92f', '#315baf', '#c24135', '#7854a2', '#e57c2f', '#328c60', '#8e3340', '#151515'];
    const snookerColors = ['#e6b92f', '#328c60', '#8a542d', '#315baf', '#e09bb0', '#151515'];
    state.balls.forEach((ball, i) => {
      const drop = state.pocketDrops?.get(i);
      if (ball.pocketed && !drop) return;
      const x = drop?.x ?? ball.x, z = drop?.z ?? ball.z;
      const size = radius * (drop?.scale ?? 1);
      if (drop) ctx.globalAlpha = drop.opacity;
      else circle(x + 0.003, z + 0.003, radius * 1.08, '#00000055');
      const color = state.snooker ? i === 0 ? colors[0] : i <= 15 ? '#c24135' : snookerColors[i - 16] : colors[i > 8 ? i - 8 : i];
      circle(x, z, size, color, '#00000066');
      if (!state.snooker || i === 0) {
        const p = point(x, z);
        const { mark, caps } = ballMarkings(ball.orientation, i > 8, i === 0);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (this.view.landscape) ctx.rotate(Math.PI / 2);
        ctx.scale(size * scale, size * scale);
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#eee9dc';
        for (const points of caps) {
          if (!points.length) continue;
          ctx.beginPath();
          ctx.moveTo(...points[0]);
          for (let j = 1; j < points.length; j++) ctx.lineTo(...points[j]);
          ctx.closePath(); ctx.fill();
        }
        ctx.transform(...mark);
        ctx.beginPath(); ctx.arc(0, 0, i ? 0.43 : 0.074, 0, Math.PI * 2);
        ctx.fillStyle = i ? '#fff6e4' : '#a6342c';
        ctx.fill();
        if (i) {
          ctx.fillStyle = '#161b17'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = 'bold 0.56px sans-serif';
          ctx.fillText(String(i), 0, 0.03);
        }
        ctx.restore();
      }
      if (drop) ctx.globalAlpha = 1;
    });
  }
}
