import coverageMap from "./coverage-map.json";
import type {
  Grade,
  PointTier,
  QuestionInstance,
  QuestionTemplate,
  SkillId
} from "../../domain/types";
import { SeededRng, officialContestPointTier, pointTierByIndex, shuffled } from "./helpers";
import { createTemplate, familyIdsForSkill } from "./templates";

const cache = new Map<1 | 2, QuestionTemplate[]>();

type ContestSlot = {
  skillId: SkillId;
  familyId: string;
  pointTier: PointTier;
};

const CONTEST_BLUEPRINT: Record<1 | 2, ContestSlot[]> = {
  1: [
    { skillId: "counting_ordering", familyId: "forward_sequence", pointTier: 3 },
    { skillId: "ordinal_numbers", familyId: "from_start", pointTier: 3 },
    { skillId: "shape_properties", familyId: "count_sides", pointTier: 3 },
    { skillId: "single_digit_add_sub", familyId: "fact_fluency", pointTier: 3 },
    { skillId: "sorting_classifying", familyId: "exclusion_shelf", pointTier: 3 },
    { skillId: "compare_number_region", familyId: "compare_numbers", pointTier: 3 },
    { skillId: "patterns", familyId: "repeating_shape_pattern", pointTier: 3 },
    { skillId: "relative_position", familyId: "middle_of_line", pointTier: 3 },

    { skillId: "place_value", familyId: "tens_and_ones", pointTier: 4 },
    { skillId: "number_line", familyId: "jump_direction", pointTier: 4 },
    { skillId: "fractions_words", familyId: "fraction_of_total", pointTier: 4 },
    { skillId: "single_digit_add_sub", familyId: "multi_step_remaining", pointTier: 4 },
    { skillId: "calendar", familyId: "days_forward", pointTier: 4 },
    { skillId: "money_small", familyId: "coin_total", pointTier: 4 },
    { skillId: "clock_full_half", familyId: "time_words_to_digital", pointTier: 4 },
    { skillId: "pictographs_bar_graphs", familyId: "largest_row", pointTier: 4 },

    { skillId: "compare_number_region", familyId: "region_area_compare", pointTier: 5 },
    { skillId: "perimeter_broken_lines", familyId: "broken_line_total", pointTier: 5 },
    { skillId: "maze_shape_puzzles", familyId: "turn_count", pointTier: 5 },
    { skillId: "venn_diagrams_easy", familyId: "exactly_one_set", pointTier: 5 },
    { skillId: "cube_cuboid_visualization", familyId: "hidden_faces", pointTier: 5 },
    { skillId: "symmetry_rotation", familyId: "mirror_word", pointTier: 5 },
    { skillId: "likelihood_vocabulary", familyId: "bag_probability", pointTier: 5 },
    { skillId: "prealgebra_balance", familyId: "equal_pairs_weights", pointTier: 5 }
  ],
  2: [
    { skillId: "counting_ordering", familyId: "grouped_count", pointTier: 3 },
    { skillId: "place_value", familyId: "compose_number", pointTier: 3 },
    { skillId: "single_digit_add_sub", familyId: "fact_fluency", pointTier: 3 },
    { skillId: "compare_number_region", familyId: "place_value_compare", pointTier: 3 },
    { skillId: "patterns", familyId: "growing_number_pattern", pointTier: 3 },
    { skillId: "shape_properties", familyId: "shape_description", pointTier: 3 },
    { skillId: "money_small", familyId: "which_set_matches", pointTier: 3 },
    { skillId: "ordinal_numbers", familyId: "from_end", pointTier: 3 },

    { skillId: "number_line", familyId: "missing_start", pointTier: 4 },
    { skillId: "fractions_words", familyId: "whole_from_fraction", pointTier: 4 },
    { skillId: "sorting_classifying", familyId: "odd_one_out", pointTier: 4 },
    { skillId: "measurement_small", familyId: "same_unit_sum", pointTier: 4 },
    { skillId: "relative_position", familyId: "above_below", pointTier: 4 },
    { skillId: "calendar", familyId: "month_order", pointTier: 4 },
    { skillId: "clock_full_half", familyId: "half_hour_later", pointTier: 4 },
    { skillId: "pictographs_bar_graphs", familyId: "legend_total", pointTier: 4 },

    { skillId: "compare_number_region", familyId: "region_area_compare", pointTier: 5 },
    { skillId: "perimeter_broken_lines", familyId: "rectangle_perimeter", pointTier: 5 },
    { skillId: "maze_shape_puzzles", familyId: "shortest_path_reasoning", pointTier: 5 },
    { skillId: "cube_cuboid_visualization", familyId: "count_marks_on_cube", pointTier: 5 },
    { skillId: "venn_diagrams_easy", familyId: "exactly_one_set", pointTier: 5 },
    { skillId: "symmetry_rotation", familyId: "line_of_symmetry_count", pointTier: 5 },
    { skillId: "likelihood_vocabulary", familyId: "equally_likely", pointTier: 5 },
    { skillId: "prealgebra_balance", familyId: "same_value_both_sides", pointTier: 5 }
  ]
};

