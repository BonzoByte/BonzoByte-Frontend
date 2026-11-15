import { TennisSoundscape } from './tennis-soundscape';
import { TENNIS_CROWD_SECONDS } from './tennis-atmosphere';

describe('Tennis soundscape contracts and lifecycle', () => {
  let sound: TennisSoundscape, context: any, browser: any, synth: any;
  let sources: any[], allNodes: any[], buffers: any[];
  const parameter = () => ({
    value: 0, cancelScheduledValues: jasmine.createSpy(), setTargetAtTime: jasmine.createSpy(),
    setValueAtTime: jasmine.createSpy(), linearRampToValueAtTime: jasmine.createSpy(),
    exponentialRampToValueAtTime: jasmine.createSpy()
  });
  const node = (kind: string) => {
    const created = {
      kind, connect: jasmine.createSpy(), disconnect: jasmine.createSpy(),
      start: jasmine.createSpy(), stop: jasmine.createSpy(), gain: parameter(),
      frequency: parameter(), Q: parameter(), playbackRate: parameter(), loop: false, onended: null
    };
    allNodes.push(created);
    return created;
  };
  const activeSources = () => sources.filter(source => source.onended !== null);
  const requestQuiet = () => { sound.effect('point', 6, 'bounce'); sound.hushCrowd(); };
  const makeBuffer = (channels: number, length: number, rate: number) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const buffer = { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (channel: number) => data[channel] };
    buffers.push(buffer); return buffer;
  };

  beforeEach(() => {
    sources = []; allNodes = []; buffers = [];
    const source = (kind: string) => { const created = node(kind); sources.push(created); return created; };
    context = {
      currentTime: 2, state: 'running', destination: {},
      resume: jasmine.createSpy().and.resolveTo(), close: jasmine.createSpy().and.resolveTo(),
      createGain: jasmine.createSpy().and.callFake(() => node('gain')),
      createBiquadFilter: jasmine.createSpy().and.callFake(() => node('filter')),
      createBuffer: jasmine.createSpy().and.callFake(makeBuffer),
      createBufferSource: jasmine.createSpy().and.callFake(() => source('buffer')),
      createOscillator: jasmine.createSpy().and.callFake(() => source('oscillator'))
    };
    synth = {
      speaking: false, pending: false, speak: jasmine.createSpy(), cancel: jasmine.createSpy(),
      getVoices: jasmine.createSpy().and.returnValue([
        { name: 'English remote', lang: 'en-GB', localService: false },
        { name: 'English local', lang: 'en-US', localService: true }
      ])
    };
    browser = {
      AudioContext: jasmine.createSpy().and.callFake(function() { return context; }),
      speechSynthesis: synth,
      SpeechSynthesisUtterance: class { constructor(public text: string) {} }
    };
    sound = new TennisSoundscape(browser);
  });
  afterEach(() => sound.dispose());

  it('does not allocate audio, timers or speech before an explicit enabling gesture', () => {
    sound.effect('point', 6, 'bounce'); sound.effect('serve', 0, null); sound.hushCrowd(); sound.stop();
    expect(sound.quietPlease()).toBeFalse();
    expect(browser.AudioContext).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('resumes only on request and keeps a small finite stereo buffer cache', async () => {
    expect(await sound.enable()).toBeTrue();
    expect(browser.AudioContext).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(2);
    expect(context.createBuffer).toHaveBeenCalledTimes(6);
    expect(sources.length).toBe(0);
    expect(buffers.every(buffer => buffer.numberOfChannels === 2 && buffer.sampleRate === 22050)).toBeTrue();
    expect(buffers.reduce((bytes, buffer) => bytes + buffer.length * buffer.numberOfChannels * 4, 0)).toBeLessThan(1024 * 1024);
  });

  it('reuses its context, idle gain nodes and buffer cache across Sound toggles', async () => {
    await sound.enable(); sound.disable(); await sound.enable();
    expect(browser.AudioContext).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.createBuffer).toHaveBeenCalledTimes(6);
    expect(context.createGain).toHaveBeenCalledTimes(2);
    expect(sources.length).toBe(0);
  });

  it('layers a damped racket body, contact and restrained shoe scuff with finite stops', async () => {
    await sound.enable(); sound.effect('hit', 2, null);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
    expect(sources[0].type).toBe('triangle');
    expect(sources[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(175, 2.045);
    expect(sources[2].start).toHaveBeenCalledWith(2.035);
    for (const source of sources) {
      expect(source.loop).toBeFalse();
      expect(source.start).toHaveBeenCalledTimes(1);
      expect(source.stop).toHaveBeenCalledTimes(1);
      const deadline = source.stop.calls.mostRecent().args[0];
      expect(Number.isFinite(deadline)).toBeTrue();
      expect(deadline).toBeLessThan(2.25);
    }
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('uses a stronger, higher serve without changing the public effect signature', async () => {
    await sound.enable(); sound.effect('hit', 1, null);
    const hitFrequency = sources[0].frequency.setValueAtTime.calls.first().args[0];
    sound.stop(); sound.effect('serve', 0, null);
    const serve = sources[3];
    expect(serve.frequency.setValueAtTime.calls.first().args[0]).toBeGreaterThan(hitFrequency);
    expect(serve.type).toBe('triangle');
    expect(sources.length).toBe(6);
  });

  it('gives bounces a lower rounded body and dull contact without a shoe layer', async () => {
    await sound.enable(); sound.effect('bounce', 2, null);
    expect(sources.length).toBe(2);
    expect(sources[0].type).toBe('sine');
    expect(sources[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(112, 2.045);
    expect(sources[1].buffer.duration).toBeCloseTo(.14, 4);
  });

  it('varies repeated strikes without allocating more buffers or consuming gameplay randomness', async () => {
    const random = spyOn(Math, 'random').and.returnValue(.5);
    await sound.enable(); sound.effect('hit', 1, null);
    const first = sources[0].frequency.setValueAtTime.calls.first().args[0], buffer = sources[1].buffer;
    sound.stop(); sound.effect('hit', 1, null);
    expect(sources[3].frequency.setValueAtTime.calls.first().args[0]).not.toBe(first);
    expect(sources[4].buffer).toBe(buffer);
    expect(context.createBuffer).toHaveBeenCalledTimes(6);
    expect(random).not.toHaveBeenCalled();
  });

  it('does not turn null, let, fault or unknown events into racket sounds', async () => {
    await sound.enable();
    for (const event of [null, 'let', 'fault', 'ready', 'footstep', 'anything']) sound.effect(event, 0, null);
    expect(sources.length).toBe(0);
  });

  it('uses one finite stereo applause response for a long rally, not a live vocal choir', async () => {
    await sound.enable(); sound.effect('point', 6, 'bounce');
    expect(sources.length).toBe(1);
    expect(context.createOscillator).not.toHaveBeenCalled();
    const crowd = sources[0];
    expect(crowd.buffer.duration).toBeCloseTo(TENNIS_CROWD_SECONDS.longApplause, 4);
    expect(crowd.playbackRate.value).toBeGreaterThanOrEqual(1);
    expect(crowd.playbackRate.value).toBeLessThanOrEqual(1.06);
    expect(crowd.stop.calls.mostRecent().args[0]).toBeLessThanOrEqual(5.21);
    const right = crowd.buffer.getChannelData(1);
    expect(crowd.buffer.getChannelData(0).some((sample: number, index: number) => sample !== right[index])).toBeTrue();
  });

  it('keeps early net errors and double faults subdued instead of celebrating them', async () => {
    await sound.enable(); sound.effect('point', 0, 'net');
    expect(sources[0].buffer.duration).toBeCloseTo(TENNIS_CROWD_SECONDS.gasp, 4);
    sound.effect('point', 0, 'doubleFault');
    expect(sources[1].buffer).toBe(sources[0].buffer);
    sound.effect('point', 1, 'bounce');
    expect(sources[2].buffer.duration).toBeCloseTo(TENNIS_CROWD_SECONDS.applause, 4);
  });

  it('treats non-finite rally counts as short points, not extended cheering', async () => {
    await sound.enable();
    for (const rally of [NaN, Infinity, -Infinity, -1]) {
      sound.effect('point', rally, 'bounce'); sound.hushCrowd();
      expect(sound.quietPlease()).toBeFalse();
      expect(sources[sources.length - 1].buffer.duration).toBeCloseTo(TENNIS_CROWD_SECONDS.applause, 4);
    }
  });

  it('varies applause and replaces previous crowd graphs instead of stacking responses', async () => {
    await sound.enable(); sound.effect('point', 6, 'bounce');
    const first = sources[0], firstRate = first.playbackRate.value;
    const firstGraph = [...(sound as any).sources.get(first)];
    for (let i = 0; i < 40; i++) sound.effect('point', 6, 'bounce');
    expect(activeSources().length).toBe(1);
    expect(sources[1].playbackRate.value).not.toBe(firstRate);
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    for (const node of firstGraph) expect(node.disconnect).toHaveBeenCalledTimes(1);
    expect(context.createBuffer).toHaveBeenCalledTimes(6);
  });

  it('hushes only crowd gain and never interrupts ball sounds or initiates speech itself', async () => {
    await sound.enable(); sound.effect('hit', 2, null); sound.effect('point', 6, 'bounce');
    sound.hushCrowd();
    expect((sound as any).crowdGain.gain.setTargetAtTime).toHaveBeenCalledWith(.001, 2, .09);
    expect((sound as any).master.gain.setTargetAtTime).not.toHaveBeenCalled();
    for (const source of sources.slice(0, 3)) {
      expect(source.disconnect).not.toHaveBeenCalled();
      expect(source.stop).toHaveBeenCalledTimes(1);
    }
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('restores crowd gain for a new point after a hush', async () => {
    await sound.enable(); requestQuiet(); sound.effect('point', 1, 'bounce');
    const gain = (sound as any).crowdGain.gain;
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(2);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(1, 2);
    expect(sound.quietPlease()).toBeFalse();
  });

  it('caps burst feedback at twelve source graphs and never queues overload', async () => {
    await sound.enable();
    for (let i = 0; i < 60; i++) sound.effect('hit', i, null);
    expect(sources.length).toBe(12);
    expect(activeSources().length).toBe(12);
    sources[0].onended();
    sources[1].onended();
    sources[2].onended();
    sound.effect('hit', 61, null);
    expect(sources.length).toBe(15);
    expect(activeSources().length).toBe(12);
    expect(context.createBuffer).toHaveBeenCalledTimes(6);
  });

  it('evicts crowd before dropping ball feedback at the source cap', async () => {
    await sound.enable(); sound.effect('point', 6, 'bounce');
    const crowd = sources[0];
    for (let i = 0; i < 4; i++) sound.effect('hit', i, null);
    expect(crowd.disconnect).toHaveBeenCalledTimes(1);
    expect(activeSources().length).toBe(12);
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
  });

  it('releases every source, filter and envelope immediately on stop without ended callbacks', async () => {
    await sound.enable(); sound.effect('hit', 2, null); requestQuiet();
    const graph = new Map<any, any[]>((sound as any).sources);
    const staleEnded = sources[0].onended;
    context.state = 'suspended';
    sound.stop(); sound.stop(); staleEnded();
    expect(activeSources().length).toBe(0);
    expect((sound as any).sources.size).toBe(0);
    for (const [source, nodes] of graph) {
      expect(source.stop).toHaveBeenCalledTimes(2);
      expect(source.disconnect).toHaveBeenCalledTimes(1);
      for (const node of nodes) expect(node.disconnect).toHaveBeenCalledTimes(1);
    }
    expect(sound.quietPlease()).toBeFalse();
  });

  it('releases natural ended graphs once and tolerates an already-ended source on stop', async () => {
    await sound.enable(); sound.effect('bounce', 1, null);
    const first = sources[0], graph = [...(sound as any).sources.get(first)];
    const ended = first.onended; ended(); ended();
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    for (const node of graph) expect(node.disconnect).toHaveBeenCalledTimes(1);
    sources[1].stop.and.throwError('Already ended');
    expect(() => sound.stop()).not.toThrow();
    expect(sources[1].disconnect).toHaveBeenCalledTimes(1);
    expect((sound as any).sources.size).toBe(0);
  });

  it('stops on mute and prevents any further effects until explicitly re-enabled', async () => {
    await sound.enable(); requestQuiet(); sound.disable();
    const count = sources.length;
    sound.effect('hit', 1, null); sound.effect('point', 6, 'bounce');
    expect(sources.length).toBe(count);
    expect(activeSources().length).toBe(0);
    expect(sound.quietPlease()).toBeFalse();
    await sound.enable(); sound.effect('bounce', 1, null);
    expect(sources.length).toBe(count + 2);
  });

  it('preserves the Sound opt-in across stop so component resume needs no new enabling call', async () => {
    await sound.enable(); sound.effect('hit', 1, null); sound.stop();
    sound.effect('bounce', 1, null);
    expect(activeSources().length).toBe(2);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('does not emit effects or speech when the audio context is suspended', async () => {
    await sound.enable(); requestQuiet(); const count = sources.length; context.state = 'suspended';
    sound.effect('hit', 1, null);
    expect(sound.quietPlease()).toBeFalse();
    expect(sources.length).toBe(count);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('requires an active sustained crowd and an explicit hush before requesting quiet', async () => {
    await sound.enable();
    expect(sound.quietPlease()).toBeFalse();
    sound.hushCrowd(); expect(sound.quietPlease()).toBeFalse();
    sound.effect('point', 1, 'bounce'); sound.hushCrowd(); expect(sound.quietPlease()).toBeFalse();
    sound.effect('point', 0, 'net'); sound.hushCrowd(); expect(sound.quietPlease()).toBeFalse();
    sound.effect('point', 6, 'bounce'); expect(sound.quietPlease()).toBeFalse();
    sources[sources.length - 1].onended(); sound.hushCrowd();
    expect(sound.quietPlease()).toBeFalse();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('selects only a local English voice and speaks at most once per hush', async () => {
    await sound.enable(); requestQuiet();
    expect(sound.quietPlease()).toBeTrue();
    const utterance = synth.speak.calls.mostRecent().args[0];
    expect(utterance.text).toBe('Quiet, please.');
    expect(utterance.voice.localService).toBeTrue();
    expect(utterance.lang).toBe('en-US');
    expect(sound.quietPlease()).toBeFalse();
    sound.hushCrowd(); expect(sound.quietPlease()).toBeFalse();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('accepts a local English voice with an unqualified language code', async () => {
    synth.getVoices.and.returnValue([{ lang: 'en', localService: true }]);
    await sound.enable(); requestQuiet(); expect(sound.quietPlease()).toBeTrue();
  });

  it('retains visual-only umpire support when no local English voice is available', async () => {
    synth.getVoices.and.returnValue([{ lang: 'en-GB', localService: false }, { lang: 'hr-HR', localService: true }]);
    await sound.enable(); requestQuiet();
    expect(sound.quietPlease()).toBeFalse();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  for (const busy of ['speaking', 'pending']) {
    it('does not interrupt or enqueue behind another ' + busy + ' message', async () => {
      await sound.enable(); requestQuiet(); synth[busy] = true;
      expect(sound.quietPlease()).toBeFalse();
      sound.stop();
      expect(synth.speak).not.toHaveBeenCalled();
      expect(synth.cancel).not.toHaveBeenCalled();
    });
  }

  it('does not enqueue a second owned call even before the browser reports speech pending', async () => {
    await sound.enable(); requestQuiet(); expect(sound.quietPlease()).toBeTrue();
    requestQuiet(); expect(sound.quietPlease()).toBeFalse();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('cancels its own queued call on stop even if the browser has not reported pending yet', async () => {
    await sound.enable(); requestQuiet(); sound.quietPlease();
    const utterance = synth.speak.calls.mostRecent().args[0];
    sound.stop(); sound.disable();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(utterance.onend).toBeNull();
    expect(utterance.onerror).toBeNull();
  });

  for (const finish of ['onend', 'onerror']) {
    it('relinquishes speech ownership on ' + finish + ' without canceling later speech', async () => {
      await sound.enable(); requestQuiet(); sound.quietPlease();
      const utterance = synth.speak.calls.mostRecent().args[0];
      utterance[finish](); synth.speaking = true; sound.stop();
      expect(synth.cancel).not.toHaveBeenCalled();
    });
  }

  it('keeps working audio when voice discovery or speech fails', async () => {
    synth.getVoices.and.throwError('Voice inventory unavailable');
    expect(await sound.enable()).toBeTrue(); requestQuiet();
    expect(sound.quietPlease()).toBeFalse();
    synth.getVoices.and.returnValue([{ lang: 'en-US', localService: true }]);
    synth.speak.and.throwError('Speech unavailable');
    requestQuiet(); expect(sound.quietPlease()).toBeFalse();
    sound.stop(); sound.effect('hit', 1, null);
    expect(activeSources().length).toBe(3);
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  for (const action of ['disable', 'stop', 'dispose'] as const) {
    it('does not activate after a pending resume completes following ' + action, async () => {
      let finish!: () => void;
      context.resume.and.returnValue(new Promise<void>(resolve => finish = resolve));
      const enabling = sound.enable(); sound[action](); finish();
      expect(await enabling).toBeFalse();
      sound.effect('hit', 1, null);
      expect(sources.length).toBe(0);
      expect(sound.quietPlease()).toBeFalse();
    });
  }

  it('does not let an older failed resume mute a more recent successful enable', async () => {
    let fail!: (reason: Error) => void;
    context.resume.and.returnValues(new Promise<void>((_resolve, reject) => fail = reject), Promise.resolve());
    const older = sound.enable(); expect(await sound.enable()).toBeTrue();
    fail(new Error('Stale resume')); expect(await older).toBeFalse();
    sound.effect('bounce', 1, null);
    expect(activeSources().length).toBe(2);
  });

  it('recovers from a rejected audio resume on a later explicit request', async () => {
    context.resume.and.rejectWith(new Error('Gesture required'));
    expect(await sound.enable()).toBeFalse();
    sound.effect('hit', 1, null); expect(sources.length).toBe(0);
    context.resume.and.resolveTo();
    expect(await sound.enable()).toBeTrue();
    sound.effect('hit', 1, null); expect(sources.length).toBe(3);
  });

  it('can retry partial buffer preparation without leaving a connected graph', async () => {
    context.createBuffer.and.throwError('Temporarily unavailable');
    expect(await sound.enable()).toBeFalse();
    expect(context.createGain).not.toHaveBeenCalled();
    context.createBuffer.and.callFake(makeBuffer);
    expect(await sound.enable()).toBeTrue();
    sound.effect('hit', 1, null); expect(activeSources().length).toBe(3);
  });

  it('reports failure if resume resolves but the audio context remains suspended', async () => {
    context.state = 'suspended';
    expect(await sound.enable()).toBeFalse();
    sound.effect('hit', 1, null); expect(sources.length).toBe(0);
  });

  it('handles unsupported audio or missing speech APIs without breaking play', async () => {
    const unsupported = new TennisSoundscape({} as any);
    expect(await unsupported.enable()).toBeFalse();
    expect(() => unsupported.effect('point', 6, 'net')).not.toThrow();
    unsupported.dispose();
    browser.speechSynthesis = undefined;
    expect(await sound.enable()).toBeTrue(); requestQuiet();
    expect(sound.quietPlease()).toBeFalse();
  });

  it('disconnects persistent nodes, drops cached buffers and closes only once on destruction', async () => {
    await sound.enable(); requestQuiet(); sound.quietPlease();
    const master = (sound as any).master, crowd = (sound as any).crowdGain;
    sound.dispose(); sound.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(master.disconnect).toHaveBeenCalledTimes(1);
    expect(crowd.disconnect).toHaveBeenCalledTimes(1);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(activeSources().length).toBe(0);
    for (const key of ['context', 'master', 'crowdGain', 'applause', 'longApplause', 'gasp', 'racket', 'bounce', 'scuff']) {
      expect((sound as any)[key]).toBeUndefined();
    }
    expect(await sound.enable()).toBeFalse();
    sound.effect('hit', 1, null); expect(activeSources().length).toBe(0);
  });
});
