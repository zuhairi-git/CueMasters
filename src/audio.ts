export type SoundKind = 'cue' | 'ball' | 'rail' | 'pocket';
/** Classic: the original recording and synth. Studio: modelled resin, leather and rubber in a small room. */
export type SoundStyle = 'classic' | 'studio';
export const soundStyles: readonly SoundStyle[] = ['studio', 'classic'];
type RecordedSoundKind = Extract<SoundKind, 'cue' | 'ball'>;

type SoundEvent = { kind: SoundKind; strength: number };

const maxPendingSounds = 24;
const maxSoundsPerFlush = 8;
const studioVariants = 4;
// [frequency in Hz, decay per second, amplitude]
type Mode = [number, number, number];

/** Decaying partials struck together: the ring of a hard object. */
function ring(modes: Mode[], time: number, pitch: number) {
  let sample = 0;
  for (let mode = 0; mode < modes.length; mode++) {
    const [frequency, decay, amplitude] = modes[mode];
    sample += Math.sin(time * Math.PI * 2 * frequency * pitch + mode * 1.37) * amplitude * Math.exp(-time * decay);
  }
  return sample;
}

function normalize(data: Float32Array, peak: number) {
  let loudest = 0;
  for (let i = 0; i < data.length; i++) loudest = Math.max(loudest, Math.abs(data[i]));
  if (!loudest) return;
  const tail = Math.min(data.length, 96);
  for (let i = 0; i < data.length; i++) data[i] *= peak / loudest * Math.min(1, (data.length - 1 - i) / tail);
}

/**
 * Studio sounds are rendered once per strength tier and variant, then replayed.
 * Each models what is struck: resin on resin, leather on resin, resin on rubber,
 * and a ball dropping through a leather pocket onto the return rail.
 */
function renderStudio(kind: SoundKind, tier: number, variant: number, sampleRate: number, random = Math.random) {
  const intensity = [0.3, 0.62, 1][tier];
  const pitch = 1 + (variant - (studioVariants - 1) / 2) * 0.03;
  const duration = kind === 'pocket' ? 0.86 : kind === 'cue' ? 0.16 : kind === 'rail' ? 0.2 : 0.09;
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  let previousNoise = 0;
  let softNoise = 0;
  let rumble = 0;
  // A pocketed ball clips the lip, lands, then rattles to rest on the rail below.
  const bounces: [number, number][] = [[0.11, 0.5], [0.185, 0.36], [0.245, 0.26], [0.29, 0.18], [0.325, 0.12]];
  for (let i = 0; i < data.length; i++) {
    const time = i / sampleRate;
    const noise = random() * 2 - 1;
    const bright = noise - previousNoise * 0.86;
    previousNoise = noise;
    if (kind === 'ball') {
      const click = bright * (0.2 + 0.5 * intensity) * Math.exp(-time * 2400);
      const clack = ring([
        [1180, 190, 0.22], [2740, 260, 0.5], [4350, 330, 0.34 + 0.2 * intensity],
        [6120, 420, 0.18 + 0.3 * intensity], [8900, 560, 0.08 + 0.25 * intensity],
      ], time, pitch);
      data[i] = (1 - Math.exp(-time * 9000)) * (clack + click);
    } else if (kind === 'cue') {
      softNoise += (noise - softNoise) * Math.min(1, 2500 * 2 * Math.PI / sampleRate);
      const chalk = softNoise * 0.3 * Math.exp(-time * 240);
      const tock = ring([
        [240, 38, 0.16], [420, 70, 0.35], [860, 95, 0.4], [1650, 150, 0.3], [2900, 260, 0.12 + 0.2 * intensity],
      ], time, pitch);
      data[i] = (1 - Math.exp(-time * 2200)) * (tock + chalk);
    } else if (kind === 'rail') {
      softNoise += (noise - softNoise) * Math.min(1, 800 * 2 * Math.PI / sampleRate);
      // The rubber gives, so the thump falls in pitch as it dies away.
      const phase = 2 * Math.PI * pitch * (95 * time + (75 / 18) * (1 - Math.exp(-time * 18)));
      const thump = Math.sin(phase) * 0.8 * Math.exp(-time * 42);
      const knock = ring([[330, 80, 0.25], [610, 130, 0.1 * intensity]], time, pitch);
      data[i] = (1 - Math.exp(-time * 900)) * (thump + knock + softNoise * 0.35 * Math.exp(-time * 90));
    } else {
      softNoise += (noise - softNoise) * Math.min(1, 1400 * 2 * Math.PI / sampleRate);
      rumble += (noise - rumble) * Math.min(1, 320 * 2 * Math.PI / sampleRate);
      let sample = ring([[2600, 300, 0.2], [4200, 380, 0.12]], time, pitch) * 0.35;
      const landing = time - 0.03;
      if (landing > 0) {
        sample += (1 - Math.exp(-landing * 700)) * (ring([[128, 22, 0.7], [262, 30, 0.35]], landing, pitch)
          + softNoise * 0.4 * Math.exp(-landing * 55));
      }
      for (const [at, level] of bounces) {
        const since = time - at;
        if (since > 0) {
          sample += level * (1 - Math.exp(-since * 2600)) * (ring([[520, 120, 0.6], [1340, 190, 0.35], [2400, 260, 0.2]], since, pitch)
            + softNoise * 0.25 * Math.exp(-since * 160));
        }
      }
      const rolling = Math.max(0, time - 0.3) / (duration - 0.3);
      sample += rumble * 1.6 * Math.sin(Math.PI * Math.min(1, rolling)) ** 2 * (0.75 + 0.25 * Math.sin(time * 2 * Math.PI * 23));
      data[i] = sample;
    }
  }
  normalize(data, 0.9);
  return data;
}

