export interface NnFeatureHelpEntry {
    title?: string;
    shortDescription: string;
    technicalNote?: string;
  }
  
  export const NN_CONTEXT_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    Round_IsMainDraw: {
      shortDescription: 'Indicates whether the match belongs to the main draw rather than a qualifying stage.',
    },
    Round_DepthFromFinal01: {
      shortDescription: 'Represents how close the round is to the final, expressed on a normalized scale.',
    },
    TournamentLevelId: {
      shortDescription: 'Identifies the competitive level of the tournament within the broader event hierarchy.',
    },
    TournamentTypeId: {
      shortDescription: 'Identifies the tour category or competition type used for this match.',
    },
    SurfaceId: {
      shortDescription: 'Identifies the playing surface used for the match.',
    },
    SurfaceSpeedIndex: {
      shortDescription: 'A numeric estimate of how fast the playing surface behaves relative to the broader dataset.',
    },
    ProbClay: {
      shortDescription: 'Represents the model-side surface profile weight associated with clay-like conditions.',
    },
    ProbHard: {
      shortDescription: 'Represents the model-side surface profile weight associated with hard-court conditions.',
    },
    ProbGrass: {
      shortDescription: 'Represents the model-side surface profile weight associated with grass-like conditions.',
    },
    ProbCarpet: {
      shortDescription: 'Represents the model-side surface profile weight associated with carpet-like conditions.',
    },
    Home_OneSideOnly: {
      shortDescription: 'Indicates whether only one player has a home-side contextual advantage in this matchup.',
    },
    HomeAdvantage_T: {
      shortDescription: 'A transformed version of the home-advantage signal used in the production model input.',
    },
    Event_Prize_Log: {
      shortDescription: 'A log-scaled representation of tournament prize level used as a proxy for event strength.',
    },
    Event_Prize_QYear: {
      shortDescription: 'Places the event prize level into a year-relative bucket or quartile-style ranking.',
    },
    StrengthMeanTS: {
      shortDescription: 'An aggregate TrueSkill-based estimate of overall competitive strength in the match context.',
    },
    StrengthMeanTS_Z: {
      shortDescription: 'A normalized version of the aggregate TrueSkill strength estimate.',
    },
    StrengthMeanTS_T: {
      shortDescription: 'A transformed version of the aggregate TrueSkill strength signal used by the model.',
    },
    Event_Prize_Log_Z: {
      shortDescription: 'A normalized version of the log-scaled event prize signal.',
    },
    Event_Prize_Log_T: {
      shortDescription: 'A transformed version of the log-scaled event prize signal used in model input.',
    },
    SurfaceChange_Diff: {
      shortDescription: 'Captures the difference in recent surface-change pattern between the two players.',
    },
    SurfacePrevStreak_Diff: {
      shortDescription: 'Measures the difference in recent same-surface continuity or streak context between players.',
    },
    Experience_AgeDiff: {
      shortDescription: 'Represents the experience or age-related difference between the two players.',
    },
    Experience_AgeDiff_T: {
      shortDescription: 'A transformed version of the experience or age-difference signal used by the model.',
    },
  };
  
  export const NN_WP_CORE_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    WP: {
      shortDescription: 'The baseline win probability derived from the global match-level TrueSkill variant, using only the final match winner as the rating outcome signal.',
    },
    WPS: {
      shortDescription: 'The surface-specific version of the baseline win probability, calculated from the same match-level TrueSkill logic but only on the current surface.',
    },
    WPPondered: {
      shortDescription: 'A blended win probability currently computed as the simple average of the M, SM, and GSM probability variants rather than as a custom weighted formula.',
    },
    WPM: {
      shortDescription: 'A win probability based on the M rating family, where TrueSkill updates depend only on the final match result and not on sets or games.',
    },
    WPSM: {
      shortDescription: 'A win probability based on the SM rating family, where TrueSkill updates take set score into account so a more convincing set margin produces a stronger signal.',
    },
    WPGSM: {
      shortDescription: 'A win probability based on the GSM rating family, where TrueSkill updates also reflect game-level dominance, making it the most granular of the three core variants.',
    },
    WPMS: {
      shortDescription: 'The surface-specific version of WPM, using the match-result-only TrueSkill family restricted to the current surface.',
    },
    WPSMS: {
      shortDescription: 'The surface-specific version of WPSM, using the set-aware TrueSkill family restricted to the current surface.',
    },
    WPGSMS: {
      shortDescription: 'The surface-specific version of WPGSM, using the game-aware TrueSkill family restricted to the current surface.',
    },
  };
  
  export const NN_RAW_TS_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    P1MeanM: {
      shortDescription: 'Player 1 strength estimate from the M TrueSkill family, where rating updates use only the final match winner.',
    },
    P1MeanSM: {
      shortDescription: 'Player 1 strength estimate from the SM TrueSkill family, where rating updates also reflect how decisive the match was at the set level.',
    },
    P1MeanGSM: {
      shortDescription: 'Player 1 strength estimate from the GSM TrueSkill family, where rating updates also reflect game-level dominance and margin.',
    },
    P1MeanMS: {
      shortDescription: 'The surface-specific version of Player 1 M strength, calculated only from matches on the current surface.',
    },
    P1MeanSMS: {
      shortDescription: 'The surface-specific version of Player 1 SM strength, calculated only from matches on the current surface.',
    },
    P1MeanGSMS: {
      shortDescription: 'The surface-specific version of Player 1 GSM strength, calculated only from matches on the current surface.',
    },
  
    P2MeanM: {
      shortDescription: 'Player 2 strength estimate from the M TrueSkill family, where rating updates use only the final match winner.',
    },
    P2MeanSM: {
      shortDescription: 'Player 2 strength estimate from the SM TrueSkill family, where rating updates also reflect how decisive the match was at the set level.',
    },
    P2MeanGSM: {
      shortDescription: 'Player 2 strength estimate from the GSM TrueSkill family, where rating updates also reflect game-level dominance and margin.',
    },
    P2MeanMS: {
      shortDescription: 'The surface-specific version of Player 2 M strength, calculated only from matches on the current surface.',
    },
    P2MeanSMS: {
      shortDescription: 'The surface-specific version of Player 2 SM strength, calculated only from matches on the current surface.',
    },
    P2MeanGSMS: {
      shortDescription: 'The surface-specific version of Player 2 GSM strength, calculated only from matches on the current surface.',
    },
  
    P1SDM: {
      shortDescription: 'The uncertainty attached to Player 1 M strength, where the underlying TrueSkill family uses only the final match result.',
    },
    P1SDSM: {
      shortDescription: 'The uncertainty attached to Player 1 SM strength, where the underlying TrueSkill family also reflects set-level margin.',
    },
    P1SDGSM: {
      shortDescription: 'The uncertainty attached to Player 1 GSM strength, where the underlying TrueSkill family also reflects game-level dominance.',
    },
    P1SDMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 1 M strength on the current surface.',
    },
    P1SDSMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 1 SM strength on the current surface.',
    },
    P1SDGSMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 1 GSM strength on the current surface.',
    },
  
    P2SDM: {
      shortDescription: 'The uncertainty attached to Player 2 M strength, where the underlying TrueSkill family uses only the final match result.',
    },
    P2SDSM: {
      shortDescription: 'The uncertainty attached to Player 2 SM strength, where the underlying TrueSkill family also reflects set-level margin.',
    },
    P2SDGSM: {
      shortDescription: 'The uncertainty attached to Player 2 GSM strength, where the underlying TrueSkill family also reflects game-level dominance.',
    },
    P2SDMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 2 M strength on the current surface.',
    },
    P2SDSMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 2 SM strength on the current surface.',
    },
    P2SDGSMS: {
      shortDescription: 'The surface-specific uncertainty attached to Player 2 GSM strength on the current surface.',
    },
  };
  
  export const NN_NORMALIZED_TS_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    Z_TSSd_G_Sum: {
      shortDescription: 'A normalized version of the combined global uncertainty signal, built from both players’ TrueSkill standard deviations across all surfaces.',
    },
    Z_TSSd_S_Sum: {
      shortDescription: 'A normalized version of the combined surface-specific uncertainty signal, built from both players’ TrueSkill standard deviations on the current surface.',
    },
    Z_TSMean_G_Diff: {
      shortDescription: 'A normalized difference between player strength estimates in the global TrueSkill layer across all surfaces.',
    },
    Z_TSMean_S_Diff: {
      shortDescription: 'A normalized difference between player strength estimates in the surface-specific TrueSkill layer for the current surface.',
    },
    T_TSMean_G_Diff: {
      shortDescription: 'A transformed version of the global strength difference signal used to improve model comparability and numerical stability.',
    },
    T_TSMean_S_Diff: {
      shortDescription: 'A transformed version of the surface-specific strength difference signal used in the model-ready input layer.',
    },
  };
  
  export const NN_DERIVED_TS_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    WPw_G_TotalPrec: {
      shortDescription: 'A derived weighted precision-style comparison signal built from the global win-probability layer across all surfaces.',
    },
    WPw_S_TotalPrec: {
      shortDescription: 'A derived weighted precision-style comparison signal built from the surface-specific win-probability layer for the current surface.',
    },
    WPw_G_TotalPrec_T: {
      shortDescription: 'A transformed version of the global weighted precision signal used in the final model input.',
    },
    WPw_S_TotalPrec_T: {
      shortDescription: 'A transformed version of the surface-specific weighted precision signal used in the final model input.',
    },
  };
  
  export const NN_H2H_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    H2H_WPw_G_TotalPrec_T: {
      shortDescription: 'A transformed head-to-head weighted precision signal derived from prior direct matchups using the global all-surfaces subset.',
    },
    H2H_WPw_S_TotalPrec_T: {
      shortDescription: 'A transformed head-to-head weighted precision signal derived from prior direct matchups on the current surface only.',
    },
    H2H_WP_AVG_G_Centered: {
      shortDescription: 'A centered head-to-head probability average signal summarizing prior direct-matchup tendency across the global all-surfaces subset.',
    },
    H2H_WP_SPR_G: {
      shortDescription: 'A head-to-head spread-style probability signal reflecting the separation of prior direct-matchup evidence across all surfaces.',
    },
    H2H_WPw_G_TotalPrec: {
      shortDescription: 'A weighted precision-style head-to-head signal derived from previous direct matchups across the global all-surfaces subset.',
    },
    H2HRecency180_Diff: {
      shortDescription: 'A head-to-head recency signal reflecting the relative direct-matchup history within a shorter recent time window.',
    },
    H2HRecency365_Diff: {
      shortDescription: 'A head-to-head recency signal reflecting the relative direct-matchup history within a broader one-year time window.',
    },
    T_H2HRecency180_Diff: {
      shortDescription: 'A transformed version of the shorter-window head-to-head recency signal used in model input.',
    },
    T_H2HRecency365_Diff: {
      shortDescription: 'A transformed version of the broader head-to-head recency signal used in model input.',
    },
  };
  
  export const NN_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    ...NN_CONTEXT_FEATURE_HELP,
    ...NN_WP_CORE_FEATURE_HELP,
    ...NN_RAW_TS_FEATURE_HELP,
    ...NN_NORMALIZED_TS_FEATURE_HELP,
    ...NN_DERIVED_TS_FEATURE_HELP,
    ...NN_H2H_FEATURE_HELP,
  };