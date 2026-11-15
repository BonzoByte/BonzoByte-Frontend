import { CourtControls, FIELD, Tennis3DEngine } from './tennis-3d-engine';
import { arcadeRandom } from './tennis-skill';
const idle: CourtControls={left:false,right:false,forward:false,back:false,jump:false,shot:null};
const hold: CourtControls={...idle,shot:'drive',aiming:true};
describe('Charged strokes and bounce-aware returns',()=>{
  let game:Tennis3DEngine;
  const advance=(seconds:number,input=idle)=>{for(let i=0;i<Math.round(seconds*120);i++)game.update(1/120,input);};
  const incoming=()=>{
    Object.assign(game,{hitter:1,crossed:true,bounces:1,serviceActive:false});game.players[0].x=0;game.players[0].z=10.8;game.players[0].swing=0;
    game.ball={x:.2,y:1.2,z:10.5,vx:0,vy:0,vz:0};
  };
  beforeEach(()=>{game=new Tennis3DEngine(()=>.5);game.start();game.strikeServe();game.assist=false;});
  it('holds without striking, then releases exactly once',()=>{
    advance(.25,hold);expect(game.hits).toBe(0);expect(game.strokeCharge).toBeCloseTo(.25/.9,4);
    incoming();game.update(1/120,idle);expect(game.hits).toBe(1);expect(game.strokeCharging).toBeFalse();
    incoming();game.update(1/120,idle);expect(game.hits).toBe(1);
  });
  it('increases speed and depth as charge increases inside the green zone',()=>{
    incoming();game.hit(0,'drive',0,.15);const softSpeed=Math.abs(game.ball.vz),softDepth=Math.abs(game.landing().z);
    incoming();game.hit(0,'drive',0,.9);expect(Math.abs(game.ball.vz)).toBeGreaterThan(softSpeed*1.2);expect(Math.abs(game.landing().z)).toBeGreaterThan(softDepth);
    expect(Math.abs(game.landing().z)).toBeLessThan(FIELD.halfLength);
  });
  it('places a drop shot short instead of reusing the drive trajectory',()=>{
    incoming();game.hit(0,'drive',.5,.6);const drive=game.landing();
    incoming();game.hit(0,'drop',.5,.6);const drop=game.landing();
    expect(drop.x).toBeCloseTo(drive.x,5);expect(Math.abs(drop.z)).toBeLessThan(4);expect(Math.abs(drop.z)).toBeLessThan(Math.abs(drive.z)*.5);
  });
  it('uses lower, slower first bounces for drops on every surface',()=>{
    for(const surface of ['grass','clay','hard'] as const){
      const bounce=(shot:'drive'|'drop')=>{
        game.start(surface);game.strikeServe();incoming();game.hit(0,shot,0,.6);
        Object.assign(game,{crossed:true,bounces:0});game.players[1].x=5;game.players[1].z=-12;
        game.ball={x:0,y:.07,z:-3,vx:2,vy:-2,vz:-4};game.update(1/120,idle);return {...game.ball};
      };
      const drive=bounce('drive'),drop=bounce('drop');expect(drop.vy).toBeGreaterThan(0);expect(drop.vy).toBeLessThan(drive.vy*.7);expect(Math.abs(drop.vz)).toBeLessThan(Math.abs(drive.vz)*.6);
    }
  });
  it('resets drop backspin for a subsequent ordinary stroke and new serves',()=>{
    incoming();game.hit(0,'drop');expect((game as any).dropShot).toBeTrue();incoming();game.hit(0,'drive');expect((game as any).dropShot).toBeFalse();
    incoming();game.hit(0,'drop');game.start();game.strikeServe();expect((game as any).dropShot).toBeFalse();
  });
  it('keeps the established red power and direction rules for drops',()=>{
    incoming();game.hit(0,'drop',0,1.1);expect(Math.abs(game.landing().z)).toBeGreaterThan(FIELD.halfLength);
    incoming();game.hit(0,'drop',1.2,.5);expect(Math.abs(game.landing().x)).toBeGreaterThan(FIELD.halfWidth);
  });
  it('charges and releases the chosen drop without a hidden immediate drive',()=>{
    advance(.25,{...hold,shot:'drop'});expect(game.hits).toBe(0);incoming();game.update(1/120,idle);expect(game.hits).toBe(1);expect(game.players[0].stroke).toBe('drop');expect(Math.abs(game.landing().z)).toBeLessThan(4);
  });
  it('uses an overhead smash for high balls but a drive for low ones',()=>{
    incoming();game.ball.y=2.4;game.hit(0,'smash',0,.7);const smashSpeed=Math.abs(game.ball.vz);expect(game.players[0].stroke).toBe('smash');
    incoming();game.hit(0,'smash',0,.7);expect(game.players[0].stroke).toBe('drive');expect(smashSpeed).toBeGreaterThan(Math.abs(game.ball.vz));
  });
  it('latches release aim and power while waiting briefly for a reachable ball',()=>{
    advance(.3,{...hold,left:true});game.update(.01,idle);
    expect(game.strokePending).toBeTrue();const aim=game.strokeAim;incoming();game.update(.01,{...idle,right:true});
    expect(game.hits).toBe(1);expect(game.landing().x).toBeCloseTo(aim*3.7,2);
  });
  it('expires an early release rather than firing on a later ball',()=>{
    advance(.15,hold);game.update(.01,idle);advance(.7);incoming();game.update(.01,idle);expect(game.hits).toBe(0);
  });
  it('cancels pending and held strokes without firing after pause',()=>{
    advance(.25,hold);game.cancelServeCharge();incoming();game.update(.01,idle);expect(game.hits).toBe(0);expect(game.strokePending).toBeFalse();expect(game.strokeCharge).toBe(0);
  });
  it('sends red power long and red direction wide in either direction',()=>{
    incoming();game.hit(0,'drive',0,1.1);expect(Math.abs(game.landing().z)).toBeGreaterThan(FIELD.halfLength);
    for(const direction of [-1.15,1.15]){incoming();game.hit(0,'drive',direction,.6);expect(Math.abs(game.landing().x)).toBeGreaterThan(FIELD.halfWidth);}
  });
  it('has independent aim and power, with both directional red zones reachable',()=>{
    advance(.55,{...hold,left:true});expect(game.strokeAim).toBeLessThan(-1);expect(game.strokeCharge).toBeLessThan(.95);
    game.cancelServeCharge();advance(.55,{...hold,right:true});expect(game.strokeAim).toBeGreaterThan(1);expect(game.strokeCharge).toBeLessThan(.95);
  });
  it('marks either red service direction as a fault, not a guaranteed ace',()=>{
    for(const aim of [-1.2,1.2]){game.start();game.strikeServe(.5,aim);advance(1);expect(game.phase).toBe('fault');expect(game.score).toEqual([0,0]);}
  });
  it('returns ordinary serves more reliably with a strong opponent on every surface',()=>{
    for(const surface of ['grass','clay','hard'] as const){
      const count=(strength:number)=>{let returns=0;for(let seed=1;seed<=30;seed++){
        const g=new Tennis3DEngine(arcadeRandom(seed));g.opponentStrength=strength;g.start(surface);g.strikeServe(.3+(seed%7)*.1,((seed%5)-2)*.4);
        for(let n=0;n<360&&g.phase==='playing';n++){g.update(1/120,idle);if(g.rally){returns++;break;}}
      }return returns;};
      const easy=count(0),hard=count(1);expect(hard).toBeGreaterThan(easy);expect(hard).toBeGreaterThan(25);
    }
  });
  it('lets a charged return meet a computer serve after the bounce',()=>{
    for(const surface of ['grass','clay','hard'] as const){
      game=new Tennis3DEngine(()=>.5);game.start(surface);game.server=1;(game as any).prepareServe(true);game.strikeServe(.5);
      for(let n=0;n<360&&game.phase==='playing'&&!game.hits;n++)game.update(1/120,n>=90?idle:hold);
      expect(game.hits).toBe(1);
    }
  });
});
