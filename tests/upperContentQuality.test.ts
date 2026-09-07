import test from "node:test";
import assert from "node:assert/strict";
import type { Grade, QuestionInstance, QuestionTemplate } from "../src/domain/types";
import type { GuidedControl, GuidedTopic, LessonValue } from "../src/learn/guidedTypes";
import { buildTemplatesForGrade } from "../src/content/bands/index";
import { numericDistractors, optionValueKey, parseBandCoverageMap, rationalText, textDistractors } from "../src/content/bands/common";
import { buildGuidedTopics } from "../src/content/bands/guidedFactory";
import { systemGraphVisual } from "../src/content/bands/visuals";
import { coverageMap as g34 } from "../src/content/bands/g34/families";
import { coverageMap as g56 } from "../src/content/bands/g56/families";
import { coverageMap as g78 } from "../src/content/bands/g78/families";
import { coverageMap as g910 } from "../src/content/bands/g910/families";
import { coverageMap as g1112 } from "../src/content/bands/g1112/families";

const coverageMaps = [g34, g56, g78, g910, g1112];
const topics = coverageMaps.flatMap(buildGuidedTopics);
const seedCount = 256;
type Values = Record<string, LessonValue>;

function generate(template: QuestionTemplate, variantSeed: number): QuestionInstance {
  return template.generate({ templateId: template.id, grade: template.grade, bandId: template.bandId, pointTier: template.pointTier, variantSeed });
}

function samples(grade: Grade, familyId: string): QuestionInstance[] {
  const template = buildTemplatesForGrade(grade).find((item) => item.familyId === familyId);
  assert.ok(template, `Missing ${grade}/${familyId}`);
  return Array.from({ length: seedCount }, (_, index) => generate(template, index + 1));
}

// An independent evaluator: deliberately do not use the production canonicalizer.
function valueOf(text: string): number {
  if (text.endsWith("%")) return valueOf(text.slice(0, -1)) / 100;
  if (/^\u221A\d+$/.test(text)) return Math.sqrt(Number(text.slice(1)));
  const fraction = /^(-?\d+)\/(-?\d+)$/.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
}

function assertOnlyCorrect(question: QuestionInstance, predicate: (option: string) => boolean): void {
  const matches = question.options.flatMap((option, index) => predicate(option) ? [index] : []);
  assert.deepEqual(matches, [question.answerIndex], `${question.id}: ${question.prompt}; ${question.options.join(" | ")}`);
}

function assertAnswer(question: QuestionInstance, expected: number): void {
  assertOnlyCorrect(question, (option) => Math.abs(valueOf(option) - expected) < 1e-10);
}

function matchNumbers(question: QuestionInstance, pattern: RegExp): number[] {
  const match = pattern.exec(question.prompt);
  assert.ok(match, question.prompt);
  return match.slice(1).map(Number);
}

function topicWith(id: string): GuidedTopic {
  const topic = topics.find((item) => item.id === id);
  assert.ok(topic, id);
  return topic;
}

function checkAnswer(topic: GuidedTopic, overrides: Values, expected: number): void {
  const stage = topic.stages.find((item) => item.id === "check");
  assert.ok(stage?.options && stage.correctIndex);
  const values = { ...topic.initialValues, ...overrides };
  const choices = stage.options(values);
  const matches = choices.flatMap((choice, index) => Math.abs(valueOf(choice) - expected) < 1e-10 ? [index] : []);
  assert.deepEqual(matches, [stage.correctIndex(values)], `${topic.id} ${JSON.stringify(values)}: ${choices.join(" | ")}`);
}

function controlsFor(topic: GuidedTopic): GuidedControl[] {
  return [...new Map(topic.stages.flatMap((stage) => stage.controls || []).map((control) => [control.key, control])).values()];
}

function controlValues(control: GuidedControl, extrema: boolean): LessonValue[] {
  if (control.kind === "toggle") return control.options.map((option) => option.value);
  if (extrema) return [control.min, control.max];
  return Array.from({ length: Math.floor((control.max - control.min) / (control.step || 1)) + 1 }, (_, index) => control.min + index * (control.step || 1));
}

