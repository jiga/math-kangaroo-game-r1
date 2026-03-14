export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type BandId = "g12" | "g34" | "g56" | "g78" | "g910" | "g1112";
export type PointTier = 3 | 4 | 5;

export type SkillId = string;

export type QuestionFormat = "text" | "svg";

export type VisualKind =
  | "maze"
  | "pictograph"
  | "venn"
  | "cube"
  | "symmetry"
  | "broken_line"
  | "region_compare"
  | "graph"
  | "formula"
  | "geometry"
  | "balance"
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
  bandId: BandId;
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
  grade: Grade;
  bandId: BandId;
  pointTier: PointTier;
  variantSeed: number;
}

export interface QuestionTemplate {
  id: string;
  grade: Grade;
  bandId: BandId;
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
  families: Partial<Record<string, SkillProgress>>;
  recentQuestionHashes: string[];
}

export type PracticeStage = "diagnostic" | "mastery" | "mock";

export interface PracticeSession {
  id: string;
  grade: Grade;
  bandId: BandId;
  stage: PracticeStage;
  index: number;
  total: number;
  startedAt: number;
  missesBySkill: Partial<Record<SkillId, number>>;
  missesByFamily: Partial<Record<string, number>>;
  askedQuestionHashes: Set<string>;
  answered: Array<{
    questionId: string;
    skillId: SkillId;
    familyId: string;
    familyKey: string;
    correct: boolean;
    responseMs: number;
  }>;
}

export interface SessionQuestion {
  question: QuestionInstance;
  sourceTemplateId: string;
}