/** A small, soft room: a few early reflections and a short diffuse tail. */
function renderRoom(sampleRate: number, channel: number, random = Math.random) {
  const data = new Float32Array(Math.ceil(sampleRate * 0.42));
  let smooth = 0;
  for (let i = 0; i < data.length; i++) {
    const time = i / sampleRate;
    // The tail darkens as it decays, as soft furnishings swallow the highs first.
    smooth += ((random() * 2 - 1) - smooth) * Math.max(0.08, 0.7 * Math.exp(-time * 9));
    data[i] = smooth * Math.exp(-time * 11) * (1 - Math.exp(-time * 400));
  }
  for (const [at, level] of [[0.011, 0.5], [0.019, -0.36], [0.031, 0.27], [0.047, -0.18]]) {
    const index = Math.floor((at + channel * 0.0023) * sampleRate);
    if (index < data.length) data[index] += level;
  }
  return data;
}

/** A rising bell arpeggio that settles on the full chord. */
function renderFanfare(sampleRate: number) {
  const data = new Float32Array(Math.ceil(sampleRate * 1.9));
  const notes: [number, number, number][] = [
    [523.25, 0, 0.5], [659.25, 0.1, 0.5], [783.99, 0.2, 0.5], [1046.5, 0.3, 0.62],
    [523.25, 0.52, 0.3], [783.99, 0.52, 0.3], [1318.51, 0.52, 0.34],
  ];
  for (let i = 0; i < data.length; i++) {
    const time = i / sampleRate;
    let sample = 0;
    for (const [frequency, at, level] of notes) {
      const since = time - at;
      if (since <= 0) continue;
      const angle = since * 2 * Math.PI * frequency;
      sample += level * (1 - Math.exp(-since * 900)) * (Math.sin(angle) * Math.exp(-since * 3.4)
        + 0.42 * Math.sin(angle * 2) * Math.exp(-since * 5.5) + 0.2 * Math.sin(angle * 3.01) * Math.exp(-since * 8));
    }
    data[i] = sample;
  }
  normalize(data, 0.8);
  return data;
}