function combinations(topic: GuidedTopic, extrema = false): Values[] {
  return controlsFor(topic).reduce<Values[]>((states, control) => states.flatMap((state) => controlValues(control, extrema).map((value) => ({ ...state, [control.key]: value }))), [{ ...topic.initialValues }]);
}

test("numeric choices deduplicate exact fractions, decimals, percentages, and signed zero", () => {
  for (const option of ["2/4", "0.50", "50%", "-1/-2"]) assert.equal(optionValueKey(option), optionValueKey("1/2"));
  assert.equal(optionValueKey("-0.00"), optionValueKey("0"));
  assert.notEqual(optionValueKey("0.333333333333"), optionValueKey("1/3"));
  const choices = textDistractors("1/2", ["2/4", "0.5", "50%", "1/3", "2/6", "3/4", "1/4", "2"]);
  assert.deepEqual(choices, ["1/3", "3/4", "1/4", "2"]);
  assert.equal(rationalText(4, -6), "-2/3");
  assert.equal(rationalText(6, 3), "2");
  assert.throws(() => rationalText(1, 0), /nonzero denominator/);
  assert.throws(() => optionValueKey("1/0"), /Invalid numeric option/);
  assert.throws(() => numericDistractors(NaN, [1]), /finite values/);
  assert.throws(() => numericDistractors(1, [0], 0, 2), /cannot supply/);
  assert.equal(numericDistractors(2, [0, 0], 0, 4).length, 4);
});

test("coverage JSON is narrowed centrally and rejects invalid bands, grades, and requirements", () => {
  for (const coverage of coverageMaps) assert.deepEqual(parseBandCoverageMap(coverage), coverage);
  assert.throws(() => parseBandCoverageMap({ ...g34, bandId: "unknown" }), /Unknown coverage band/);
  for (const grades of [[0], [3.5], [13], [5], [], [3, 3]]) assert.throws(() => parseBandCoverageMap({ ...g34, grades }));
  assert.throws(() => parseBandCoverageMap({ ...g34, curriculum: [] }), /curriculum/);
  assert.throws(() => parseBandCoverageMap({ ...g34, curriculum: [{ ...g34.curriculum[0], requiredFamilies: 0 }] }), /requirements/);
});

for (const grade of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const) {
  test(`grade ${grade}: every family/tier has five semantically distinct choices across 64 seeds`, () => {
    const templates = [...new Map(buildTemplatesForGrade(grade).map((template) => [`${template.skillId}:${template.familyId}:${template.pointTier}`, template])).values()];
    for (const template of templates) {
      for (let seed = 1; seed <= 64; seed += 1) {
        const question = generate(template, seed);
        const keys = question.options.map((option) => Number.isFinite(valueOf(option)) ? `number:${valueOf(option)}` : `text:${option}`);
        assert.equal(new Set(keys).size, 5, `${question.id}: ${question.options.join(" | ")}`);
        assert.equal(new Set(question.options.map(optionValueKey)).size, 5, question.id);
      }
    }
  });
}

test("percent amounts and increases are exact integers, never silently rounded", () => {
  for (const grade of [5, 6, 7, 8] as const) {
    for (const question of samples(grade, "percent_of_number")) {
      const [percent, base] = matchNumbers(question, /What is (\d+)% of (\d+)/);
      const expected = percent * base / 100;
      assert.ok(Number.isInteger(expected), question.id);
      assertAnswer(question, expected);
    }
    for (const question of samples(grade, "percent_change")) {
      const [start, percent] = matchNumbers(question, /price of (\d+) increases by (\d+)%/);
      const expected = start + start * percent / 100;
      assert.ok(Number.isInteger(expected), question.id);
      assertAnswer(question, expected);
    }
  }
});

test("fraction operations and equivalent visuals have exactly one correct value", () => {
  for (const family of ["add_like_denominator", "fraction_difference", "visual_equivalent"]) {
    for (const question of samples(5, family)) {
      if (family === "visual_equivalent") {
        const match = /(\d+) of (\d+) equal parts/.exec(question.visualAssetSpec?.altText || "");
        assert.ok(match, question.id);
        assertAnswer(question, Number(match[1]) / Number(match[2]));
      } else {
        const [a, b, c, d] = matchNumbers(question, /Compute (\d+)\/(\d+) [+-] (\d+)\/(\d+)/);
        assertAnswer(question, a / b + (family === "fraction_difference" ? -1 : 1) * c / d);
      }
    }
  }
});

