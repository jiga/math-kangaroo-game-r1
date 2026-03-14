import type { Grade, SkillId, VisualAssetSpec } from "../domain/types";

export type LessonValue = number | string;
export type GuidedTopicId = string;

export type GuidedControl =
  | {
      kind: "range";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      formatter?: (value: LessonValue) => string;
    }
  | {
      kind: "toggle";
      key: string;
      label: string;
      options: Array<{ label: string; value: LessonValue }>;
    };

export type GuidedStage = {
  id: string;
  title: string;
  body: (values: Record<string, LessonValue>) => string;
  derivation: (values: Record<string, LessonValue>) => string;
  visual: (values: Record<string, LessonValue>) => VisualAssetSpec;
  controls?: GuidedControl[];
  prompt?: (values: Record<string, LessonValue>) => string;
  options?: (values: Record<string, LessonValue>) => [string, string, string];
  correctIndex?: (values: Record<string, LessonValue>) => number;
  success?: (values: Record<string, LessonValue>) => string;
  retry?: (values: Record<string, LessonValue>) => string;
  speak?: (values: Record<string, LessonValue>) => string;
};

export type GuidedTopic = {
  id: GuidedTopicId;
  title: string;
  summary: string;
  skills: SkillId[];
  grades: Grade[];
  initialValues: Record<string, LessonValue>;
  stages: GuidedStage[];
};
