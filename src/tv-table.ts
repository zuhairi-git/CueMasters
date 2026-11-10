import { traceShot } from './aim-guide';
import { ballMarkings } from './ball-markings';
import { cushions, length, pockets, radius, width, type Ball } from './physics';

export const calledPocketColor = '#ffdc38';
export const calledPocketBorderWidth = 0.018;

export function tvViewport(screenWidth: number, screenHeight: number, top: number, bottom: number) {
  const landscape = screenWidth > screenHeight;
  const availableHeight = Math.max(1, bottom - top);
  const scale = Math.max(1, Math.min((screenWidth - 48) / ((landscape ? length : width) + 0.32),
    availableHeight / ((landscape ? width : length) + 0.32)));
  return { landscape, scale, cx: screenWidth / 2, cy: (top + bottom) / 2 };
}

export interface TableState {
  balls: Ball[];
  aim: { x: number; z: number };
  rolling: boolean;
  finished: boolean;
  placement: boolean;
  guides: boolean;
  callEligible: boolean;
  calledPocket?: number;
  snooker: boolean;
  tableStyle: string;
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
    const finishes: Record<string, string[]> = {
      'Club Green': ['#199d85', '#116858', '#182e35'],
      'Tournament Blue': ['#258bd0', '#125283', '#182b43'],
      'Burgundy Lounge': ['#b44876', '#742c54', '#30233c'],
    };
    const [felt, cushion, wood] = state.snooker ? ['#851e39', '#4d142c', '#211a29'] : finishes[state.tableStyle] ?? finishes['Tournament Blue'];
    rectangle(width + 0.30, length + 0.30, '#0a100d');
    rectangle(width + 0.27, length + 0.27, '#63ddf1');
    rectangle(width + 0.25, length + 0.25, wood);
    rectangle(width + 0.04, length + 0.04, cushion);
    rectangle(width, length, felt);
    for (const c of cushions) line(c.ax, c.az, c.bx, c.bz, cushion, 0.025);
    for (const side of [-1, 1]) {
      for (const z of [-0.92, -0.63, -0.34, 0.34, 0.63, 0.92]) circle(side * (width / 2 + 0.078), z, 0.006, '#e8dfc9');
      for (const x of [-0.31, 0, 0.31]) circle(x, side * (length / 2 + 0.078), 0.006, '#e8dfc9');
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
      const mouth = p.z === 0 ? 0.067 : 0.085;
      const called = state.callEligible && state.calledPocket === i;
      circle(p.x, p.z, mouth + 0.012, '#c5ab79');
      circle(p.x, p.z, mouth + 0.009, '#21191c');
      const outline = called ? calledPocketColor : state.callEligible ? '#63ddf1' : undefined;
      circle(p.x, p.z, mouth, '#030305', outline, called ? calledPocketBorderWidth : undefined);
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
      if (ball.pocketed) return;
      circle(ball.x + 0.003, ball.z + 0.003, radius * 1.08, '#00000055');
      const color = state.snooker ? i === 0 ? colors[0] : i <= 15 ? '#c24135' : snookerColors[i - 16] : colors[i > 8 ? i - 8 : i];
      circle(ball.x, ball.z, radius, color, '#00000066');
      if (!state.snooker || i === 0) {
        const p = point(ball.x, ball.z);
        const size = radius * scale;
        const { mark, caps } = ballMarkings(ball.orientation, i > 8, i === 0);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (this.view.landscape) ctx.rotate(Math.PI / 2);
        ctx.scale(size, size);
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
    });
  }
}