test("decimal comparison handles equivalent formatting and ties correctly", () => {
  let ties = 0;
  for (const question of samples(7, "decimal_compare")) {
    const [a, b] = matchNumbers(question, /greater: ([\d.]+) or ([\d.]+)\?/);
    if (a === b) {
      ties += 1;
      assertOnlyCorrect(question, (option) => option === "they are equal");
    } else assertAnswer(question, Math.max(a, b));
  }
  assert.ok(ties > 0, "Sweep must exercise equal decimals");
});

test("inequality and modular distractors never satisfy the question predicate", () => {
  for (const grade of [9, 10, 11, 12] as const) {
    for (const question of samples(grade, "one_step_inequality")) {
      const [add, bound] = matchNumbers(question, /x \+ (\d+) < (\d+)/);
      assertOnlyCorrect(question, (option) => valueOf(option) + add < bound);
    }
    for (const question of samples(grade, "mod_pattern")) {
      const [residue, divisor] = matchNumbers(question, /remainder (\d+) when divided by (\d+)/);
      assertOnlyCorrect(question, (option) => valueOf(option) % divisor === residue);
    }
  }
});

test("ordering asks for the uniquely constrained person and elimination declares its universe", () => {
  const question = samples(11, "ordering_logic")[0];
  assert.match(question.prompt, /both Ava and Ben before/);
  const names = ["Ava", "Ben", "Cora", "Drew"];
  const orders: string[][] = [];
  for (const a of names) for (const b of names) for (const c of names) for (const d of names) {
    const order = [a, b, c, d];
    if (new Set(order).size === 4 && order.indexOf("Ava") < order.indexOf("Ben") && order.indexOf("Ben") < order.indexOf("Cora")) orders.push(order);
  }
  assertOnlyCorrect(question, (option) => names.includes(option) && orders.every((order) => order.indexOf("Ava") < order.indexOf(option) && order.indexOf("Ben") < order.indexOf(option)));
  assert.match(samples(11, "elimination_clues")[0].prompt, /one of four colors: red, blue, green, or yellow/);
});

test("systems have nonzero determinants and a uniquely correct x", () => {
  for (const grade of [9, 10] as const) for (const question of samples(grade, "solve_system")) {
    const [sum, a, b, total] = matchNumbers(question, /x \+ y = (\d+), and (\d+)x \+ (\d+)y = (\d+)/);
    assert.notEqual(a, b, question.id);
    assertAnswer(question, (total - b * sum) / (a - b));
  }
  assert.match(samples(9, "intersection_table")[0].prompt, /different line B/);
});

test("rational evaluation retains exact fractions rather than rounded decimals", () => {
  for (const question of samples(11, "evaluate_rational")) {
    const [x] = matchNumbers(question, /x = (\d+)/);
    assertAnswer(question, (x + 1) / (x - 1));
  }
});

test("set populations are nonnegative and quadratic distractors do not swap a correct factor pair", () => {
  for (const question of samples(11, "set_reasoning")) {
    const [total, onlyCircle, both, onlySquare] = matchNumbers(question, /There are (\d+) objects\. (\d+) are only in Circle, (\d+) are in both, and (\d+) are only in Square/);
    const expected = total - onlyCircle - both - onlySquare;
    assert.ok(expected >= 0, question.id);
    assertAnswer(question, expected);
  }
  for (const question of samples(9, "factor_quadratic")) {
    const [sum, product] = matchNumbers(question, /x\^2 \+ (\d+)x \+ (\d+)/);
    assertOnlyCorrect(question, (option) => {
      const pair = /^(\d+) and (\d+)$/.exec(option);
      return Boolean(pair && Number(pair[1]) + Number(pair[2]) === sum && Number(pair[1]) * Number(pair[2]) === product);
    });
  }
});