export class GameAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private clothGain?: GainNode;
  private clothFilter?: BiquadFilterNode;
  private recordings?: Partial<Record<RecordedSoundKind, AudioBuffer[]>>;
  private recordingsLoading?: Promise<void>;
  private pending: SoundEvent[] = [];
  private studio = new Map<string, AudioBuffer>();
  private room?: AudioNode;
  private fanfareBuffer?: AudioBuffer;
  enabled = true;
  volume = 0.45;
  style: SoundStyle = 'classic';

  async unlock() {
    if (!this.enabled) return;
    try {
      // On supported iOS versions, request playback audio so the Ring/Silent
      // switch does not mute game effects. Older WebKit versions may ignore it.
      const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (audioSession) {
        try { audioSession.type = 'playback'; } catch { /* Unsupported audio session type. */ }
      }
      this.context ??= new AudioContext();
      if (!this.output) {
        this.output = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        this.output.connect(limiter);
        limiter.connect(this.context.destination);
        this.startClothBed(this.context);
      }
      // Resume within the user gesture; recorded assets must not delay audio.
      // iOS WebKit needs an actual source started from a user activation.
      // Resume and start a silent buffer before yielding to any promise.
      if (this.context.state !== 'running') void this.context.resume();
      const silence = this.context.createBuffer(1, 1, this.context.sampleRate);
      const primer = this.context.createBufferSource();
      primer.buffer = silence;
      primer.connect(this.context.destination);
      primer.onended = () => primer.disconnect();
      primer.start(0);
      if (this.style === 'classic') void this.loadRecordings(this.context);
    } catch {
      // Gameplay remains available if the browser cannot start audio.
    }
  }

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.output) this.output.gain.setTargetAtTime(enabled ? this.volume : 0, this.context.currentTime, 0.02);
    if (!enabled) this.pending.length = 0;
  }

  setStyle(style: SoundStyle) {
    this.style = style;
    if (style === 'classic' && this.context) void this.loadRecordings(this.context);
  }

  /** Plays one strike, contact and pocket drop so a style can be auditioned from settings. */
  async preview() {
    await this.unlock();
    const context = this.context;
    if (!this.enabled || !context || !this.output) return;
    try { await context.resume(); } catch { /* Playback stays optional. */ }
    if (this.style === 'classic') await this.loadRecordings(context);
    this.output.gain.setTargetAtTime(this.volume, context.currentTime, 0.02);
    this.play(context, 'cue', 2.4);
    this.play(context, 'ball', 2.1, 0.2);
    this.play(context, 'rail', 1.6, 0.42);
    this.play(context, 'pocket', 1.5, 0.62);
  }

  /** A short victory chime for the result screen. */
  fanfare() {
    const context = this.context;
    if (!this.enabled || !context || !this.output || context.state !== 'running' || document.hidden) return;
    if (!this.fanfareBuffer) {
      const data = renderFanfare(context.sampleRate);
      this.fanfareBuffer = context.createBuffer(1, data.length, context.sampleRate);
      this.fanfareBuffer.getChannelData(0).set(data);
    }
    this.output.gain.setTargetAtTime(this.volume, context.currentTime, 0.02);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.3;
    source.buffer = this.fanfareBuffer;
    source.connect(gain);
    gain.connect(this.output);
    const room = this.roomSend(context);
    if (room) gain.connect(room);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(context.currentTime + 0.05);
  }

  updateMotion(balls: readonly { vx: number; vz: number; pocketed: boolean }[]) {
    if (!this.enabled || !this.context || !this.clothGain || !this.clothFilter) return;
    let rollingSpeed = 0;
    for (const ball of balls) {
      if (!ball.pocketed) rollingSpeed += Math.hypot(ball.vx, ball.vz);
    }
    const now = this.context.currentTime;
    const level = Math.min(0.07, Math.max(0, rollingSpeed - 0.12) * 0.006);
    this.clothGain.gain.setTargetAtTime(level, now, rollingSpeed ? 0.08 : 0.18);
    this.clothFilter.frequency.setTargetAtTime(420 + Math.min(1100, rollingSpeed * 180), now, 0.1);
  }

  queue = (kind: SoundKind, strength: number) => {
    if (!this.enabled || !Number.isFinite(strength) || strength <= 0.06) return;
    const event = { kind, strength };
    if (this.pending.length < maxPendingSounds) {
      this.pending.push(event);
      return;
    }
    const quietest = this.pending.reduce((lowest, queued, index, events) =>
      queued.strength < events[lowest].strength ? index : lowest, 0);
    if (strength > this.pending[quietest].strength) this.pending[quietest] = event;
  };

  flush() {
    const context = this.context;
    if (!this.enabled || document.hidden) {
      this.pending.length = 0;
      return;
    }
    if (!context || !this.output || context.state !== 'running') return;
    this.output.gain.setTargetAtTime(this.volume, context.currentTime, 0.02);
    const events = this.pending.sort((a, b) => b.strength - a.strength).slice(0, maxSoundsPerFlush);
    this.pending.length = 0;
    for (const { kind, strength } of events) this.play(context, kind, strength);
  }

  private play(context: AudioContext, kind: SoundKind, strength: number, delay = Math.random() * 0.006) {
    if (this.style === 'studio') {
      this.playStudio(context, kind, strength, delay);
      return;
    }
    if (kind === 'cue' || kind === 'ball') {
      const recordedVariants = this.recordings?.[kind];
      if (recordedVariants?.length) {
        this.playRecording(context, kind, strength, recordedVariants[Math.floor(Math.random() * recordedVariants.length)], delay);
        return;
      }
    }

    const duration = kind === 'pocket' ? 0.36 : kind === 'cue' ? 0.13 : kind === 'rail' ? 0.11 : 0.085;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    const variation = 0.92 + Math.random() * 0.16;
    const intensity = Math.min(1, Math.max(0, strength / (kind === 'cue' ? 4 : kind === 'rail' ? 3 : kind === 'pocket' ? 3 : 2.5)));
    const pitch = variation * (0.91 + intensity * 0.16);
    const modes = kind === 'cue'
      ? [[1150, 38, 0.2], [2380, 62, 0.58], [3970, 88, 0.27], [690, 24, 0.16]]
      : kind === 'rail'
        ? [[180, 42, 0.48], [340, 58, 0.32], [680, 86, 0.18]]
        : kind === 'pocket'
          ? [[148, 17, 0.58], [286, 24, 0.35], [625, 42, 0.20], [1390, 74, 0.12]]
          : [[1320, 62, 0.49], [2230, 78, 0.36], [3690, 100, 0.23], [5870, 130, 0.12]];
    const noiseDecay = kind === 'cue' ? 520 : kind === 'pocket' ? 120 : 420;
    let previousNoise = 0;
    let cushionNoise = 0;
    for (let i = 0; i < data.length; i++) {
      const time = i / context.sampleRate;
      const attack = 1 - Math.exp(-time * (kind === 'pocket' ? 950 : kind === 'rail' ? 1500 : 3200));
      const noise = Math.random() * 2 - 1;
      const brightTransient = (noise - previousNoise * 0.72) * Math.exp(-time * noiseDecay);
      previousNoise = noise;
      let resonance = 0;
      for (let mode = 0; mode < modes.length; mode++) {
        const [frequency, decay, amplitude] = modes[mode];
        resonance += Math.sin(time * Math.PI * 2 * frequency * pitch + mode * 1.37)
          * amplitude * Math.exp(-time * decay);
      }
      if (kind === 'rail') {
        cushionNoise += (noise - cushionNoise) * Math.min(1, 4400 / context.sampleRate);
        data[i] = attack * (resonance + cushionNoise * 0.7 * Math.exp(-time * 135));
      } else if (kind === 'pocket') {
        cushionNoise += (noise - cushionNoise) * Math.min(1, 1200 / context.sampleRate);
        const rebound = Math.max(0, time - 0.048);
        const rattle = (1 - Math.exp(-rebound * 850)) * Math.exp(-rebound * 52) *
          (Math.sin(rebound * Math.PI * 2 * 212 * pitch) * 0.28 + cushionNoise * 0.4);
        data[i] = attack * (resonance + cushionNoise * 0.55 * Math.exp(-time * 36)) + rattle;
      } else {
        data[i] = attack * (resonance + brightTransient * 0.45);
      }
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'pocket' ? 2400 : kind === 'rail' ? 1450 + intensity * 500 : 7800 + intensity * 5000;
    gain.gain.value = Math.min(0.55, (kind === 'pocket' ? 0.095 : 0.018) + 0.48 * intensity ** 0.82);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(context.currentTime + delay);
  }

  private playStudio(context: AudioContext, kind: SoundKind, strength: number, delay: number) {
    const intensity = Math.min(1, Math.max(0, strength / (kind === 'cue' ? 4 : kind === 'rail' ? 3 : kind === 'pocket' ? 3 : 2.5)));
    const tier = intensity < 0.34 ? 0 : intensity < 0.7 ? 1 : 2;
    const variant = Math.floor(Math.random() * studioVariants);
    const key = kind + tier + variant;
    let buffer = this.studio.get(key);
    if (!buffer) {
      const data = renderStudio(kind, tier, variant, context.sampleRate);
      buffer = context.createBuffer(1, data.length, context.sampleRate);
      buffer.getChannelData(0).set(data);
      this.studio.set(key, buffer);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    // Softer contacts are duller as well as quieter.
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'pocket' ? 5200 : kind === 'rail' ? 1500 + intensity * 1500
      : kind === 'cue' ? 3600 + intensity * 5000 : 4800 + intensity * 12000;
    gain.gain.value = Math.min(0.62, (kind === 'pocket' ? 0.16 : 0.02) + 0.52 * intensity ** 0.85);
    source.buffer = buffer;
    source.playbackRate.value = 0.975 + Math.random() * 0.05 + (kind === 'ball' ? intensity * 0.03 : 0);
    source.connect(filter);
    filter.connect(gain);
    const nodes: AudioNode[] = [source, filter, gain];
    let last: AudioNode = gain;
    if (typeof context.createStereoPanner === 'function') {
      // A little width keeps a busy break from collapsing into one point.
      const panner = context.createStereoPanner();
      panner.pan.value = (Math.random() * 2 - 1) * (kind === 'pocket' ? 0.45 : 0.28);
      gain.connect(panner);
      nodes.push(panner);
      last = panner;
    }
    last.connect(this.output!);
    const room = this.roomSend(context);
    if (room) {
      const send = context.createGain();
      send.gain.value = kind === 'pocket' ? 0.3 : kind === 'rail' ? 0.12 : 0.2;
      last.connect(send);
      send.connect(room);
      nodes.push(send);
    }
    source.onended = () => { for (const node of nodes) node.disconnect(); };
    source.start(context.currentTime + delay);
  }

  /** The shared room reverb, created on first use where the browser supports it. */
  private roomSend(context: AudioContext) {
    if (this.room || typeof context.createConvolver !== 'function') return this.room;
    const convolver = context.createConvolver();
    const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 0.42), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) impulse.getChannelData(channel).set(renderRoom(context.sampleRate, channel));
    convolver.buffer = impulse;
    const level = context.createGain();
    level.gain.value = 0.55;
    convolver.connect(level);
    level.connect(this.output!);
    this.room = convolver;
    return this.room;
  }

  private loadRecordings(context: AudioContext) {
    if (this.recordings) return Promise.resolve();
    if (!this.recordingsLoading) {
      this.recordingsLoading = (async () => {
        try {
          const response = await fetch(new URL('audio/playing-pool.wav', document.baseURI));
          if (!response.ok) throw new Error(`Pool sound request failed (${response.status})`);
          const recording = await context.decodeAudioData(await response.arrayBuffer());
          const slice = (start: number, end: number) => {
            const firstFrame = Math.floor(start * recording.sampleRate);
            const frameCount = Math.min(recording.length - firstFrame, Math.floor((end - start) * recording.sampleRate));
            const clip = context.createBuffer(recording.numberOfChannels, frameCount, recording.sampleRate);
            for (let channel = 0; channel < recording.numberOfChannels; channel++) {
              const samples = recording.getChannelData(channel).subarray(firstFrame, firstFrame + frameCount);
              const output = clip.getChannelData(channel);
              const fadeFrames = Math.min(Math.floor(recording.sampleRate * 0.006), Math.floor(frameCount / 2));
              for (let frame = 0; frame < frameCount; frame++) {
                const fadeIn = fadeFrames ? Math.min(1, frame / fadeFrames) : 1;
                const fadeOut = fadeFrames ? Math.min(1, (frameCount - 1 - frame) / fadeFrames) : 1;
                output[frame] = samples[frame] * Math.min(fadeIn, fadeOut);
              }
            }
            return clip;
          };
          this.recordings = {
            cue: [slice(0.025, 0.24)],
            ball: [slice(0.24, 0.46), slice(0.47, 0.72), slice(0.73, 0.96)],
          };
        } catch (error) {
          this.recordings = {};
          console.warn('Could not load the billiards recording; using synthesized sound effects.', error);
        }
      })();
    }
    return this.recordingsLoading;
  }

  private playRecording(context: AudioContext, kind: RecordedSoundKind, strength: number, buffer: AudioBuffer, delay: number) {
    const intensity = Math.min(1, Math.max(0, strength / (kind === 'cue' ? 4 : 2.5)));
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const variation = 0.97 + Math.random() * 0.06;
    source.buffer = buffer;
    source.playbackRate.value = variation;
    filter.type = 'lowpass';
    filter.frequency.value = 12000;
    gain.gain.value = Math.min(0.55, 0.025 + 0.48 * intensity ** 0.82);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(context.currentTime + delay);
  }

  private startClothBed(context: AudioContext) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      low += ((Math.random() * 2 - 1) - low) * 0.045;
      data[i] = low * 1.8;
    }
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    this.clothGain = context.createGain();
    this.clothFilter = lowpass;
    source.buffer = buffer;
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 100;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;
    this.clothGain.gain.value = 0;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(this.clothGain);
    this.clothGain.connect(this.output!);
    source.start();
  }
}

/** One audio engine for the whole app, so settings can audition what the table plays. */
export const gameAudio = new GameAudio();
