import test from "node:test";
import assert from "node:assert/strict";
import { allSkillBlueprints, buildConceptLab } from "../src/learn/conceptLab";
import { buildGradeTemplates } from "../src/content/g1g2/bank";
import { getDeterministicCoach } from "../src/coach/deterministicCoach";
import type { SkillId } from "../src/domain/types";

const ALL_SKILLS: SkillId[] = [
  "counting_ordering",
  "compare_number_region",
  "ordinal_numbers",
  "place_value",
  "single_digit_add_sub",
  "number_line",
  "fractions_words",
  "sorting_classifying",
  "measurement_small",
  "patterns",
  "perimeter_broken_lines",
  "relative_position",
  "shape_properties",
  "maze_shape_puzzles",
  "cube_cuboid_visualization",
  "likelihood_vocabulary",
  "pictographs_bar_graphs",
  "venn_diagrams_easy",
  "calendar",
  "money_small",
  "clock_full_half",
  "symmetry_rotation",
  "prealgebra_balance"
];

test("concept lab has a playbook for every Grade 1-2 skill", () => {
  assert.deepEqual(new Set(allSkillBlueprints()), new Set(ALL_SKILLS));
});

test("learn concept lab includes scaffolded check and transfer steps", () => {
  const template = buildGradeTemplates(1).find((item) => item.familyId === "multi_step_remaining");
  assert.ok(template);
  const question = template!.generate({
    templateId: template!.id,
    grade: 1,
    pointTier: template!.pointTier,
    variantSeed: 42
  });
  const coach = getDeterministicCoach(question, false);
  const flow = buildConceptLab(question, coach, "learn");

  assert.equal(flow.steps.length, 4);
  assert.equal(flow.steps[1].kind, "check");
  assert.equal(flow.steps[3].kind, "check");
  assert.match(flow.steps[0].body, /Today's move:/);
  assert.match(flow.steps[2].body, /Speed trick:/);
});

test("remediation concept lab turns a miss into a follow-up check", () => {
  const template = buildGradeTemplates(2).find((item) => item.familyId === "equal_pairs_weights");
  assert.ok(template);
  const question = template!.generate({
    templateId: template!.id,
    grade: 2,
    pointTier: template!.pointTier,
    variantSeed: 99
  });
  const coach = getDeterministicCoach(question, false);
  const flow = buildConceptLab(question, coach, "remediation");

  assert.equal(flow.steps.length, 2);
  assert.equal(flow.steps[0].kind, "info");
  assert.equal(flow.steps[1].kind, "check");
  assert.match(flow.steps[0].body, /Trap to avoid:/);
  assert.ok(flow.steps[1].prompt);
  assert.equal(flow.steps[1].options?.length, 3);
});