test("guided systems, triangles, and percents remain exact for every allowed control combination", () => {
  const algebra = topicWith("g910_algebra_models");
  for (const values of combinations(algebra)) checkAnswer(algebra, values, (Number(values.intercept2) - Number(values.intercept1)) / (Number(values.slope1) - Number(values.slope2)));
  checkAnswer(algebra, { slope1: 2 }, 4 / 3);
  const triangle = topicWith("g1112_geometry_trig");
  for (const values of combinations(triangle)) checkAnswer(triangle, values, Math.hypot(Number(values.adjacent), Number(values.opposite)));
  checkAnswer(triangle, { adjacent: 3, opposite: 5 }, Math.sqrt(34));
  const percent = topicWith("g78_ratios_percents");
  for (const values of combinations(percent)) {
    assert.ok(Number.isInteger(Number(values.part) * 100 / Number(values.whole)));
    checkAnswer(percent, values, Number(values.part) / Number(values.whole));
  }
});

test("guided probability controls cannot exceed the sample space", () => {
  for (const id of ["g56_graphs_probability", "g910_probability_strategy"]) {
    const topic = topicWith(id);
    for (const values of combinations(topic)) {
      const total = Number(values.rows) * Number(values.cols);
      assert.ok(Number(values.favorable) <= total);
      checkAnswer(topic, values, Number(values.favorable) / total);
    }
  }
});

test("system graph clips strokes inside the panel and retains the true intersection across controls", () => {
  for (const values of combinations(topicWith("g910_algebra_models"))) {
    const m1 = Number(values.slope1);
    const b1 = Number(values.intercept1);
    const m2 = Number(values.slope2);
    const b2 = Number(values.intercept2);
    const visual = systemGraphVisual(m1, b1, m2, b2, "two rules, one point");
    const clipId = `system-plot-${m1}-${b1}-${m2}-${b2}`;
    assert.ok(visual.svg.includes(`<clipPath id='${clipId}' clipPathUnits='userSpaceOnUse'><rect x='30' y='38' width='178' height='64'/>`));
    assert.ok(visual.svg.includes(`<g clip-path='url(#${clipId})'>`));
    assert.equal((visual.svg.match(/<svg\b/g) || []).length, 1, "Avoid nested SVGs affected by app-wide sizing rules");
    const marker = /<circle cx='([^']+)' cy='([^']+)' r='5'/.exec(visual.svg);
    assert.ok(marker);
    const px = Number(marker[1]);
    const py = Number(marker[2]);
    assert.ok(px - 5 >= 30 && px + 5 <= 208, `marker clipped horizontally: ${px}`);
    assert.ok(py - 5 >= 38 && py + 5 <= 102, `marker clipped vertically: ${py}`);
    const plottedLines = [...visual.svg.matchAll(/<line x1='([^']+)' y1='([^']+)' x2='([^']+)' y2='([^']+)'[^>]*stroke-width='2.2'/g)];
    assert.equal(plottedLines.length, 2);
    for (const line of plottedLines) {
      const [x1, y1, x2, y2] = line.slice(1).map(Number);
      const expectedY = y1 + (px - x1) * (y2 - y1) / (x2 - x1);
      assert.ok(Math.abs(expectedY - py) < 1e-9, "intersection marker must lie on both plotted lines");
    }
  }
});

test("zero vertical shift has one unchanged answer and no unrelated transforms", () => {
  const topic = topicWith("g1112_functions_analysis");
  const stage = topic.stages.find((item) => item.id === "check");
  assert.ok(stage?.options && stage.correctIndex);
  const values = { ...topic.initialValues, shiftY: 0 };
  assert.equal(stage.options(values)[stage.correctIndex(values)], "it stays in the same place");
  assert.ok(!stage.options(values).some((option) => /up 0|right 0/.test(option)));
  assert.match(stage.success?.(values) || "", /unchanged/);
});

