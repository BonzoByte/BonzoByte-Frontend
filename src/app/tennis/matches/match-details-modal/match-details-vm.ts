/* eslint-disable @typescript-eslint/no-explicit-any */
import { MatchDetailsRaw } from '../../../core/models/match-details.model';

export type TsScope = 'M' | 'SM' | 'GSM';
export type Surface = 1 | 2 | 3 | 4;
export type Who = 'p1' | 'p2';

const BLOCK = 9;

const TS_BASE: Record<TsScope, number> = {
  M: 23,
  SM: 32,
  GSM: 41,
};

const TS_SURFACE_BASE: Record<TsScope, number> = {
  M: 50,   // MS1
  SM: 59,  // SMS1
  GSM: 68, // GSMS1
};

const OFF = {
  p1Mean: 0,
  p1Sd: 1,
  p2Mean: 2,
  p2Sd: 3,
  p1OldMean: 4,
  p1OldSd: 5,
  p2OldMean: 6,
  p2OldSd: 7,
  p1WinProb: 8, // 0..1
} as const;

function mKey(n: number) {
  return `m${String(n).padStart(3, '0')}`;
}

function getTsBlockStart(scope: TsScope, surface?: Surface): number {
  if (!surface) return TS_BASE[scope];
  // per surface: (M, SM, GSM) blocks => 3 * 9
  return TS_SURFACE_BASE[scope] + (surface - 1) * (3 * BLOCK);
}

export function getTs(d: MatchDetailsRaw, scope: TsScope, who: Who, surface?: Surface) {
  const start = getTsBlockStart(scope, surface);

  const mean    = d[mKey(start + (who === 'p1' ? OFF.p1Mean : OFF.p2Mean))] as number;
  const sd      = d[mKey(start + (who === 'p1' ? OFF.p1Sd   : OFF.p2Sd))] as number;
  const oldMean = d[mKey(start + (who === 'p1' ? OFF.p1OldMean : OFF.p2OldMean))] as number;
  const oldSd   = d[mKey(start + (who === 'p1' ? OFF.p1OldSd   : OFF.p2OldSd))] as number;

  const p1WinProb = d[mKey(start + OFF.p1WinProb)] as number; // 0..1
  const winProb = who === 'p1' ? p1WinProb : (1 - p1WinProb);

  return { mean, sd, oldMean, oldSd, winProb };
}

export function winProbToPct(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '–';
  return `${(p * 100).toFixed(1)}%`;
}

