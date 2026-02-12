/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/models/match-details.model.ts

export interface PlayerDTO {
    p01: number;
    p02: string;
    p03: number;
    p04: string;
    p05: string;
    p06?: string;
    p07: number;
    p08?: string;
    p09?: string; // ISO string
    p10?: number;
    p11?: number;
    p12?: number;
    p13?: number;
    p14?: string;
    trueSkillMean?: number;
  }
  
  export interface TournamentEventDTO {
    t01: number;
    t02: string;
    t03: number;
    t04: string;
    t05: string;
    t06: string;
    t07: number;
    t08: string;
    t09: string; // ISO string
    t10: number;
    t11: string;
    t12: number;
    t13: string;
    t14?: number;
    t15: number;
    t16: string;
    t17?: number;
    t18?: number;
  }
  
  export interface MatchOddsDTO {
    o01: number;
    o02: string;
    o03?: string;  // ISO string
    o04: number;
    o05: number;
    o06: number;
    o07: boolean;
    o08: boolean;
    o09: number;
    o10: string;   // ISO string
  }
  
  /**
   * Raw match details object decoded from .br.
   * It contains minified keys (m001..m656) plus nested p1/p2/t/o.
   */
  export type MatchDetailsRaw = Record<string, any> & {
    // core fields we use now (add more later as needed)
    m001: number;         // matchTPId
    m002?: number;        // tournamentEventTPId
    m003: string;         // datetime ISO
    m004: number;         // player1TPId
    m005: number;         // player2TPId
    m006?: number;        // p1 rank
    m007?: number;        // p2 rank
    m008?: string;        // p1 seed
    m009?: string;        // p2 seed
    m010?: string;        // result
    m011?: string;        // result details
    m012?: number;        // p1 odds
    m013?: number;        // p2 odds
    m014?: number;        // offered bookies
    m015?: string;        // odds updated
    m019: number;         // surfaceId
    m020?: string;        // surfaceName
    m021: number;         // roundId
    m022?: string;        // roundName
    m655?: number;        // NN win prob (?) sample is 50.0 meaning %
    m656: boolean;        // isFinished
  
    p1: PlayerDTO;
    p2: PlayerDTO;
    t: TournamentEventDTO;
    o: MatchOddsDTO[];
  };