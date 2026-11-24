import { length, type Ball } from './physics';
import { pocketDropDuration, type PocketDropPose } from './pocket-drop';

export const shotHighlights = ['bank', 'kick', 'combo', 'long', 'double', 'triple', 'break'] as const;
export type ShotHighlight = typeof shotHighlights[number];

export class ShotHighlights {
  private banked = new Set<number>();
  private combined = new Set<number>();
  private cueContacts = new Set<number>();
  private kicked = false;

  private start: { x: number; z: number }[];

  constructor(private balls: readonly Ball[]) {
    this.start = balls.map(({ x, z }) => ({ x, z }));
  }

  rail(ball: Ball, cueContactMade: boolean) {
    const index = this.balls.indexOf(ball);
    if (index === 0 && !cueContactMade) this.kicked = true;
    else if (index > 0) this.banked.add(index);
  }

  contact(first: number, second: number) {
    if (first === 0) this.cueContacts.add(second);
    else {
      this.combined.add(first);
      this.combined.add(second);
    }
  }

  classify(potted: readonly number[], legal: boolean, breaking: boolean): ShotHighlight | undefined {
    if (!legal || !potted.length) return;
    if (breaking) return potted.length >= 3 ? 'break' : undefined;
    if (potted.length >= 3) return 'triple';
    if (potted.length === 2) return 'double';
    const index = potted[0];
    if (this.kicked) return 'kick';
    if (this.banked.has(index)) return 'bank';
    if (this.combined.has(index) && !this.cueContacts.has(index)) return 'combo';
    const origin = this.start[index];
    const end = this.balls[index];
    if (origin && Math.hypot(end.x - origin.x, end.z - origin.z) >= length * 0.56) return 'long';
  }
}

interface ReplayFrame {
  time: number;
  balls: Ball[];
  drops: ReadonlyMap<number, PocketDropPose>;
}

export class ShotRecording {
  private frames: ReplayFrame[] = [];
  private time = 0;
  private potTime?: number;
  private potInFrame = false;
  private sampleInterval = 1 / 60;

  markPot() {
    this.potInFrame = true;
  }

  capture(dt: number, balls: readonly Ball[], drops: ReadonlyMap<number, PocketDropPose>) {
    this.time += dt;
    const previous = this.frames[this.frames.length - 1];
    if (this.potInFrame) {
      this.potTime = this.time;
      this.potInFrame = false;
    } else if (previous && this.time - previous.time < this.sampleInterval) return;
    this.frames.push({ time: this.time, balls: balls.map(ball => ({ ...ball })), drops });
    if (this.frames.length >= 540) {
      this.frames = this.frames.filter((_, index) => index % 2 === 0);
      this.sampleInterval *= 2;
    }
  }

  replay() {
    if (this.potTime === undefined) return;
    const end = this.potTime + pocketDropDuration + Math.max(0.05, this.sampleInterval);
    const frames = this.frames.filter(frame => frame.time <= end);
    if (frames.length > 1) return new ShotReplay(frames);
  }
}

class ShotReplay {
  private time: number;
  private index = 0;
  private end: number;
  private speed: number;

  constructor(private frames: ReplayFrame[]) {
    this.time = frames[0].time;
    this.end = frames[frames.length - 1].time;
    this.speed = Math.max(0.8, (this.end - this.time) / 4);
  }

  advance(dt: number) {
    this.time += dt * this.speed;
    if (this.time > this.end + 0.25 * this.speed) return;
    while (this.index + 1 < this.frames.length && this.frames[this.index + 1].time <= this.time) this.index++;
    return this.frames[this.index];
  }
}
