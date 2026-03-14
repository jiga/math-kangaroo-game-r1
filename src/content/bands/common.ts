import type {
  BandId,
  CoachPack,
  GenerationContext,
  Grade,
  PointTier,
  QuestionFormat,
  QuestionInstance,
  QuestionTemplate,
  SkillId,
  VisualAssetSpec
} from "../../domain/types";
import { SeededRng, hashQuestion, shuffled, shuffledOptions } from "../g1g2/helpers";

export interface CoverageRow {
  skillId: SkillId;
  title: string;
  domain: string;
  lessonTopic: string;
  summary: string;
  requiredTemplates: number;
  requiredFamilies: number;
  highValue?: boolean;
  coach?: Partial<CoachPack>;
}

export interface BandCoverageMap {
  bandId: BandId;
  grades: Grade[];
  targetTemplates: number;
  contestQuestions: number;
  pointDistribution: Record<"3" | "4" | "5", number>;
  curriculum: CoverageRow[];
}

export type DraftQuestion = {
  prompt: string;
  correct: string;
  distractors: string[];
  explanation: string;
  strategyTags: string[];
  trapWarning?: string;
  format?: QuestionFormat;
  visualAssetSpec?: VisualAssetSpec;
};

export type BandFamilySpec = {
  familyId: string;
  format?: QuestionFormat;
  generate: (ctx: GenerationContext, rng: SeededRng) => DraftQuestion;
};

export type BandFamilyLibrary = Record<SkillId, BandFamilySpec[]>;

export type ContestSlot = {
  skillId: SkillId;
  familyId: string;
  pointTier: PointTier;
};

export type PracticeProvider = {
  pickAny: (avoid: Set<string>, pointTier: PointTier) => QuestionInstance;
  pickBySkill: (skillId: SkillId, avoid: Set<string>, pointTier: PointTier) => QuestionInstance;
  pickByFamily: (skillId: SkillId, familyId: string, avoid: Set<string>, pointTier: PointTier) => QuestionInstance;
  allFamilies: (skillId: SkillId) => string[];
};

export interface BandBankApi {
  bandId: BandId;
  coverageMap: BandCoverageMap;
  buildTemplates: (grade: Grade) => QuestionTemplate[];
  buildContestQuestions: (grade: Grade, seed?: number) => QuestionInstance[];
  createPracticeProvider: (grade: Grade) => PracticeProvider;
  bankStats: (grade: Grade) => {
    total: number;
    bySkill: Record<string, number>;
    byTier: Record<string, number>;
    byFamily: Record<string, number>;
  };
  allSkills: () => SkillId[];
  allFamilies: (skillId: SkillId) => string[];
  skillMeta: () => CoverageRow[];
}

const DEFAULT_POINT_DISTRIBUTION: Record<"3" | "4" | "5", number> = {
  "3": 0.4,
  "4": 0.35,
  "5": 0.25
};

const templateCache = new Map<string, QuestionTemplate[]>();

export function gradeToBand(grade: Grade): BandId {
  if (grade <= 2) return "g12";
  if (grade <= 4) return "g34";
  if (grade <= 6) return "g56";
  if (grade <= 8) return "g78";
  if (grade <= 10) return "g910";
  return "g1112";
}

export function questionCountForGrade(grade: Grade): number {
  return grade <= 4 ? 24 : 30;
}

export function officialContestPointTierForTotal(index: number, total: number): PointTier {
  const segment = total / 3;
  if (index < segment) return 3;
  if (index < segment * 2) return 4;
  return 5;
}

export function roundRobinSkills(entries: Array<{ skillId: SkillId; count: number }>): SkillId[] {
  const buckets = entries.map((entry) => ({ ...entry }));
  const out: SkillId[] = [];
  while (buckets.some((bucket) => bucket.count > 0)) {
    for (const bucket of buckets) {
      if (bucket.count > 0) {
        out.push(bucket.skillId);
        bucket.count -= 1;
      }
    }
  }
  return out;
}

export function pointTierByIndex(index: number, total: number, distribution = DEFAULT_POINT_DISTRIBUTION): PointTier {
  const tier3 = Math.round(total * distribution["3"]);
  const tier4 = Math.round(total * distribution["4"]);
  if (index < tier3) return 3;
  if (index < tier3 + tier4) return 4;
  return 5;
}

