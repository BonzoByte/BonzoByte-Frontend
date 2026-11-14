import { TENNIS_CROWD_SECONDS } from './tennis-atmosphere';

/** Gesture-only, finite browser synthesis: no assets, loops, microphone or remote speech. */
export class TennisSoundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private crowdGain?: GainNode;
  private readonly sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private readonly crowdSources = new Set<AudioScheduledSourceNode>();
  private readonly maxSources = 12;
  private applause?: AudioBuffer;
  private longApplause?: AudioBuffer;
  private gasp?: AudioBuffer;
  private racket?: AudioBuffer;
  private bounce?: AudioBuffer;
  private scuff?: AudioBuffer;
  private enabled = false;
  private dead = false;
  private generation = 0;
  private speech?: SpeechSynthesisUtterance;
  private crowdNeedsQuiet = false;
  private quietRequested = false;
  // Audio variation must never consume the game's random sequence.
  private randomState = 0x6d2b79f5;

  constructor(private readonly browser: Window & typeof globalThis) {}

  async enable(): Promise<boolean> {
    const generation = ++this.generation;
    try {
      if (this.dead) return false;
      this.context ??= new this.browser.AudioContext();
      if (!this.master) {
        this.applause = this.makeCrowdBuffer(false, TENNIS_CROWD_SECONDS.applause);
        this.longApplause = this.makeCrowdBuffer(false, TENNIS_CROWD_SECONDS.longApplause);
        this.gasp = this.makeCrowdBuffer(true, TENNIS_CROWD_SECONDS.gasp);
        this.racket = this.makeCourtBuffer('racket');
        this.bounce = this.makeCourtBuffer('bounce');
        this.scuff = this.makeCourtBuffer('scuff');
        const master = this.context.createGain(), crowd = this.context.createGain();
        master.gain.value = .28;
        crowd.connect(master); master.connect(this.context.destination);
        this.master = master; this.crowdGain = crowd;
      }
      await this.context.resume();
      if (this.dead || generation !== this.generation) return false;
      this.enabled = this.context.state === 'running';
      // Voice discovery is optional and must not disable otherwise-working audio.
      try { this.browser.speechSynthesis?.getVoices(); } catch { /* Visual umpire remains available. */ }
      return this.enabled;
    } catch {
      if (generation === this.generation) { this.enabled = false; this.stop(); }
      return false;
    }
  }

  disable(): void { this.enabled = false; this.stop(); }

  stop(): void {
    this.generation++;
    for (const source of this.sources.keys()) this.stopSource(source);
    this.crowdNeedsQuiet = false;
    this.quietRequested = false;
    const speech = this.speech;
    this.speech = undefined;
    if (speech) {
      speech.onstart = speech.onend = speech.onerror = null;
      try { this.browser.speechSynthesis?.cancel(); } catch { /* Browser may be shutting down. */ }
    }
  }

  effect(event: string | null, rally: number, reason: string | null): void {
    if (!this.enabled || this.dead || !this.context || !this.master || this.context.state !== 'running') return;
    // Unknown/control events must not accidentally sound like a racket strike.
    if (event !== 'hit' && event !== 'serve' && event !== 'bounce' && event !== 'point') return;
    const count = Number.isFinite(rally) ? Math.max(0, rally) : 0;
    if (event === 'point') { this.point(count, reason); return; }
    const isBounce = event === 'bounce';
    // Drop overload instead of queuing it; ball feedback takes priority over crowd layers.
    const required = isBounce ? 2 : 3;
    if (this.sources.size + required > this.maxSources) this.stopCrowd();
    if (this.sources.size + required > this.maxSources) return;
    const context = this.context, now = context.currentTime;
    const variation = .96 + this.random() * .08;
    const body = context.createOscillator(), gain = context.createGain();
    body.type = isBounce ? 'sine' : 'triangle';
    body.frequency.setValueAtTime((isBounce ? 205 : event === 'serve' ? 620 : 540) * variation, now);
    body.frequency.exponentialRampToValueAtTime(isBounce ? 112 : 175, now + .045);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.linearRampToValueAtTime(isBounce ? .12 : event === 'serve' ? .16 : .13, now + .002);
    gain.gain.exponentialRampToValueAtTime(.001, now + (isBounce ? .085 : .065));
    body.connect(gain); gain.connect(this.master);
    this.track(body, [gain]); body.start(now); body.stop(now + .1);
    this.playBuffer(isBounce ? this.bounce! : this.racket!, this.master,
      isBounce ? .07 : event === 'serve' ? .19 : .15,
      (isBounce ? 1250 : 2850) * variation, now, false, variation);
    if (!isBounce) {
      // A restrained shoe/weight-transfer scuff, not an invented continuous footstep track.
      this.playBuffer(this.scuff!, this.master, event === 'serve' ? .026 : .017, 820, now + .035, false, variation);
    }
  }

  hushCrowd(): void {
    if (!this.context || !this.crowdGain) return;
    this.quietRequested = this.crowdNeedsQuiet && this.crowdSources.size > 0;
    this.crowdNeedsQuiet = false;
    const now = this.context.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setTargetAtTime(.001, now, .09);
  }

  quietPlease(): boolean {
    if (!this.enabled || this.dead || this.context?.state !== 'running' || !this.quietRequested) return false;
    this.quietRequested = false;
    try {
      const synth = this.browser.speechSynthesis;
      if (!synth || this.speech || synth.speaking || synth.pending) return false;
      const voice = synth.getVoices().find(v => v.localService && /^en(?:[-_]|$)/i.test(v.lang));
      if (!voice) return false;
      const utterance = new this.browser.SpeechSynthesisUtterance('Quiet, please.');
      utterance.voice = voice; utterance.lang = voice.lang; utterance.volume = .58; utterance.rate = 1.04; utterance.pitch = .88;
      this.speech = utterance;
      const finish = () => {
        if (this.speech === utterance) this.speech = undefined;
        utterance.onstart = utterance.onend = utterance.onerror = null;
      };
      utterance.onend = finish; utterance.onerror = finish;
      synth.speak(utterance);
      return true;
    } catch { this.speech = undefined; return false; }
  }

  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.disable();
    this.crowdGain?.disconnect(); this.master?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = undefined; this.master = undefined; this.crowdGain = undefined;
    this.applause = this.longApplause = this.gasp = this.racket = this.bounce = this.scuff = undefined;
  }

  private point(rally: number, reason: string | null): void {
    this.stopCrowd();
    if (this.sources.size >= this.maxSources) return;
    const now = this.context!.currentTime;
    const subdued = rally < 3 && (reason === 'net' || reason === 'doubleFault');
    const sustained = rally >= 5;
    const buffer = subdued ? this.gasp! : sustained ? this.longApplause! : this.applause!;
    this.crowdGain!.gain.cancelScheduledValues(now);
    this.crowdGain!.gain.setValueAtTime(1, now);
    const volume = (subdued ? .3 : sustained ? .68 : .46) * (.9 + this.random() * .1);
    this.playBuffer(buffer, this.crowdGain!, volume, 3400 + this.random() * 650, now, true, 1 + this.random() * .06);
    this.crowdNeedsQuiet = sustained;
  }

  private playBuffer(buffer: AudioBuffer, destination: AudioNode, volume: number, frequency: number,
    at: number, crowd: boolean, rate: number): void {
    const source = this.context!.createBufferSource(), filter = this.context!.createBiquadFilter(), gain = this.context!.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    filter.type = crowd ? 'lowpass' : 'bandpass';
    filter.frequency.value = frequency; filter.Q.value = .65;
    gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    this.track(source, [filter, gain], crowd);
    source.start(at);
    // Explicit finite stop is also a safety net for browsers with delayed ended events.
    source.stop(at + buffer.duration / rate + .01);
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], crowd = false): void {
    this.sources.set(source, nodes);
    if (crowd) this.crowdSources.add(source);
    source.onended = () => this.release(source);
  }

  private release(source: AudioScheduledSourceNode): void {
    const nodes = this.sources.get(source);
    if (!nodes) return;
    this.sources.delete(source);
    if (this.crowdSources.delete(source) && this.crowdSources.size === 0) {
      this.crowdNeedsQuiet = false; this.quietRequested = false;
    }
    source.onended = null;
    source.disconnect(); nodes.forEach(node => node.disconnect());
  }

  private stopSource(source: AudioScheduledSourceNode): void {
    try { source.stop(); } catch { /* Already ended. */ }
    // Release the whole graph now, even when a suspended context never dispatches ended.
    this.release(source);
  }

  private stopCrowd(): void {
    for (const source of this.crowdSources) this.stopSource(source);
    this.crowdNeedsQuiet = false; this.quietRequested = false;
  }

  private random(): number {
    let value = this.randomState;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.randomState = value;
    return (value >>> 0) / 0x100000000;
  }

  private makeCourtBuffer(kind: 'racket' | 'bounce' | 'scuff'): AudioBuffer {
    const rate = 22050, duration = kind === 'racket' ? .18 : kind === 'bounce' ? .14 : .19;
    const buffer = this.context!.createBuffer(2, Math.ceil(rate * duration), rate);
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    const dryLength = Math.floor(rate * (kind === 'scuff' ? .12 : .065));
    let previous = 0, smooth = 0;
    for (let i = 0; i < dryLength; i++) {
      const time = i / rate, noise = this.random() * 2 - 1;
      smooth = smooth * .72 + noise * .28;
      const texture = kind === 'scuff' ? smooth : noise - previous * .65;
      const attack = Math.min(1, time / (kind === 'scuff' ? .014 : .0008));
      const sample = texture * attack * Math.exp(-time * (kind === 'scuff' ? 34 : kind === 'bounce' ? 95 : 145));
      left[i] += sample * .78; right[i] += sample * .78;
      // Quiet, baked-in early reflections: court space with no live delay/reverb graph.
      const near = i + Math.floor(rate * .023), far = i + Math.floor(rate * .049);
      if (near < left.length) { left[near] += sample * .13; right[near] += sample * .07; }
      if (far < left.length) { left[far] += sample * .04; right[far] += sample * .09; }
      previous = noise;
    }
    return buffer;
  }

  private makeCrowdBuffer(gasp: boolean, duration: number): AudioBuffer {
    const rate = 22050;
    const buffer = this.context!.createBuffer(2, Math.ceil(rate * duration), rate);
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    if (gasp) {
      let breath = 0;
      for (let i = 0; i < left.length; i++) {
        const progress = i / left.length;
        breath = breath * .64 + (this.random() * 2 - 1) * .36;
        const envelope = Math.sin(progress * Math.PI) ** 1.7 * (1 - progress) * .35;
        left[i] = breath * envelope; right[i] = breath * envelope * .93;
      }
    } else {
      // Independent, irregular hands avoid a metronomic clapping loop or synthetic vocal choir.
      for (let listener = 0; listener < 12; listener++) {
        const pan = this.random(), leftLevel = Math.sqrt(1 - pan), rightLevel = Math.sqrt(pan);
        for (let time = .025 + this.random() * .2; time < duration - .08; time += .18 + this.random() * .24) {
          const start = Math.floor(time * rate);
          const fade = Math.min(1, time / .2) * Math.min(1, (duration - time) / .65);
          const level = (.13 + this.random() * .13) * fade;
          for (let i = 0; i < 900 && start + i < left.length; i++) {
            const sample = (this.random() * 2 - 1) * Math.exp(-i / 105) * level;
            left[start + i] += sample * leftLevel; right[start + i] += sample * rightLevel;
          }
        }
      }
    }
    return buffer;
  }
}
