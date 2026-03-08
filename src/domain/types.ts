export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type PointTier = 3 | 4 | 5;

export type SkillId =
  | "counting_ordering"
  | "compare_number_region"
  | "ordinal_numbers"
  | "place_value"
  | "single_digit_add_sub"
  | "number_line"
  | "fractions_words"
  | "sorting_classifying"
  | "measurement_small"
  | "patterns"
  | "perimeter_broken_lines"
  | "relative_position"
  | "shape_properties"
  | "maze_shape_puzzles"
  | "cube_cuboid_visualization"
  | "likelihood_vocabulary"
  | "pictographs_bar_graphs"
  | "venn_diagrams_easy"
  | "calendar"
  | "money_small"
  | "clock_full_half"
  | "symmetry_rotation"
  | "prealgebra_balance";

export type QuestionFormat = "text" | "svg";

export type VisualKind =
  | "maze"
  | "pictograph"
  | "venn"
  | "cube"
  | "symmetry"
  | "broken_line"
  | "region_compare"
  | "lesson";

export interface VisualAssetSpec {
  kind: VisualKind;
  svg: string;
  altText: string;
}

export interface CoachPack {
  hint: string;
  errorDiagnosis: string;
  speedTactic: string;
  miniExample: string;
}

export interface QuestionInstance {
  id: string;
  grade: Grade;
  pointTier: PointTier;
  skillId: SkillId;
  familyId: string;
  format: QuestionFormat;
  prompt: string;
  options: [string, string, string, string, string];
  answerIndex: number;
  explanation: string;
  visualAssetSpec?: VisualAssetSpec;
  coachPackId: SkillId;
  strategyTags: string[];
  trapWarning?: string;
  variantKey: string;
}

export interface GenerationContext {
  templateId: string;
  grade: 1 | 2;
  pointTier: PointTier;
  variantSeed: number;
}

export interface QuestionTemplate {
  id: string;
  grade: 1 | 2;
  skillId: SkillId;
  familyId: string;
  pointTier: PointTier;
  format: QuestionFormat;
  generate: (ctx: GenerationContext) => QuestionInstance;
}

export interface SkillProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastSeenAt: number;
  nextReviewAt: number;
}

export interface PracticeProfile {
  version: number;
  createdAt: number;
  updatedAt: number;
  gradeStats: Record<string, { sessions: number; totalAttempts: number; totalCorrect: number }>;
  skills: Partial<Record<SkillId, SkillProgress>>;
  recentQuestionHashes: string[];
}

export type PracticeStage = "diagnostic" | "mastery" | "mock";

export interface PracticeSession {
  id: string;
  grade: 1 | 2;
  stage: PracticeStage;
  index: number;
  total: number;
  startedAt: number;
  missesBySkill: Partial<Record<SkillId, number>>;
  askedQuestionHashes: Set<string>;
  answered: Array<{
    questionId: string;
    skillId: SkillId;
    correct: boolean;
    responseMs: number;
  }>;
}

export interface SessionQuestion {
  question: QuestionInstance;
  sourceTemplateId: string;
}
