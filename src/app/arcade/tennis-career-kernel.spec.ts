import { ARCADE_PRIOR, arcadeRandom, conservativeSkill, opponentStrength, opponentGameMu, updateArcadeRating } from './tennis-skill';
import { Tennis3DEngine, CourtControls } from './tennis-3d-engine';
import { ArcadeRecorder, applyArcadeCommand, replayArcade, quantizedStep } from './tennis-replay';

describe('Separate arcade rating and verified replay', () => {
  const none: CourtControls = { left:false, right:false, forward:false, back:false, jump:false, shot:null };
  it('keeps a fixed prior and maps real TS monotonically to a bounded game level', () => {
    expect(ARCADE_PRIOR.mu).toBe(25); expect(ARCADE_PRIOR.sigma).toBeCloseTo(8.33333,4);
    expect(conservativeSkill(ARCADE_PRIOR)).toBeCloseTo(0,8);
    expect(opponentStrength(10)).toBe(0); expect(opponentStrength(25)).toBe(.4); expect(opponentStrength(50)).toBe(1);
    expect(opponentGameMu(40)).toBe(35);
    expect(opponentStrength(-1)).toBe(0);expect(opponentStrength(0)).toBe(0);
    for (const ts of [-101,NaN,Infinity,101]) expect(() => opponentStrength(ts)).toThrow();
  });
  it('rewards an unexpected win more without modifying the opponent or prior', () => {
    const prior = {...ARCADE_PRIOR};
    const easy = updateArcadeRating(prior,15,true), hard = updateArcadeRating(prior,35,true), lost = updateArcadeRating(prior,15,false);
    expect(hard.mu).toBeGreaterThan(easy.mu); expect(easy.mu).toBeGreaterThan(25); expect(lost.mu).toBeLessThan(25);
    expect(hard.sigma).toBeLessThan(prior.sigma); expect(hard.played).toBe(1); expect(hard.won).toBe(1);
    expect(prior).toEqual({...ARCADE_PRIOR}); expect(() => updateArcadeRating({...prior,won:2},25,true)).toThrow();
  });
  it('preserves delayed reaction even for the strongest opponent', () => {
    const easy = new Tennis3DEngine(), hard = new Tennis3DEngine(); easy.opponentStrength=0; hard.opponentStrength=1;
    const a=(easy as any).cpuConfig, b=(hard as any).cpuConfig;
    expect(b.speed).toBeGreaterThan(a.speed); expect(b.delay).toBeCloseTo(.2,8); expect(b.error).toBeLessThan(a.error);
    expect(easy.assist).toBe(hard.assist); expect(easy.players[0]).toEqual(hard.players[0]);
  });
  it('repeats random sequences exactly and rejects invalid seeds', () => {
    const a=arcadeRandom(123), b=arcadeRandom(123); for(let i=0;i<100;i++) expect(a()).toBe(b());
    expect(() => arcadeRandom(-1)).toThrow(); expect(() => arcadeRandom(.1)).toThrow();
  });
  it('reconstructs a complete challenge from inputs, including service commands', () => {
    const game=new Tennis3DEngine(arcadeRandom(417),'challenge'), recorder=new ArcadeRecorder();
    game.opponentStrength=.63; game.start('clay','normal','challenge'); let serveFrames=0;
    for(let i=0;i<20000 && game.phase!=='over';i++) {
      const input={...none};
      if(game.phase==='serving' && game.server===0) {
        if(serveFrames===0) { recorder.command(1); applyArcadeCommand(game,1); recorder.command(3); applyArcadeCommand(game,3); recorder.command(8); applyArcadeCommand(game,8); }
        input.shot=serveFrames++<8?'drive':null;
      } else serveFrames=0;
      const dt=quantizedStep(.016667); recorder.capture(dt,input); game.update(dt,input);
      if(game.phase==='point' || game.phase==='fault' || game.phase==='let') { recorder.command(2); applyArcadeCommand(game,2); }
    }
    expect(game.phase).toBe('over');
    const bytes=recorder.exportBytes(), replay=replayArcade(bytes,{seed:417,strength:.63,surface:'clay'});
    expect(replay.winner).toBe(game.winner!); expect(replay.score).toEqual([...game.score]); expect(replay.bestRally).toBe(game.bestRally);
    expect(() => replayArcade(bytes.slice(0,7),{seed:417,strength:.63,surface:'clay'})).toThrow();
    const extra=new Uint8Array(bytes.length+7);extra.set(bytes);expect(() => replayArcade(extra,{seed:417,strength:.63,surface:'clay'})).toThrow();
  });
  it('rejects malformed frame controls, commands and invalid durations', () => {
    const config={seed:1,strength:.5,surface:'grass' as const};
    for(const frame of [[255,255,0,0,0,0,0],[1,0,32,0,0,0,0],[1,0,0,32,0,0,0],[1,0,0,0,9,0,0],[1,0,0,0,16,0,0]])
      expect(() => replayArcade(new Uint8Array(frame),config)).toThrow();
    const recorder=new ArcadeRecorder();for(const command of [1,2,3,4,5,1,2] as const)recorder.command(command);
    recorder.capture(.01,none);expect(() => recorder.exportBytes()).toThrow();
  });
  it('replays charged strokes, integrated aim and release timing without trusting client scores',()=>{
    const game=new Tennis3DEngine(arcadeRandom(913),'challenge'),recorder=new ArcadeRecorder();
    game.opponentStrength=.6;game.start('hard','normal','challenge');let frames=0,serveFrames=0;
    for(let i=0;i<20000&&game.phase!=='over';i++){
      const input:CourtControls={...none};
      if(game.phase==='serving'&&game.server===0){
        if(!serveFrames){recorder.command(1);applyArcadeCommand(game,1);}
        input.shot=serveFrames++<20?'drive':null;
      }else serveFrames=0;
      if(game.phase==='playing'){
        // Repeat human-like half-second charges followed by releases; no physics mutation.
        const held=frames++%45<26;input.shot=held?(Math.floor(frames/45)%2?'drop':'smash'):null;input.aiming=held;input.right=held&&frames%90<20;
      }
      recorder.capture(.02,input);game.update(.02,input);
      if(['point','fault','let'].includes(game.phase)){recorder.command(2);applyArcadeCommand(game,2);frames=0;}
    }
    expect(game.phase).toBe('over');expect(game.hits).toBeGreaterThan(0);
    const result=replayArcade(recorder.exportBytes(),{seed:913,strength:.6,surface:'hard'});
    expect(result.score).toEqual([...game.score]);expect(result.winner).toBe(game.winner!);expect(result.bestRally).toBe(game.bestRally);
  });
  it('encodes a charged drop without changing frame length, movement, aim or commands',()=>{
    const recorder=new ArcadeRecorder();recorder.command(1);recorder.capture(.02,{...none,shot:'drop',aiming:true,left:true,aim:-1});
    const frame=recorder.exportBytes();expect(frame.length).toBe(7);expect(frame[2]).toBe(1);expect(frame[3]).toBe(52);expect(frame[4]).toBe(1);
    // Extended codes 5–7 are never accepted as a different shot.
    for(const invalid of [33,34,35,64,255])expect(()=>replayArcade(new Uint8Array([1,0,0,invalid,0,0,0]),{seed:1,strength:.5,surface:'grass'})).toThrowError('Invalid replay controls');
  });
  it('records all depth commands without changing replay frame size or the trusted score',()=>{
    const game=new Tennis3DEngine(()=>.5);game.start();const recorder=new ArcadeRecorder();
    for(const command of [6,8,7] as const){recorder.command(command);applyArcadeCommand(game,command);expect(game.serveDepth).toBe(command-7);}
    recorder.capture(.02,none);const frame=recorder.exportBytes();
    expect(frame.length).toBe(7);expect(frame[4]).toBe(6|(8<<4));expect(frame[5]).toBe(7);expect(game.score).toEqual([0,0]);
  });
});
