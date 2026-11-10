export type SoundKind = 'cue' | 'ball' | 'rail' | 'pocket';
type RecordedSoundKind = Exclude<SoundKind, 'rail'>;

type SoundEvent = { kind: SoundKind; strength: number };

const maxPendingSounds = 24;
const maxSoundsPerFlush = 8;

export class GameAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private clothGain?: GainNode;
  private clothFilter?: BiquadFilterNode;
  private recordings?: Partial<Record<RecordedSoundKind, AudioBuffer[]>>;
  private recordingsLoading?: Promise<void>;
  private pending: SoundEvent[] = [];
  enabled = true;
  volume = 0.45;

  async unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (!this.output) {
        this.output = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        this.output.connect(limiter);
        limiter.connect(this.context.destination);
        this.startClothBed(this.context);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      await this.loadRecordings(this.context);
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
    if (!context || !this.output || context.state !== 'running' || document.hidden || !this.enabled) {
      this.pending.length = 0;
      return;
    }
    this.output.gain.setTargetAtTime(this.volume, context.currentTime, 0.02);
    const events = this.pending.sort((a, b) => b.strength - a.strength).slice(0, maxSoundsPerFlush);
    this.pending.length = 0;
    for (const { kind, strength } of events) this.play(context, kind, strength);
  }

  private play(context: AudioContext, kind: SoundKind, strength: number) {
    if (kind !== 'rail') {
      const recordedVariants = this.recordings?.[kind];
      if (recordedVariants?.length) {
        this.playRecording(context, kind, strength, recordedVariants[Math.floor(Math.random() * recordedVariants.length)]);
        return;
      }
    }

    const duration = kind === 'pocket' ? 0.3 : kind === 'cue' ? 0.13 : kind === 'rail' ? 0.11 : 0.085;
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
          ? [[185, 16, 0.48], [390, 23, 0.3], [970, 38, 0.22], [2100, 55, 0.13]]
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
      } else {
        const bodyNoise = kind === 'pocket' ? noise * 0.7 * Math.exp(-time * 30) : 0;
        data[i] = attack * (resonance + brightTransient * 0.45 + bodyNoise);
      }
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'pocket' ? 2400 : kind === 'rail' ? 1450 + intensity * 500 : 7800 + intensity * 5000;
    gain.gain.value = Math.min(0.55, 0.018 + 0.48 * intensity ** 0.82);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(context.currentTime + Math.random() * 0.006);
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
            pocket: [slice(0.71, recording.duration)],
          };
        } catch (error) {
          this.recordings = {};
          console.warn('Could not load the billiards recording; using synthesized sound effects.', error);
        }
      })();
    }
    return this.recordingsLoading;
  }

  private playRecording(context: AudioContext, kind: RecordedSoundKind, strength: number, buffer: AudioBuffer) {
    const intensity = Math.min(1, Math.max(0, strength / (kind === 'cue' ? 4 : kind === 'pocket' ? 3 : 2.5)));
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const variation = 0.97 + Math.random() * 0.06;
    source.buffer = buffer;
    source.playbackRate.value = variation;
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'pocket' ? 2600 : 12000;
    gain.gain.value = Math.min(0.55, 0.025 + 0.48 * intensity ** 0.82);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(context.currentTime + Math.random() * 0.006);
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