export function pctAlready(p: number | null | undefined): string {
  // for fields already in percent like m655 sample 50.0
  if (p == null || Number.isNaN(p)) return '–';
  return `${p.toFixed(1)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(); // uses browser locale; OK for MVP
}

export function safeText(v: any): string {
  if (v == null) return '–';
  const s = String(v).trim();
  return s.length ? s : '–';
}

export type NnGroupId = 'c' | 'w' | 'r' | 'z' | 'd' | 'h';

export interface NnFeatureDefinition {
  key: string;
  featureName: string;
  label: string;
}

export interface NnFeatureGroupDefinition {
  id: NnGroupId;
  title: string;
  definitions: NnFeatureDefinition[];
}

export const NN_CONTEXT_FEATURES: NnFeatureDefinition[] = [
  { key: 'c01', featureName: 'Round_IsMainDraw', label: 'Main Draw' },
  { key: 'c02', featureName: 'Round_DepthFromFinal01', label: 'Round Depth From Final' },
  { key: 'c03', featureName: 'TournamentLevelId', label: 'Tournament Level' },
  { key: 'c04', featureName: 'TournamentTypeId', label: 'Tournament Type' },
  { key: 'c05', featureName: 'SurfaceId', label: 'Surface' },
  { key: 'c06', featureName: 'SurfaceSpeedIndex', label: 'Surface Speed Index' },
  { key: 'c07', featureName: 'ProbClay', label: 'Clay Probability' },
  { key: 'c08', featureName: 'ProbHard', label: 'Hard Probability' },
  { key: 'c09', featureName: 'ProbGrass', label: 'Grass Probability' },
  { key: 'c10', featureName: 'ProbCarpet', label: 'Carpet Probability' },
  { key: 'c11', featureName: 'Home_OneSideOnly', label: 'Home One Side Only' },
  { key: 'c12', featureName: 'HomeAdvantage_T', label: 'Home Advantage (Transformed)' },
  { key: 'c13', featureName: 'Event_Prize_Log', label: 'Event Prize (Log)' },
  { key: 'c14', featureName: 'Event_Prize_QYear', label: 'Event Prize Quartile Year' },
  { key: 'c15', featureName: 'StrengthMeanTS', label: 'Strength Mean TS' },
  { key: 'c16', featureName: 'StrengthMeanTS_Z', label: 'Strength Mean TS (Z)' },
  { key: 'c17', featureName: 'StrengthMeanTS_T', label: 'Strength Mean TS (Transformed)' },
  { key: 'c18', featureName: 'Event_Prize_Log_Z', label: 'Event Prize Log (Z)' },
  { key: 'c19', featureName: 'Event_Prize_Log_T', label: 'Event Prize Log (Transformed)' },
  { key: 'c20', featureName: 'SurfaceChange_Diff', label: 'Surface Change Diff' },
  { key: 'c21', featureName: 'SurfacePrevStreak_Diff', label: 'Surface Previous Streak Diff' },
  { key: 'c22', featureName: 'Experience_AgeDiff', label: 'Experience Age Diff' },
  { key: 'c23', featureName: 'Experience_AgeDiff_T', label: 'Experience Age Diff (Transformed)' },
];

export const NN_WP_CORE_FEATURES: NnFeatureDefinition[] = [
  { key: 'w01', featureName: 'WP', label: 'WP' },
  { key: 'w02', featureName: 'WPS', label: 'WPS' },
  { key: 'w03', featureName: 'WPPondered', label: 'WP Pondered' },
  { key: 'w04', featureName: 'WPM', label: 'WPM' },
  { key: 'w05', featureName: 'WPSM', label: 'WPSM' },
  { key: 'w06', featureName: 'WPGSM', label: 'WPGSM' },
  { key: 'w07', featureName: 'WPMS', label: 'WPMS' },
  { key: 'w08', featureName: 'WPSMS', label: 'WPSMS' },
  { key: 'w09', featureName: 'WPGSMS', label: 'WPGSMS' },
];

export const NN_RAW_TS_FEATURES: NnFeatureDefinition[] = [
  { key: 'r01', featureName: 'P1MeanM', label: 'P1 Mean M' },
  { key: 'r02', featureName: 'P1MeanSM', label: 'P1 Mean SM' },
  { key: 'r03', featureName: 'P1MeanGSM', label: 'P1 Mean GSM' },
  { key: 'r04', featureName: 'P1MeanMS', label: 'P1 Mean MS' },
  { key: 'r05', featureName: 'P1MeanSMS', label: 'P1 Mean SMS' },
  { key: 'r06', featureName: 'P1MeanGSMS', label: 'P1 Mean GSMS' },

  { key: 'r07', featureName: 'P2MeanM', label: 'P2 Mean M' },
  { key: 'r08', featureName: 'P2MeanSM', label: 'P2 Mean SM' },
  { key: 'r09', featureName: 'P2MeanGSM', label: 'P2 Mean GSM' },
  { key: 'r10', featureName: 'P2MeanMS', label: 'P2 Mean MS' },
  { key: 'r11', featureName: 'P2MeanSMS', label: 'P2 Mean SMS' },
  { key: 'r12', featureName: 'P2MeanGSMS', label: 'P2 Mean GSMS' },

  { key: 'r13', featureName: 'P1SDM', label: 'P1 SD M' },
  { key: 'r14', featureName: 'P1SDSM', label: 'P1 SD SM' },
  { key: 'r15', featureName: 'P1SDGSM', label: 'P1 SD GSM' },
  { key: 'r16', featureName: 'P1SDMS', label: 'P1 SD MS' },
  { key: 'r17', featureName: 'P1SDSMS', label: 'P1 SD SMS' },
  { key: 'r18', featureName: 'P1SDGSMS', label: 'P1 SD GSMS' },

  { key: 'r19', featureName: 'P2SDM', label: 'P2 SD M' },
  { key: 'r20', featureName: 'P2SDSM', label: 'P2 SD SM' },
  { key: 'r21', featureName: 'P2SDGSM', label: 'P2 SD GSM' },
  { key: 'r22', featureName: 'P2SDMS', label: 'P2 SD MS' },
  { key: 'r23', featureName: 'P2SDSMS', label: 'P2 SD SMS' },
  { key: 'r24', featureName: 'P2SDGSMS', label: 'P2 SD GSMS' },
];

export const NN_NORMALIZED_TS_FEATURES: NnFeatureDefinition[] = [
  { key: 'z01', featureName: 'Z_TSSd_G_Sum', label: 'Z TS Sd G Sum' },
  { key: 'z02', featureName: 'Z_TSSd_S_Sum', label: 'Z TS Sd S Sum' },
  { key: 'z03', featureName: 'Z_TSMean_G_Diff', label: 'Z TS Mean G Diff' },
  { key: 'z04', featureName: 'Z_TSMean_S_Diff', label: 'Z TS Mean S Diff' },
  { key: 'z05', featureName: 'T_TSMean_G_Diff', label: 'T TS Mean G Diff' },
  { key: 'z06', featureName: 'T_TSMean_S_Diff', label: 'T TS Mean S Diff' },
];

export const NN_DERIVED_TS_FEATURES: NnFeatureDefinition[] = [
  { key: 'd01', featureName: 'WPw_G_TotalPrec', label: 'Weighted Precision G' },
  { key: 'd02', featureName: 'WPw_S_TotalPrec', label: 'Weighted Precision S' },
  { key: 'd03', featureName: 'WPw_G_TotalPrec_T', label: 'Weighted Precision G (Transformed)' },
  { key: 'd04', featureName: 'WPw_S_TotalPrec_T', label: 'Weighted Precision S (Transformed)' },
];

export const NN_H2H_FEATURES: NnFeatureDefinition[] = [
  { key: 'h01', featureName: 'H2H_WPw_G_TotalPrec_T', label: 'H2H Weighted Precision G (Transformed)' },
  { key: 'h02', featureName: 'H2H_WPw_S_TotalPrec_T', label: 'H2H Weighted Precision S (Transformed)' },
  { key: 'h03', featureName: 'H2H_WP_AVG_G_Centered', label: 'H2H WP Avg G Centered' },
  { key: 'h04', featureName: 'H2H_WP_SPR_G', label: 'H2H WP Spread G' },
  { key: 'h05', featureName: 'H2H_WPw_G_TotalPrec', label: 'H2H Weighted Precision G' },
  { key: 'h06', featureName: 'H2HRecency180_Diff', label: 'H2H Recency 180 Diff' },
  { key: 'h07', featureName: 'H2HRecency365_Diff', label: 'H2H Recency 365 Diff' },
  { key: 'h08', featureName: 'T_H2HRecency180_Diff', label: 'H2H Recency 180 Diff (Transformed)' },
  { key: 'h09', featureName: 'T_H2HRecency365_Diff', label: 'H2H Recency 365 Diff (Transformed)' },
];

export const NN_FEATURE_GROUPS: NnFeatureGroupDefinition[] = [
  { id: 'c', title: 'Context', definitions: NN_CONTEXT_FEATURES },
  { id: 'w', title: 'WP Core', definitions: NN_WP_CORE_FEATURES },
  { id: 'r', title: 'Raw TrueSkill', definitions: NN_RAW_TS_FEATURES },
  { id: 'z', title: 'Normalized TrueSkill', definitions: NN_NORMALIZED_TS_FEATURES },
  { id: 'd', title: 'Derived TrueSkill', definitions: NN_DERIVED_TS_FEATURES },
  { id: 'h', title: 'Head-to-Head', definitions: NN_H2H_FEATURES },
];

export interface NnFeatureItemVm {
  minifiedKey: string;
  featureName: string;
  label: string;
  value: unknown;
  displayValue: string;
}

export interface NnFeatureGroupVm {
  id: NnGroupId;
  title: string;
  items: NnFeatureItemVm[];
  visible: boolean;
}

export interface NnTabVm {
  version: string;
  modelFamily: string;
  includeH2h: boolean;
  groupCount: number;
  featureCount: number;
  groups: NnFeatureGroupVm[];
}

export interface NnFeatureItemVm {
  minifiedKey: string;
  featureName: string;
  label: string;
  value: unknown;
  displayValue: string;
}

export interface NnFeatureGroupVm {
  id: 'c' | 'w' | 'r' | 'z' | 'd' | 'h';
  title: string;
  items: NnFeatureItemVm[];
  visible: boolean;
}

export interface NnTabVm {
  version: string;
  modelFamily: string;
  includeH2h: boolean;
  groupCount: number;
  featureCount: number;
  groups: NnFeatureGroupVm[];
}