export function numericDistractors(correct: number, offsets: number[], min = -999, max = 9999): string[] {
  const out: string[] = [];
  const seen = new Set<string>([String(correct)]);
  for (const offset of offsets) {
    const value = Math.max(min, Math.min(max, correct + offset));
    const text = String(value);
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  let step = 1;
  while (out.length < 4) {
    for (const delta of [step, -step, step + 1, -(step + 1)]) {
      const value = Math.max(min, Math.min(max, correct + delta));
      const text = String(value);
      if (!seen.has(text)) {
        seen.add(text);
        out.push(text);
        if (out.length === 4) break;
      }
    }
    step += 1;
  }
  return out.slice(0, 4);
}

export function textDistractors(correct: string, options: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([correct]);
  for (const option of options) {
    if (!seen.has(option)) {
      seen.add(option);
      out.push(option);
    }
    if (out.length === 4) break;
  }
  const fallbacks = ["none", "all", "cannot be determined", "a different choice", "not enough info"];
  for (const fallback of fallbacks) {
    if (out.length === 4) break;
    if (!seen.has(fallback)) {
      seen.add(fallback);
      out.push(fallback);
    }
  }
  while (out.length < 4) out.push(`choice ${out.length + 1}`);
  return out;
}

export function fractionText(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function simplifyFraction(numerator: number, denominator: number): [number, number] {
  const factor = gcd(numerator, denominator);
  return [numerator / factor, denominator / factor];
}

export function formatDecimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function buildQuestion(
  ctx: GenerationContext,
  skillId: SkillId,
  familyId: string,
  draft: DraftQuestion
): QuestionInstance {
  const rng = new SeededRng(ctx.variantSeed ^ 0x9e3779b9);
  const packed = shuffledOptions(String(draft.correct), draft.distractors.map(String), rng);
  return {
    id: `${ctx.templateId}:${ctx.variantSeed}`,
    grade: ctx.grade,
    bandId: ctx.bandId,
    pointTier: ctx.pointTier,
    skillId,
    familyId,
    format: draft.format || "text",
    prompt: draft.prompt,
    options: packed.options,
    answerIndex: packed.answerIndex,
    explanation: draft.explanation,
    visualAssetSpec: draft.visualAssetSpec,
    coachPackId: skillId,
    strategyTags: draft.strategyTags,
    trapWarning: draft.trapWarning,
    variantKey: hashQuestion([ctx.bandId, ctx.templateId, ctx.variantSeed, familyId, draft.prompt, draft.correct])
  };
}

function instantiate(template: QuestionTemplate, seed: number, tierOverride?: PointTier): QuestionInstance {
  return template.generate({
    templateId: template.id,
    grade: template.grade,
    bandId: template.bandId,
    pointTier: tierOverride || template.pointTier,
    variantSeed: seed
  });
}

function pickTemplate(
  templates: QuestionTemplate[],
  familyLibrary: BandFamilyLibrary,
  rng: SeededRng,
  opts: { skillId?: SkillId; familyId?: string; pointTier: PointTier; avoid?: Set<string> }
): QuestionInstance {
  const filtered = templates.filter((template) => {
    if (opts.skillId && template.skillId !== opts.skillId) return false;
    if (opts.familyId && template.familyId !== opts.familyId) return false;
    if (template.pointTier !== opts.pointTier) return false;
    return true;
  });

  let candidates = filtered;
  if (!candidates.length && opts.skillId && opts.familyId) {
    const fallback = buildSingleTemplate(templates[0]?.grade || 3, gradeToBand(templates[0]?.grade || 3), opts.skillId, opts.familyId, opts.pointTier, 1, familyLibrary);
    candidates = [fallback];
  } else if (!candidates.length && opts.skillId) {
    candidates = familyIdsForSkill(familyLibrary, opts.skillId).map((familyId, index) =>
      buildSingleTemplate(templates[0]?.grade || 3, gradeToBand(templates[0]?.grade || 3), opts.skillId as SkillId, familyId, opts.pointTier, index + 1, familyLibrary)
    );
  } else if (!candidates.length) {
    candidates = templates.filter((template) => template.pointTier === opts.pointTier);
  }

  const queue = shuffled(candidates.length ? candidates : templates, rng);
  for (const template of queue) {
    const question = instantiate(template, rng.int(1, 999999), opts.pointTier);
    if (!opts.avoid || !opts.avoid.has(question.variantKey)) return question;
  }
  return instantiate(queue[0], rng.int(1, 999999), opts.pointTier);
}

export function familyIdsForSkill(library: BandFamilyLibrary, skillId: SkillId): string[] {
  return (library[skillId] || []).map((family) => family.familyId);
}

export function buildSingleTemplate(
  grade: Grade,
  bandId: BandId,
  skillId: SkillId,
  familyId: string,
  pointTier: PointTier,
  ordinal: number,
  familyLibrary: BandFamilyLibrary
): QuestionTemplate {
  const family = (familyLibrary[skillId] || []).find((entry) => entry.familyId === familyId);
  if (!family) throw new Error(`Unknown family ${familyId} for skill ${skillId}`);
  const id = `${bandId}_${grade}_${skillId}_${familyId}_${String(ordinal).padStart(3, "0")}`;
  return {
    id,
    grade,
    bandId,
    skillId,
    familyId,
    pointTier,
    format: family.format || "text",
    generate: (ctx) => {
      const rng = new SeededRng(ctx.variantSeed + grade * 1009 + pointTier * 97 + ordinal * 13);
      const draft = family.generate(ctx, rng);
      return buildQuestion(ctx, skillId, familyId, draft);
    }
  };
}

export function createBandBankApi(args: {
  bandId: BandId;
  coverageMap: BandCoverageMap;
  familyLibrary: BandFamilyLibrary;
  contestBlueprint: ContestSlot[];
}): BandBankApi {
  const { bandId, coverageMap, familyLibrary, contestBlueprint } = args;

  function buildTemplates(grade: Grade): QuestionTemplate[] {
    const cacheKey = `${bandId}:${grade}`;
    const cached = templateCache.get(cacheKey);
    if (cached) return cached;

    const orderedSkills = roundRobinSkills(
      coverageMap.curriculum.map((row) => ({ skillId: row.skillId, count: row.requiredTemplates }))
    );
    const expanded = [...orderedSkills];
    const loopSkills = coverageMap.curriculum.map((row) => row.skillId);
    let topUp = 0;
    while (expanded.length < coverageMap.targetTemplates) {
      expanded.push(loopSkills[topUp % loopSkills.length]);
      topUp += 1;
    }

    const familyOrdinalBySkill: Record<string, number> = {};
    const templateCountBySignature: Record<string, number> = {};
    const templates = expanded.map((skillId, index) => {
      const familyIds = familyIdsForSkill(familyLibrary, skillId);
      const familyIndex = familyOrdinalBySkill[skillId] || 0;
      const familyId = familyIds[familyIndex % familyIds.length];
      familyOrdinalBySkill[skillId] = familyIndex + 1;
      const pointTier = pointTierByIndex(index, expanded.length, coverageMap.pointDistribution);
      const signature = `${skillId}:${familyId}:${pointTier}`;
      templateCountBySignature[signature] = (templateCountBySignature[signature] || 0) + 1;
      return buildSingleTemplate(
        grade,
        bandId,
        skillId,
        familyId,
        pointTier,
        templateCountBySignature[signature],
        familyLibrary
      );
    });

    templateCache.set(cacheKey, templates);
    return templates;
  }

  function buildContestQuestions(grade: Grade, seed = Date.now()): QuestionInstance[] {
    const templates = buildTemplates(grade);
    const rng = new SeededRng(seed + grade * 73);
    const avoid = new Set<string>();
    return contestBlueprint.map((slot, index) => {
      const pointTier = slot.pointTier || officialContestPointTierForTotal(index, coverageMap.contestQuestions);
      const question = pickTemplate(templates, familyLibrary, rng, {
        skillId: slot.skillId,
        familyId: slot.familyId,
        pointTier,
        avoid
      });
      avoid.add(question.variantKey);
      return question;
    });
  }

  function createPracticeProvider(grade: Grade): PracticeProvider {
    const templates = buildTemplates(grade);
    const rng = new SeededRng(Date.now() + grade * 31);
    return {
      pickAny: (avoid, pointTier) => pickTemplate(templates, familyLibrary, rng, { pointTier, avoid }),
      pickBySkill: (skillId, avoid, pointTier) => pickTemplate(templates, familyLibrary, rng, { skillId, pointTier, avoid }),
      pickByFamily: (skillId, familyId, avoid, pointTier) =>
        pickTemplate(templates, familyLibrary, rng, { skillId, familyId, pointTier, avoid }),
      allFamilies: (skillId) => familyIdsForSkill(familyLibrary, skillId)
    };
  }

  function bankStats(grade: Grade): {
    total: number;
    bySkill: Record<string, number>;
    byTier: Record<string, number>;
    byFamily: Record<string, number>;
  } {
    const templates = buildTemplates(grade);
    const bySkill: Record<string, number> = {};
    const byTier: Record<string, number> = { "3": 0, "4": 0, "5": 0 };
    const byFamily: Record<string, number> = {};
    for (const template of templates) {
      bySkill[template.skillId] = (bySkill[template.skillId] || 0) + 1;
      byTier[String(template.pointTier)] += 1;
      byFamily[`${template.skillId}:${template.familyId}`] = (byFamily[`${template.skillId}:${template.familyId}`] || 0) + 1;
    }
    return { total: templates.length, bySkill, byTier, byFamily };
  }

  return {
    bandId,
    coverageMap,
    buildTemplates,
    buildContestQuestions,
    createPracticeProvider,
    bankStats,
    allSkills: () => coverageMap.curriculum.map((row) => row.skillId),
    allFamilies: (skillId) => familyIdsForSkill(familyLibrary, skillId),
    skillMeta: () => coverageMap.curriculum
  };
}
