import { TennisSpaceStroke } from './tennis-space-stroke';

describe('Space hold/release controls', () => {
  let input: TennisSpaceStroke;
  beforeEach(() => input = new TennisSpaceStroke());
  it('starts charging immediately without a multi-tap deadline', () => {
    input.press(1000); expect(input.read()).toEqual({shot:'drive',aiming:true});
  });
  it('releases without leaving a held key or automatic extra shot', () => {
    input.press(1000); input.release(); expect(input.read()).toEqual({shot:null,aiming:false});
  });
  it('does not reinterpret repeated taps as a smash or lob', () => {
    for(let n=0;n<3;n++){ input.press(1000+n*100); expect(input.intent).toBe('drive'); input.release(); }
    expect(input.intent).toBeNull();
  });
  it('keeps auto-repeat as one hold', () => {
    input.press(1000); input.press(1050); input.press(1100); expect(input.read().shot).toBe('drive');
    input.release(); expect(input.read().shot).toBeNull();
  });
  it('clears a hold on pause, blur or a new point', () => {
    input.press(1000); input.clear(); expect(input.read()).toEqual({shot:null,aiming:false});
  });
  it('rejects invalid times', () => {
    input.press(NaN); input.press(Infinity); expect(input.intent).toBeNull();
  });
});
