/** Small browser-generated effects; no recordings, downloads, microphone or remote speech. */
export class TennisSoundscape {
  private context?: AudioContext;
  private master?: GainNode;
  private crowdGain?: GainNode;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private applause?: AudioBuffer;
  private longApplause?: AudioBuffer;
  private gasp?: AudioBuffer;
  private enabled = false;
  private dead = false;
  private generation = 0;
  private speech?: SpeechSynthesisUtterance;
  private speechStarted = false;
  constructor(private readonly browser: Window & typeof globalThis) {}
  async enable(): Promise<boolean> {
    const generation = ++this.generation;
    try {
      if (this.dead) return false;
      this.context ??= new this.browser.AudioContext();
      if (!this.master) {
        this.master = this.context.createGain(); this.master.gain.value = .28; this.master.connect(this.context.destination);
        this.crowdGain = this.context.createGain(); this.crowdGain.connect(this.master);
        this.applause = this.makeCrowdBuffer(false); this.longApplause = this.makeCrowdBuffer(false, 3.2); this.gasp = this.makeCrowdBuffer(true);
      }
      await this.context.resume();
      if (this.dead || generation !== this.generation) return false;
      this.enabled = this.context.state === 'running';
      // Ask for the local voice inventory on the enabling gesture, without speaking yet.
      this.browser.speechSynthesis?.getVoices();
      return this.enabled;
    } catch { this.enabled = false; return false; }
  }
  disable(): void { this.generation++; this.enabled = false; this.stop(); }
  stop(): void {
    for (const source of this.sources) { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); }
    this.sources.clear();
    if (this.speech && (this.speechStarted || this.browser.speechSynthesis?.pending)) this.browser.speechSynthesis?.cancel();
    this.speech = undefined; this.speechStarted = false;
  }
  effect(event: string | null, rally: number, reason: string | null): void {
    if (!this.enabled || this.dead || !this.context || !this.master || this.context.state !== 'running') return;
    const context = this.context, now = context.currentTime;
    if (!event || event === 'let' || event === 'fault') return;
    if (event === 'point') {
      this.crowdGain!.gain.cancelScheduledValues(now); this.crowdGain!.gain.setValueAtTime(1, now);
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = (reason === 'net' && rally < 3 ? this.gasp : rally >= 5 ? this.longApplause : this.applause) ?? null;
      gain.gain.value = rally > 5 ? .85 : .57;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 4300;
      source.connect(filter); filter.connect(gain); gain.connect(this.crowdGain!); this.track(source, [filter, gain]); source.start();
      if (rally >= 3) this.cheer(now);
      return;
    }
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(event === 'bounce' ? 190 : event === 'serve' ? 390 : 460, now);
    gain.gain.setValueAtTime(.11, now); gain.gain.exponentialRampToValueAtTime(.001, now + .065);
    oscillator.connect(gain); gain.connect(this.master); this.track(oscillator, [gain]); oscillator.start(now); oscillator.stop(now + .075);
  }
  hushCrowd(): void {
    if (!this.context || !this.crowdGain) return;
    const now = this.context.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now); this.crowdGain.gain.setTargetAtTime(.001, now, .09);
  }
  quietPlease(): boolean {
    if (!this.enabled || this.dead) return false;
    try {
      const synth = this.browser.speechSynthesis;
      if (!synth || synth.speaking || synth.pending) return false;
      const voice = synth.getVoices().find(v => v.localService && /^en(?:-|_)/i.test(v.lang));
      if (!voice) return false;
      const utterance = new this.browser.SpeechSynthesisUtterance('Quiet, please.');
      utterance.voice = voice; utterance.lang = voice.lang; utterance.volume = .58; utterance.rate = 1.04; utterance.pitch = .88;
      this.speech = utterance;
      utterance.onstart = () => { if (this.speech === utterance) this.speechStarted = true; };
      const finish = () => { if (this.speech === utterance) { this.speech = undefined; this.speechStarted = false; } };
      utterance.onend = finish; utterance.onerror = finish; synth.speak(utterance); return true;
    } catch { return false; }
  }
  dispose(): void { if (this.dead) return; this.dead = true; this.disable(); void this.context?.close().catch(() => undefined); }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
  }
  private cheer(now: number): void {
    if (!this.context || !this.master) return;
    for (let i = 0; i < 5; i++) {
      const voice = this.context.createOscillator(), gain = this.context.createGain(), filter = this.context.createBiquadFilter();
      const at = now + .04 * i; voice.type = 'sawtooth'; voice.frequency.setValueAtTime(115 + i * 19, at);
      voice.frequency.exponentialRampToValueAtTime(145 + i * 21, at + .22);
      filter.type = 'bandpass'; filter.frequency.value = 650 + i * 100; filter.Q.value = 1.7;
      gain.gain.setValueAtTime(.001, at); gain.gain.linearRampToValueAtTime(.027, at + .12); gain.gain.exponentialRampToValueAtTime(.001, at + .78);
      voice.connect(filter); filter.connect(gain); gain.connect(this.crowdGain!); this.track(voice, [filter, gain]); voice.start(at); voice.stop(at + .8);
    }
  }
  private makeCrowdBuffer(gasp: boolean, duration = 1.18): AudioBuffer {
    const rate = 22050, length = gasp ? .7 : duration;
    const buffer = this.context!.createBuffer(1, Math.ceil(rate * length), rate), data = buffer.getChannelData(0);
    // Brief overlapping bursts resemble many hands clapping; a smoother envelope gives a collective intake of breath.
    for (let i = 0; i < data.length; i++) {
      const t = i / rate, fade = Math.max(0, 1 - t / length) ** 1.4;
      const claps = Math.max(0, Math.sin(t * 89) * Math.sin(t * 41 + .8)) ** 6;
      const envelope = gasp ? Math.sin(t / length * Math.PI) ** 1.6 * .35 : (.11 + claps * .7) * Math.min(1, t * 18);
      data[i] = (Math.random() * 2 - 1) * envelope * fade;
    }
    return buffer;
  }
}
