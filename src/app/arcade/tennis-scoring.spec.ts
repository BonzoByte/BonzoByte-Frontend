import { TennisScoring } from './tennis-scoring';
import type { Side } from './tennis-engine';

describe('Tennis match scoring', () => {
  let score: TennisScoring;
  const point = (side: Side, count = 1) => { for (let i = 0; i < count; i++) score.award(side); };
  const game = (side: Side) => point(side, 4);
  const set = (side: Side) => { for (let i = 0; i < 6; i++) game(side); };
  const sixAll = () => { for (let i = 0; i < 6; i++) { game(0); game(1); } };
  beforeEach(() => score = new TennisScoring('match'));

  it('starts with love, zero games/sets and the first server', () => {
    expect(score.pointLabels).toEqual(['0', '0']); expect(score.games).toEqual([0, 0]); expect(score.sets).toEqual([0, 0]); expect(score.server).toBe(0);
  });
  it('counts 15, 30 and 40 before awarding a game and resetting points', () => {
    point(0); expect(score.pointLabels).toEqual(['15', '0']); point(0); expect(score.pointLabels).toEqual(['30', '0']);
    point(0); expect(score.pointLabels).toEqual(['40', '0']); point(0); expect(score.pointLabels).toEqual(['0', '0']);
    expect(score.games).toEqual([1, 0]); expect(score.lastAward).toBe('game'); expect(score.server).toBe(1);
  });
  it('does not change server after points within the same game', () => {
    point(0); point(1); point(0); expect(score.server).toBe(0);
  });
  it('shows deuce at 40-all, advantage and then returns to deuce', () => {
    point(0, 3); point(1, 3); expect(score.pointLabels).toEqual(['40', '40']);
    point(0); expect(score.pointLabels).toEqual(['AD', '40']); point(1); expect(score.pointLabels).toEqual(['40', '40']);
    expect(score.games).toEqual([0, 0]);
  });
  it('can give advantage to either player and requires another consecutive point', () => {
    point(0, 3); point(1, 4); expect(score.pointLabels).toEqual(['40', 'AD']); point(1);
    expect(score.games).toEqual([0, 1]); expect(score.points).toEqual([0, 0]);
  });
  it('survives repeated deuces without creating a phantom game', () => {
    point(0, 3); point(1, 3);
    for (let i = 0; i < 100; i++) { point(0); point(1); }
    expect(score.pointLabels).toEqual(['40', '40']); expect(score.games).toEqual([0, 0]);
    point(0, 2); expect(score.games).toEqual([1, 0]);
  });
  it('awards a 6-0 set but not the whole match', () => {
    set(0); expect(score.sets).toEqual([1, 0]); expect(score.games).toEqual([0, 0]); expect(score.points).toEqual([0, 0]);
    expect(score.completedSets).toEqual([{ games: [6, 0], tieBreak: null }]); expect(score.lastAward).toBe('set'); expect(score.winner).toBeNull();
  });
  it('does not end a set at 6-5 and ends it at 7-5', () => {
    for (let i = 0; i < 5; i++) { game(0); game(1); }
    game(0); expect(score.games).toEqual([6, 5]); expect(score.sets).toEqual([0, 0]); expect(score.isTieBreak).toBeFalse();
    game(0); expect(score.completedSets[0].games).toEqual([7, 5]); expect(score.sets).toEqual([1, 0]);
  });
  it('starts a numeric tie-break at 6-6', () => {
    sixAll(); expect(score.games).toEqual([6, 6]); expect(score.isTieBreak).toBeTrue(); point(0); expect(score.pointLabels).toEqual(['1', '0']);
  });
  it('serves one opening tie-break point, then two points at a time', () => {
    sixAll(); expect(score.server).toBe(0);
    point(0); expect(score.server).toBe(1); point(1); expect(score.server).toBe(1); point(0); expect(score.server).toBe(0);
    point(1); expect(score.server).toBe(0); point(0); expect(score.server).toBe(1);
  });
  it('supports a tie-break whose first server is the computer', () => {
    score.server = 1; sixAll(); expect(score.server).toBe(1);
    point(0); expect(Number(score.server)).toBe(0); point(1); expect(Number(score.server)).toBe(0); point(0); expect(score.server).toBe(1);
  });
  it('requires a two-point tie-break lead, records the full tie score and resumes normal scoring', () => {
    sixAll(); point(0, 6); point(1, 6); point(0);
    expect(score.isTieBreak).toBeTrue(); expect(score.pointLabels).toEqual(['7', '6']); expect(score.sets).toEqual([0, 0]);
    point(0); expect(score.completedSets[0]).toEqual({ games: [7, 6], tieBreak: [8, 6] });
    expect(score.isTieBreak).toBeFalse(); expect(score.server).toBe(1); expect(score.games).toEqual([0, 0]);
    point(1); expect(score.pointLabels).toEqual(['0', '15']); expect(score.server).toBe(1);
  });
  it('starts the next set with the receiver of the tie-break opening point', () => {
    score.server = 1; sixAll(); point(1, 7); expect(Number(score.server)).toBe(0);
  });
  it('keeps normal game service order across a non-tie-break set boundary', () => {
    for (let i = 0; i < 3; i++) { game(0); game(1); } game(0); game(0); game(0);
    expect(score.completedSets[0].games).toEqual([6, 3]); expect(score.server).toBe(1);
  });
  it('wins the match after two straight sets and ignores later awards', () => {
    set(0); set(0); expect(score.winner).toBe(0); expect(score.sets).toEqual([2, 0]); expect(score.lastAward).toBe('match');
    const before = JSON.stringify(score); expect(score.award(1)).toBeFalse(); expect(JSON.stringify(score)).toBe(before);
  });
  it('keeps a split match alive and permits a deciding-set tie-break', () => {
    set(0); set(1); expect(score.winner).toBeNull(); expect(score.sets).toEqual([1, 1]);
    sixAll(); for (let i = 0; i < 6; i++) { point(0); point(1); } point(1, 2);
    expect(score.winner).toBe(1); expect(score.sets).toEqual([1, 2]); expect(score.completedSets[2]).toEqual({ games: [6, 7], tieBreak: [6, 8] });
  });
  it('preserves finished set snapshots while playing the next set', () => {
    set(0); const first = JSON.stringify(score.completedSets[0]); game(1); point(0);
    expect(JSON.stringify(score.completedSets[0])).toBe(first);
  });
  it('counts all played points without confusing games with tie-break points', () => {
    game(0); expect(score.totalPoints).toBe(4); expect(score.points).toEqual([0, 0]); expect(score.games).toEqual([1, 0]);
  });
});

describe('Preserved seven-point challenge', () => {
  it('retains numeric points, win by two and no games or sets', () => {
    const score = new TennisScoring('challenge');
    for (let i = 0; i < 6; i++) { score.award(0); score.award(1); }
    score.award(0); expect(score.winner).toBeNull(); expect(score.pointLabels).toEqual(['7', '6']); score.award(0);
    expect(score.winner).toBe(0); expect(score.points).toEqual([8, 6]); expect(score.games).toEqual([0, 0]); expect(score.completedSets).toEqual([]);
  });
  it('retains the opening one-point and subsequent two-point service rotation', () => {
    const score = new TennisScoring('challenge'); const servers = [score.server];
    for (let i = 0; i < 6; i++) { score.award(i % 2 as Side); servers.push(score.server); }
    expect(servers).toEqual([0, 1, 1, 0, 0, 1, 1]);
  });
});
