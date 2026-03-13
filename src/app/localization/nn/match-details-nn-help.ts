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

  export const NN_FEATURE_HELP: Record<string, NnFeatureHelpEntry> = {
    ...NN_CONTEXT_FEATURE_HELP,
  };