test("guided checks are stable, semantically unique, and not always answer zero at control extrema", () => {
  const positions = new Set<number>();
  for (const topic of topics) {
    for (const values of [topic.initialValues, ...combinations(topic, true)]) {
      for (const stage of topic.stages) {
        const visual = stage.visual(values);
        assert.ok(visual.svg.startsWith("<svg"), `${topic.id}/${stage.id}`);
        assert.ok(!/NaN|Infinity|undefined/.test(visual.svg), `${topic.id}/${stage.id}`);
        if (stage.checkVisual) {
          const checkVisual = stage.checkVisual(values);
          assert.ok(checkVisual.svg.startsWith("<svg"), `${topic.id}/${stage.id} check visual`);
          assert.ok(!/NaN|Infinity|undefined/.test(checkVisual.svg), `${topic.id}/${stage.id} check visual`);
          assert.ok(checkVisual.altText.length > 6);
        }
        if (!stage.options || !stage.correctIndex) continue;
        const options = stage.options(values);
        const index = stage.correctIndex(values);
        assert.ok(index >= 0 && index < 3);
        assert.equal(new Set(options.map(optionValueKey)).size, 3, `${topic.id}: ${options}`);
        assert.deepEqual(stage.options({ ...values }), options);
        assert.deepEqual(stage.options(Object.fromEntries(Object.entries(values).reverse())), options);
        assert.equal(stage.correctIndex({ ...values }), index);
        positions.add(index);
      }
    }
  }
  assert.deepEqual([...positions].sort(), [0, 1, 2]);
  const roots = topicWith("g1112_advanced_algebra");
  assert.ok(!roots.stages.find((stage) => stage.id === "check")?.derivation(roots.initialValues).includes("= 7"));
  const triangle = topicWith("g1112_geometry_trig");
  assert.match(triangle.stages.find((stage) => stage.id === "check")!.visual(triangle.initialValues).altText, /unknown hypotenuse/);
  const algebra = topicWith("g910_algebra_models");
  assert.match(algebra.stages.find((stage) => stage.id === "check")!.visual({ ...algebra.initialValues, slope1: 2 }).altText, /2x \+ 2 and y = -1x \+ 6/);
});

test("answer-revealing upper visuals have dedicated given-only check diagrams", () => {
  const required = [
    "g56_fractions_ratios", "g56_algebra_patterns", "g56_number_theory",
    "g78_graphs_functions", "g78_exam_labs",
    "g910_algebra_models", "g910_functions_sequences", "g910_exam_labs", "g910_number_theory_strategy",
    "g1112_advanced_algebra", "g1112_functions_analysis", "g1112_geometry_trig", "g1112_number_theory", "g1112_exam_labs"
  ];
  for (const id of required) {
    const topic = topicWith(id);
    const stage = topic.stages.find((item) => item.id === "check");
    assert.ok(stage?.checkVisual, `${id} must not fall back to its worked visual`);
  }

  const renderCheck = (id: string, values: Values) => {
    const topic = topicWith(id);
    const stage = topic.stages.find((item) => item.id === "check");
    assert.ok(stage?.checkVisual);
    const visual = stage.checkVisual({ ...topic.initialValues, ...values });
    const labels = [...visual.svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]).join("; ");
    return { visual, labels };
  };
  const roots = renderCheck("g1112_advanced_algebra", { root1: 2, root2: 5 });
  assert.match(roots.labels, /first root = 2/);
  assert.match(roots.labels, /second root = 5/);
  assert.match(roots.labels, /sum of the roots = \?/);
  assert.ok(!roots.labels.includes("7"));
  const system = renderCheck("g910_algebra_models", { slope1: 2 });
  assert.match(system.labels, /y = 2x \+ 2/);
  assert.match(system.labels, /y = -1x \+ 6/);
  assert.match(system.labels, /intersection = \?/);
  assert.ok(!system.labels.includes("4/3") && !system.visual.altText.includes("1.3"));
  const triangle = renderCheck("g1112_geometry_trig", { adjacent: 3, opposite: 5 });
  assert.match(triangle.labels, /adj 3/);
  assert.match(triangle.labels, /opp 5/);
  assert.match(triangle.labels, /hyp c/);
  assert.ok(!triangle.labels.includes("5.8") && !triangle.labels.includes("\u221A34"));
  const machine = renderCheck("g56_algebra_patterns", {});
  assert.match(machine.labels, /input = 4/);
  assert.match(machine.labels, /3x \+ 2/);
  assert.match(machine.labels, /output = \?/);
  assert.ok(!machine.labels.includes("14"));
});
