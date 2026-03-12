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
  
  export interface LegacyMatchOddsDTO {
    o01: number;
    o02: string;
    o03?: string;
    o04: number;
    o05: number;
    o06: number;
    o07: boolean;
    o08: boolean;
    o09: number;
    o10?: string;
  }
  
  export interface BookieOfferDTOv2 {
    b: number;      // bookieId
    q: number;      // odds
    d?: string;     // oddsDateTime
    r: number;      // seriesOrdinal
  }
  
  export interface SelectionDTOv2 {
    k: string;      // selectionKey
    p?: number;     // selectionPlayerTPId
    o: BookieOfferDTOv2[];
  }
  
  export interface MarketDTOv2 {
    s?: string;     // marketScope
    l?: number;     // line
    x: SelectionDTOv2[];
  }
  
  export interface BetTypeGroupDTOv2 {
    i: number;      // betTypeId
    m: MarketDTOv2[];
  }
  
  /**
   * Raw match details object decoded from .br.
   * It contains minified keys (m001..m656) plus nested p1/p2/t/o.
   */
  export type MatchDetailsRaw = Record<string, any> & {
    m001: number;
    m002?: number;
    m003: string;
    m004: number;
    m005: number;
    m006?: number;
    m007?: number;
    m008?: string;
    m009?: string;
    m010?: string;
    m011?: string;
  
    // stari summary odds više ne moraju postojati
    m012?: number;
    m013?: number;
  
    m014?: number;
    m015?: string;
    m019: number;
    m020?: string;
    m021: number;
    m022?: string;
    m655?: number;
    m656: boolean;
  
    p1: PlayerDTO;
    p2: PlayerDTO;
    t: TournamentEventDTO;
  
    // novi odds
    o?: BetTypeGroupDTOv2[];
  
    // NN blok ćemo dodati kasnije do kraja ili odmah
    n?: any;
  };