function topUpSkills(grade: 1 | 2): SkillId[] {
  if (grade === 1) {
    return [
      "single_digit_add_sub",
      "compare_number_region",
      "patterns",
      "measurement_small",
      "maze_shape_puzzles",
      "venn_diagrams_easy",
      "pictographs_bar_graphs",
      "prealgebra_balance"
    ];
  }
  return [];
}

function roundRobinSkills(entries: Array<{ skillId: SkillId; count: number }>): SkillId[] {
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

export function buildGradeTemplates(grade: 1 | 2): QuestionTemplate[] {
  if (cache.has(grade)) return cache.get(grade)!;

  const config = coverageMap.grades[String(grade) as "1" | "2"];
  const orderedSkills = roundRobinSkills(
    config.curriculum.map((row) => ({ skillId: row.skillId as SkillId, count: row.requiredTemplates }))
  );

  const expanded = [...orderedSkills];
  const topUp = topUpSkills(grade);
  let topUpIndex = 0;
  while (expanded.length < config.targetTemplates) {
    expanded.push(topUp[topUpIndex % topUp.length]);
    topUpIndex += 1;
  }

  const familyOrdinalBySkill: Partial<Record<SkillId, number>> = {};
  const templateCountBySignature: Record<string, number> = {};
  const templates = expanded.map((skillId, index) => {
    const familyIds = familyIdsForSkill(skillId);
    const familyIndex = familyOrdinalBySkill[skillId] || 0;
    const familyId = familyIds[familyIndex % familyIds.length];
    familyOrdinalBySkill[skillId] = familyIndex + 1;

    const pointTier = pointTierByIndex(index, expanded.length);
    const signature = `${skillId}:${familyId}:${pointTier}`;
    templateCountBySignature[signature] = (templateCountBySignature[signature] || 0) + 1;

    return createTemplate(grade, skillId, familyId, pointTier, templateCountBySignature[signature]);
  });

  cache.set(grade, templates);
  return templates;
}

export function allGrade12Skills(grade: 1 | 2): SkillId[] {
  return coverageMap.grades[String(grade) as "1" | "2"].curriculum.map((row) => row.skillId as SkillId);
}

function instantiate(template: QuestionTemplate, seed: number, tierOverride?: PointTier): QuestionInstance {
  return template.generate({
    templateId: template.id,
    grade: template.grade,
    pointTier: tierOverride || template.pointTier,
    variantSeed: seed
  });
}

function pickTemplate(
  templates: QuestionTemplate[],
  rng: SeededRng,
  opts: { skillId?: SkillId; familyId?: string; pointTier: PointTier; avoid?: Set<string> }
): QuestionInstance {
  const grade = (templates[0]?.grade || 1) as 1 | 2;
  const filtered = templates.filter((template) => {
    if (opts.skillId && template.skillId !== opts.skillId) return false;
    if (opts.familyId && template.familyId !== opts.familyId) return false;
    if (template.pointTier !== opts.pointTier) return false;
    return true;
  });

  let candidates = filtered;
  if (!candidates.length && opts.skillId && opts.familyId) {
    candidates = [createTemplate(grade, opts.skillId, opts.familyId, opts.pointTier, 1)];
  } else if (!candidates.length && opts.skillId) {
    candidates = familyIdsForSkill(opts.skillId).map((familyId, index) =>
      createTemplate(grade, opts.skillId as SkillId, familyId, opts.pointTier, index + 1)
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

export function buildContestQuestions(grade: Grade, seed = Date.now()): QuestionInstance[] {
  if (grade > 2) return [];

  const templates = buildGradeTemplates(grade);
  const rng = new SeededRng(seed);
  const avoid = new Set<string>();
  return CONTEST_BLUEPRINT[grade].map((slot, index) => {
    const pointTier = slot.pointTier || officialContestPointTier(index);
    const question = pickTemplate(templates, rng, {
      skillId: slot.skillId,
      familyId: slot.familyId,
      pointTier,
      avoid
    });
    avoid.add(question.variantKey);
    return question;
  });
}

export function createPracticeProvider(grade: 1 | 2): {
  pickAny: (avoid: Set<string>, pointTier: PointTier) => QuestionInstance;
  pickBySkill: (skillId: SkillId, avoid: Set<string>, pointTier: PointTier) => QuestionInstance;
} {
  const templates = buildGradeTemplates(grade);
  const rng = new SeededRng(Date.now() + grade * 31);

  return {
    pickAny: (avoid, pointTier) => pickTemplate(templates, rng, { pointTier, avoid }),
    pickBySkill: (skillId, avoid, pointTier) => pickTemplate(templates, rng, { skillId, pointTier, avoid })
  };
}

export function bankStats(grade: 1 | 2): {
  total: number;
  bySkill: Record<string, number>;
  byTier: Record<string, number>;
  byFamily: Record<string, number>;
} {
  const templates = buildGradeTemplates(grade);
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
