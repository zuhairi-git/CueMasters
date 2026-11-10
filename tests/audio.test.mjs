import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

class AudioNodeMock {
  constructor() {
    this.gain = { value: 1, setTargetAtTime(value) { this.value = value; } };
    this.frequency = { value: 0, setTargetAtTime(value) { this.value = value; } };
    this.playbackRate = { value: 1 };
  }
  connect() {}
  disconnect() {}
}

class AudioContextMock {
  state = 'running';
  sampleRate = 8000;
  currentTime = 1;
  destination = new AudioNodeMock();
  sources = [];
  gainNodes = [];
  createGain() {
    const node = new AudioNodeMock();
    this.gainNodes.push(node);
    return node;
  }
  createDynamicsCompressor() { return new AudioNodeMock(); }
  createBiquadFilter() { return new AudioNodeMock(); }
  createBuffer(_channels, length) {
    const data = Array.from({ length: _channels }, () => new Float32Array(length));
    return {
      data: data[0],
      duration: length / this.sampleRate,
      length,
      numberOfChannels: _channels,
      sampleRate: this.sampleRate,
      getChannelData: channel => data[channel],
    };
  }
  async decodeAudioData() {
    const buffer = this.createBuffer(2, 12000);
    for (const frame of [0.06, 0.3, 0.52, 0.78].map(time => Math.floor(time * this.sampleRate))) {
      buffer.getChannelData(0)[frame] = 1;
      buffer.getChannelData(1)[frame] = 1;
    }
    return buffer;
  }
  createBufferSource() {
    const source = new AudioNodeMock();
    source.loop = false;
    source.start = () => this.sources.push(source);
    return source;
  }
}

globalThis.AudioContext = AudioContextMock;
globalThis.document = { hidden: false, baseURI: 'http://localhost/' };
const fetchUrls = [];
globalThis.fetch = async url => {
  fetchUrls.push(String(url));
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
};
const source = await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { GameAudio } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('cue, ball, rail, and pocket impacts have distinct sounds and responsive intensity', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  audio.configure(true, 0.8);
  audio.queue('ball', 0.4);
  audio.queue('ball', 3);
  audio.queue('cue', 2);
  audio.queue('rail', 1);
  audio.queue('pocket', 1);
  audio.flush();

  const sources = audio.context.sources.filter(item => !item.loop);
  assert.equal(sources.length, 5);
  const durations = sources.map(item => item.buffer.duration);
  assert.ok(durations.filter(duration => duration < 0.3).length === 4);
  assert.ok(durations.some(duration => duration > 0.45));
  assert.ok(sources.every(item => item.buffer.data.some(sample => sample !== 0)));
  const [ballImpact, , railImpact] = sources;
  assert.equal(ballImpact.buffer.numberOfChannels, 2);
  assert.equal(railImpact.buffer.numberOfChannels, 1);
  assert.ok(railImpact.buffer.duration < ballImpact.buffer.duration);
  const impactGains = audio.context.gainNodes.slice(2).map(node => node.gain.value);
  assert.ok(Math.max(...impactGains) > Math.min(...impactGains));
  assert.equal(audio.context.sources.filter(item => item.loop).length, 1);
  assert.equal(fetchUrls[0], 'http://localhost/audio/playing-pool.wav');
});

test('busy collisions remain polyphonic while the strongest impacts are kept', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  for (let strength = 1; strength <= 12; strength++) audio.queue('ball', strength);
  audio.queue('ball', Number.NaN);
  audio.flush();

  const sources = audio.context.sources.filter(item => !item.loop);
  assert.equal(sources.length, 8);
  const impactGains = audio.context.gainNodes.slice(2).map(node => node.gain.value);
  assert.ok(impactGains[0] >= impactGains.at(-1));
});

test('cloth texture fades with ball motion and settles to silence', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  const ball = { vx: 0, vz: 0, pocketed: false };
  audio.updateMotion([ball]);
  const clothGain = audio.context.gainNodes[1].gain.value;
  ball.vz = 2;
  audio.updateMotion([ball]);
  assert.ok(audio.context.gainNodes[1].gain.value > clothGain);
  ball.pocketed = true;
  audio.updateMotion([ball]);
  assert.equal(audio.context.gainNodes[1].gain.value, 0);
});
