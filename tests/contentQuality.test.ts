import test from "node:test";
import assert from "node:assert/strict";
import { allGrade12Skills } from "../src/content/g1g2/bank";
import { createTemplate, familyIdsForSkill } from "../src/content/g1g2/templates";
import { listGuidedTopics } from "../src/learn/guidedLessons";
import type { GuidedStage, GuidedTopic, LessonValue } from "../src/learn/guidedTypes";
import type { PointTier, QuestionInstance, SkillId } from "../src/domain/types";
import { renderArithmeticCounters, renderBrokenLine, renderCountingSequence, renderMaze, renderRegionCompare, renderSideCountShape } from "../src/render/visualQuestionRenderer";

type Values = Record<string, LessonValue>;

// Adjacent seeds sample only a narrow slice of the LCG's first output.
const AUDIT_SEEDS = Array.from({ length: 256 }, (_, i) => i < 2 ? i : Math.imul(i, 0x9e3779b9) >>> 0);
AUDIT_SEEDS[253] = 653635086;
AUDIT_SEEDS[254] = 3099774617;
AUDIT_SEEDS[255] = 0xffffffff;

// Include controls from earlier stages: their values persist into later checks.
function* stageValues(topic: GuidedTopic, stage: GuidedStage): Generator<Values> {
  const domains = new Map<string, LessonValue[]>();
  for (const entry of topic.stages) {
    for (const control of entry.controls ?? []) {
      const values = control.kind === "toggle" ? control.options.map((option) => option.value)
        : Array.from({ length: Math.floor((control.max - control.min) / (control.step ?? 1)) + 1 }, (_, i) => control.min + i * (control.step ?? 1));
      domains.set(control.key, [...new Set([...(domains.get(control.key) ?? []), ...values])]);
    }
  }
  const callbacks = Object.values(stage).filter((value) => typeof value === "function").join(" ");
  const keys = [...domains.keys()].filter((key) => callbacks.includes(`"${key}"`));
  function* visit(index: number, values: Values): Generator<Values> {
    if (index === keys.length) { yield values; return; }
    const key = keys[index];
    for (const value of domains.get(key)!) yield* visit(index + 1, { ...values, [key]: value });
  }
  yield* visit(0, { ...topic.initialValues });
}

function question(skill: SkillId, family: string, tier: PointTier, seed: number, grade: 1 | 2 = 2): QuestionInstance {
  const template = createTemplate(grade, skill, family, tier, 1);
  return template.generate({ templateId: template.id, grade, bandId: "g12", pointTier: tier, variantSeed: seed });
}

const numbers = (text: string) => [...text.matchAll(/-?\d+/g)].map((match) => Number(match[0]));
const answer = (q: QuestionInstance) => q.options[q.answerIndex];
const points = (svg: string) => [...svg.matchAll(/<polyline\b[^>]*points='([^']+)'/g)][0][1].trim().split(/\s+/).map((p) => p.split(",").map(Number));

// Check translated primitive bounds, not just the presence of a viewBox.
// Paths and font glyph bounds are additionally checked with Chromium during visual QA.
function assertPrimitiveBounds(svg: string, context: string): void {
  const translations = [[0, 0]];
  for (const tag of svg.match(/<[^>]+>/g) ?? []) {
    if (tag === "</g>") { translations.pop(); continue; }
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)='([^']*)'/g)].map((m) => [m[1], m[2]]));
    const n = (key: string) => Number(attrs[key] ?? 0);
    const [tx, ty] = translations[translations.length - 1];
    if (/^<g\b/.test(tag)) {
      const move = attrs.transform?.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
      translations.push([tx + Number(move?.[1] ?? 0), ty + Number(move?.[2] ?? 0)]);
      continue;
    }
    let corners: number[][] = [];
    if (/^<rect\b/.test(tag)) corners = [[n("x"), n("y")], [n("x") + n("width"), n("y") + n("height")]];
    if (/^<circle\b/.test(tag)) corners = [[n("cx") - n("r"), n("cy") - n("r")], [n("cx") + n("r"), n("cy") + n("r")]];
    if (/^<line\b/.test(tag)) corners = [[n("x1"), n("y1")], [n("x2"), n("y2")]];
    if (/^<poly(?:line|gon)\b/.test(tag)) corners = attrs.points.trim().split(/\s+/).map((point) => point.split(",").map(Number));
    if (/^<text\b/.test(tag)) corners = [[n("x"), n("y") - n("font-size")], [n("x"), n("y") + 3]];
    const pad = n("stroke-width") / 2;
    for (const [x, y] of corners) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && x + tx - pad >= -0.01 && x + tx + pad <= 240.01 && y + ty - pad >= -0.01 && y + ty + pad <= 120.01, `${context}: ${tag}`);
    }
  }
  assert.equal(translations.length, 1, `${context}: unbalanced SVG groups`);
}

for (const grade of [1, 2] as const) {
  test(`Grade ${grade}: every family/tier has five distinct choices across 256 seeds`, () => {
    for (const skill of allGrade12Skills(grade)) for (const family of familyIdsForSkill(skill)) {
      for (const tier of [3, 4, 5] as const) for (const seed of AUDIT_SEEDS) {
        const q = question(skill, family, tier, seed, grade);
        assert.equal(new Set(q.options.map((option) => option.trim().toLowerCase())).size, 5, `${q.id}: ${q.options}`);
        assert.ok(q.answerIndex >= 0 && q.answerIndex < 5, q.id);
        assert.ok(!/undefined|NaN/.test([q.prompt, q.explanation, ...q.options, q.visualAssetSpec?.svg ?? ""].join(" ")), q.id);
      }
    }
  });

  test(`Grade ${grade}: counting and number-line quantities stay within tier limits`, () => {
    for (const skill of ["counting_ordering", "number_line", "patterns"] as const) {
      for (const family of familyIdsForSkill(skill)) for (const tier of [3, 4, 5] as const) {
        for (const seed of AUDIT_SEEDS) {
          const q = question(skill, family, tier, seed, grade);
          const max = tier === 5 ? 30 : 20;
          for (const n of numbers([q.prompt, ...q.options].join(" "))) {
            assert.ok(n >= 0 && n <= max, `${q.id} tier ${tier}: ${n} outside 0..${max}: ${q.prompt}`);
          }
          assert.doesNotMatch(q.prompt, /(?:what|which) (?:number )?comes next|next number|continue (?:the|this) (?:sequence|pattern)/i);
        }
      }
    }
  });
}

test("Guided checks have three distinct choices at every reachable parameter combination", () => {
  for (const topic of listGuidedTopics(1)) for (const stage of topic.stages) {
    if (!stage.options || !stage.correctIndex) continue;
    for (const v of stageValues(topic, stage)) {
      const opts = stage.options(v);
      const id = `${topic.id}/${stage.id} ${JSON.stringify(v)}`;
      assert.equal(new Set(opts).size, 3, `${id}: ${opts}`);
      assert.ok(stage.correctIndex(v) >= 0 && stage.correctIndex(v) < 3, id);
    }
  }
});

test("Maze geometry, not its labels, has the requested left and right turns", () => {
  for (let left = 0; left <= 4; left++) for (let right = 0; right <= 3; right++) {
    for (const seed of [0, 1, 212, 999]) {
      const route = points(renderMaze(seed, { leftTurns: left, rightTurns: right }).svg);
      const actual = { left: 0, right: 0 };
      for (let i = 1; i < route.length - 1; i++) {
        const [a, b, c] = route.slice(i - 1, i + 2);
        const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        assert.notEqual(cross, 0, "Each marked corner must actually turn");
        actual[cross > 0 ? "right" : "left"]++;
      }
      assert.deepEqual(actual, { left, right }, `L${left} R${right}: ${JSON.stringify(route)}`);
      for (const [x, y] of route) assert.ok(x >= 16 && x <= 224 && y >= 30 && y <= 104);
      for (let i = 0; i < route.length - 1; i++) for (let j = i + 2; j < route.length - 1; j++) {
        const [a, b] = route.slice(i, i + 2), [c, d] = route.slice(j, j + 2);
        const overlapsX = Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0]));
        const overlapsY = Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
        assert.ok(!(overlapsX && overlapsY), `Route must not cross itself: ${JSON.stringify(route)}`);
      }
    }
  }
});

test("Unequal region inputs must not become identical drawings through rounding", () => {
  assert.notEqual(renderRegionCompare(60, 61).svg, renderRegionCompare(60, 60).svg);
});

test("Generated pictographs have a unique greatest row and a matching answer", () => {
  for (const seed of AUDIT_SEEDS) {
    const q = question("pictographs_bar_graphs", "largest_row", 4, seed);
    const counts = numbers(q.visualAssetSpec!.altText.split(".")[0]);
    const max = Math.max(...counts);
    assert.equal(counts.filter((n) => n === max).length, 1, `${q.id}: ${counts}`);
    assert.equal(answer(q), ["A", "B", "C"][counts.indexOf(max)]);
  }
});

test("Equal-weight pairs determine exactly one leftover toy", () => {
  for (const seed of AUDIT_SEEDS) {
    const q = question("prealgebra_balance", "equal_pairs_weights", 5, seed);
    const weights = numbers(q.prompt.split(" g.")[0]);
    const target = q.prompt.match(/Each pair weighs (\d+) g/);
    const leftovers = new Set<number>();
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
      for (let c = 0; c < 5; c++) for (let d = c + 1; d < 5; d++) {
        const used = new Set([a, b, c, d]);
        if (used.size !== 4 || weights[a] + weights[b] !== weights[c] + weights[d]) continue;
        if (target && weights[a] + weights[b] !== Number(target[1])) continue;
        leftovers.add(weights.find((_, i) => !used.has(i))!);
      }
    }
    assert.deepEqual([...leftovers], [Number.parseInt(answer(q), 10)], q.prompt);
  }
});

test("Guided answers match independent calculations across controls, including ties and zero", () => {
  const expected: Record<string, (v: Values) => string> = {
    "counting_patterns/rule-check": (v) => `add ${v.step}`,
    "counting_patterns/ordinal": (v) => ["1st", "2nd", "3rd", "4th", "5th"][Number(v.ordinal) - 1],
    "compare_place_value/which": (v) => {
      const a = Number(v.aTens) * 10 + Number(v.aOnes), b = Number(v.bTens) * 10 + Number(v.bOnes);
      return a === b ? "Same" : a > b ? `A (${a})` : `B (${b})`;
    },
    "compare_place_value/digit-value": (v) => String(Number(v.aTens) * 10),
    "add_sub_balance/missing": (v) => String(v.partB),
    "add_sub_balance/balance": (v) => String(Number(v.boxValue) + Number(v.extra)),
    "number_line_positions/land": (v) => String(Number(v.lineStart) + Number(v.jump) * (v.direction === "left" ? -1 : 1)),
    "number_line_positions/row-position": (v) => ["1st", "2nd", "3rd", "4th", "5th"][Number(v.rowPlace) - 1],
    "fractions_groups/fraction-word": (v) => ({ 2: "one half", 3: "one third", 4: "one quarter" })[Number(v.parts)]!,
    "fractions_groups/equal-groups": (v) => String(Number(v.groups) * Number(v.each)),
    "sorting_sets_logic/exactly-one": (v) => String(Number(v.aOnly) + Number(v.bOnly)),
    "sorting_sets_logic/likely": (v) => v.blue === v.red ? "same chance" : Number(v.blue) > Number(v.red) ? "blue" : "red",
    "measure_money_time/measure": (v) => v.measureKind === "length" ? "centimeters" : v.measureKind === "weight" ? "grams" : "milliliters",
    "measure_money_time/temperature": (v) => v.tempCold === v.tempWarm ? "same" : Number(v.tempCold) > Number(v.tempWarm) ? `A (${v.tempCold}°)` : `B (${v.tempWarm}°)`,
    "measure_money_time/money": (v) => String(Number(v.pennies) + 5 * Number(v.nickels) + 10 * Number(v.dimes)),
    "measure_money_time/time": (v) => {
      const minutes = (Number(v.hour) * 60 + (v.halfTurn === "half" ? 30 : 0) + 30) % 720;
      return `${Math.floor(minutes / 60) || 12}:${String(minutes % 60).padStart(2, "0")}`;
    },
    "measure_money_time/calendar": (v) => String(Number(v.day) + Number(v.move)),
    "measure_money_time/calendar-cycles": (v) => v.cycleKind === "week" ? "7" : "12",
    "shapes_space/sides": (v) => String(v.sides),
    "shapes_space/maze": (v) => String(v.mazeRight),
    "shapes_space/symmetry": () => "match the mirror",
    "shapes_space/rotation": () => "rotation",
    "shapes_space/solid": () => "6",
    "data_likelihood/row-total": (v) => String(Number(v.rowB) * Number(v.iconValue)),
    "data_likelihood/chance-words": (v) => v.chanceMode === "equal" ? "equally likely" : String(v.chanceMode),
    "data_likelihood/more-likely": (v) => v.blueBag === v.redBag ? "same chance" : Number(v.blueBag) > Number(v.redBag) ? "blue" : "red",
    "perimeter_regions/perimeter-check": (v) => String(2 * (Number(v.sideA) + Number(v.sideB))),
    "perimeter_regions/regions": (v) => v.regionA === v.regionB ? "Same" : Number(v.regionA) > Number(v.regionB) ? "A" : "B"
  };
  for (const topic of listGuidedTopics(1)) for (const stage of topic.stages) {
    if (!stage.options || !stage.correctIndex) continue;
    const id = `${topic.id}/${stage.id}`;
    assert.ok(expected[id], `Missing independent oracle for ${id}`);
    for (const v of stageValues(topic, stage)) {
      assert.equal(stage.options(v)[stage.correctIndex(v)], expected[id](v), `${id}: ${JSON.stringify(v)}`);
    }
  }
});

test("Worked explanations follow changing sequence length, likelihood, fraction and region values", () => {
  for (const topic of listGuidedTopics(1)) for (const stage of topic.stages) {
    for (const v of stageValues(topic, stage)) {
      const id = `${topic.id}/${stage.id}`, derivation = stage.derivation(v);
      if (id === "counting_patterns/rule") {
        assert.deepEqual(numbers(derivation), Array.from({ length: Number(v.count) }, (_, i) => Number(v.start) + Number(v.step) * i));
      }
      if (id === "sorting_sets_logic/likely" || id === "data_likelihood/more-likely") {
        const blue = Number(v.blue ?? v.blueBag), red = Number(v.red ?? v.redBag);
        assert.ok(derivation.includes(blue === red ? "same chance" : `${blue > red ? "blue" : "red"} is more likely`), derivation);
      }
      if (id === "perimeter_regions/regions") {
        assert.ok(derivation.includes(v.regionA === v.regionB ? "areas are equal" : `Region ${Number(v.regionA) > Number(v.regionB) ? "A" : "B"} has more area`), derivation);
      }
      if (id === "fractions_groups/fraction-word") {
        assert.ok(derivation.includes(v.parts === 2 ? "one half" : v.parts === 3 ? "one third" : "one quarter"), derivation);
      }
    }
  }
});

test("Affected generated arithmetic and place-value families match their prompts at every tier", () => {
  const families: Array<[SkillId, string]> = [
    ["counting_ordering", "forward_sequence"], ["counting_ordering", "backward_sequence"],
    ["counting_ordering", "grouped_count"], ["counting_ordering", "before_after_number"],
    ["patterns", "growing_number_pattern"], ["single_digit_add_sub", "story_problem"],
    ["single_digit_add_sub", "fact_fluency"], ["single_digit_add_sub", "missing_part"],
    ["prealgebra_balance", "same_value_both_sides"], ["number_line", "jump_direction"],
    ["number_line", "missing_start"], ["number_line", "number_between"],
    ["place_value", "digit_value"], ["place_value", "tens_and_ones"],
    ["place_value", "compose_number"], ["place_value", "expanded_form"],
    ["measurement_small", "unit_compare"], ["measurement_small", "same_unit_sum"],
    ["compare_number_region", "compare_numbers"], ["compare_number_region", "place_value_compare"]
  ];
  for (const grade of [1, 2] as const) for (const tier of [3, 4, 5] as const) {
    for (const [skill, family] of families) for (const seed of AUDIT_SEEDS) {
      const q = question(skill, family, tier, seed, grade);
      const [a, b, c] = numbers(q.prompt);
      const got = answer(q);
      const context = `grade ${grade}, tier ${tier}, seed ${seed}: ${q.prompt}`;
      if (family === "forward_sequence" || family === "growing_number_pattern") {
        assert.equal(b - a, c - b, context);
        assert.equal(got, `add ${b - a}`, context);
      } else if (family === "backward_sequence") {
        assert.equal(Number(got), a - (a - b) * 2, context);
        assert.equal(c, a - (a - b) * 3, context);
      } else if (family === "grouped_count") {
        assert.equal(Number(got), a * b + c, context);
      } else if (family === "before_after_number") {
        assert.equal(Number(got), a + (q.prompt.includes("before") ? -1 : 1), context);
      } else if (family === "story_problem") {
        assert.ok(a <= 9 && b <= 9, context);
        assert.equal(Number(got), a + (q.prompt.includes("gave away") ? -b : b), context);
      } else if (family === "compare_numbers" || family === "place_value_compare") {
        const suffix = family === "place_value_compare" ? " is greater" : "";
        assert.equal(got, a === b ? "Equal" : `${a > b ? "A" : "B"}${suffix}`, context);
        assert.ok(!q.options.some((option) => /^(none|all|not here)$/i.test(option)), context);
      } else if (family === "fact_fluency") {
        assert.ok(a <= 9 && b <= 9, context);
        assert.equal(Number(got), q.prompt.includes("+") ? a + b : a - b, context);
      } else if (family === "missing_part") {
        assert.ok(a <= 9 && b - a <= 9, context);
        assert.equal(Number(got), b - a, context);
      } else if (family === "same_value_both_sides") {
        assert.ok(a - b >= 0, context);
        assert.equal(Number(got), a - b, context);
      } else if (family === "jump_direction") {
        assert.equal(Number(got), a + (q.prompt.includes("left") ? -b : b), context);
      } else if (family === "missing_start") {
        assert.equal(Number(got), b + (q.prompt.includes("left") ? a : -a), context);
      } else if (family === "number_between") {
        assert.equal(Number(got), (a + b) / 2, context);
        assert.match(q.prompt, /halfway/);
      } else if (family === "digit_value") {
        assert.match(q.prompt, /tens digit|ones digit/);
        assert.equal(Number(got), q.prompt.includes("tens digit") ? Math.floor(a / 10) * 10 : a % 10, context);
      } else if (family === "tens_and_ones") {
        assert.equal(Number(got), q.prompt.includes("groups of ten") ? Math.floor(a / 10) : a % 10, context);
        assert.ok(a <= (tier === 5 ? 999 : 99), context);
      } else if (family === "compose_number" || family === "expanded_form") {
        assert.equal(Number(got), a * 10 + b, context);
        assert.ok(Number(got) <= (tier === 5 ? 999 : 99), context);
      } else if (family === "same_unit_sum") {
        assert.equal(Number(got), a + b, context);
        assert.doesNotMatch(q.prompt, /(?:g|mL) long/);
        assert.ok(a + b <= (tier === 3 ? 20 : 30), context);
      } else if (tier === 5) {
        const threshold = q.prompt.includes("centimeters") ? 100 : 1000;
        assert.ok(b < threshold, context);
        assert.match(got, /^1 (meter|kilogram|liter)$/);
      } else {
        assert.equal(got, a === b ? "They are equal" : a > b ? "A" : "B", context);
        assert.ok(Math.max(a, b) <= (tier === 3 ? 20 : 30), context);
      }
    }
  }
});

test("Area answer agrees with the actual SVG rectangle areas for every grade and tier", () => {
  for (const grade of [1, 2] as const) for (const tier of [3, 4, 5] as const) for (const seed of AUDIT_SEEDS) {
    const q = question("compare_number_region", "region_area_compare", tier, seed, grade);
    const regions = [...q.visualAssetSpec!.svg.matchAll(/<rect data-region='[AB]'[^>]*width='([^']+)' height='([^']+)'/g)];
    assert.equal(regions.length, 2);
    const [a, b] = regions.map((m) => Number(m[1]) * Number(m[2]));
    assert.equal(answer(q), a === b ? "Equal" : a > b ? "A" : "B", q.id);
  }
});

test("Broken-line drawings use one scale and preserve every labeled segment", () => {
  for (let a = 2; a <= 6; a++) for (let b = 2; b <= 6; b++) {
    for (let c = 2; c <= 6; c++) for (let d = 2; d <= 6; d++) {
      const lengths = [a, b, c, d], route = points(renderBrokenLine(lengths).svg);
      assert.equal(route.length, 5);
      const scales = lengths.map((n, i) => Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]) / n);
      assert.ok(scales.every((s) => Math.abs(s - scales[0]) < 1e-8), `${lengths}: ${scales}`);
      for (const [x, y] of route) assert.ok(x >= 24 && x <= 175 && y >= 40 && y <= 97, `${lengths}: ${route}`);
    }
  }
});

test("Guided diagrams show every counter and color, including empty bags and ten coins", () => {
  for (const topic of listGuidedTopics(1)) for (const stage of topic.stages) {
    if (!["balance", "money", "likely", "more-likely", "chance-words", "parts", "missing"].includes(stage.id)) continue;
    for (const v of stageValues(topic, stage)) {
      const asset = stage.visual(v), svg = asset.svg;
      if (stage.id === "balance") {
        assert.equal([...svg.matchAll(/data-counter='left'/g)].length, Number(v.extra));
        assert.equal([...svg.matchAll(/data-counter='right'/g)].length, Number(v.boxValue) + Number(v.extra));
      } else if (stage.id === "money") {
        assert.equal([...svg.matchAll(/<circle /g)].length, Number(v.pennies) + Number(v.nickels) + Number(v.dimes));
        const coins = [...svg.matchAll(/font-weight='700' fill='[^']+'>(1|5|10)<\/text>/g)].map((m) => Number(m[1]));
        assert.equal(coins.reduce((sum, n) => sum + n, 0), Number(v.pennies) + 5 * Number(v.nickels) + 10 * Number(v.dimes));
      } else if (stage.id === "parts" || stage.id === "missing") {
        assert.equal([...svg.matchAll(/<circle /g)].length, 2 * (Number(v.partA) + Number(v.partB)));
      } else {
        const blue = stage.id === "chance-words" ? v.chanceMode === "certain" ? 4 : v.chanceMode === "equal" ? 2 : 0 : Number(v.blue ?? v.blueBag);
        const red = stage.id === "chance-words" ? v.chanceMode === "certain" ? 0 : v.chanceMode === "equal" ? 2 : 4 : Number(v.red ?? v.redBag);
        assert.equal([...svg.matchAll(/data-marble='blue'/g)].length, blue, asset.altText);
        assert.equal([...svg.matchAll(/data-marble='red'/g)].length, red, asset.altText);
      }
    }
  }
});

test("Every reachable guided primitive and text anchor fits its SVG", () => {
  const checked = new Set<string>();
  for (const topic of listGuidedTopics(1)) for (const stage of topic.stages) {
    for (const v of stageValues(topic, stage)) {
      const asset = stage.visual(v);
      if (checked.has(asset.svg)) continue;
      checked.add(asset.svg);
      assertPrimitiveBounds(asset.svg, `${topic.id}/${stage.id}: ${JSON.stringify(v)}`);
    }
  }
  assert.ok(checked.size > 5000, "Exercise the full control ranges, not only initial values");
});

test("Thermometer columns use the same scale and increase with temperature", () => {
  const topic = listGuidedTopics(1).find((t) => t.id === "measure_money_time")!;
  const stage = topic.stages.find((s) => s.id === "temperature")!;
  for (const v of stageValues(topic, stage)) {
    const bars = [...stage.visual(v).svg.matchAll(/<rect data-temperature='([^']+)'[^>]*y='([^']+)'[^>]*height='([^']+)'/g)];
    assert.equal(bars.length, 2);
    const [a, b] = bars.map((bar) => ({ temp: Number(bar[1]), y: Number(bar[2]), height: Number(bar[3]) }));
    assert.equal(Math.sign(b.y - a.y), Math.sign(a.temp - b.temp));
    assert.equal(a.y + a.height, b.y + b.height, "Both columns must start at the same level");
    assert.ok(a.y >= 32 && b.y >= 32 && a.y + a.height <= 97 && b.y + b.height <= 97);
  }
});

test("Symmetry questions specify the shape rather than claiming all triangles have one mirror line", () => {
  for (const seed of AUDIT_SEEDS) {
    const q = question("symmetry_rotation", "line_of_symmetry_count", 5, seed);
    if (q.prompt.includes("triangle")) {
      assert.match(q.prompt, /exactly two equal sides/);
      assert.equal(answer(q), "1");
    } else if (q.prompt.includes("rectangle")) {
      assert.match(q.prompt, /not a square/);
      assert.equal(answer(q), "2");
    } else assert.equal(answer(q), "4");
  }
});

test("Every generated clock choice uses a real 12-hour full or half hour", () => {
  for (const tier of [3, 4, 5] as const) for (const family of familyIdsForSkill("clock_full_half")) for (const seed of AUDIT_SEEDS) {
    const q = question("clock_full_half", family, tier, seed);
    for (const time of [q.prompt, ...q.options].join(" ").matchAll(/(\d+):(\d+)/g)) {
      assert.ok(Number(time[1]) >= 1 && Number(time[1]) <= 12, `${q.id}: ${time[0]}`);
      assert.ok(["00", "30"].includes(time[2]), `${q.id}: ${time[0]}`);
    }
  }
});

test("RNG upper endpoint cannot escape numerical tiers or shuffle an undefined option", () => {
  // These seeds hit the LCG's maximum state, which used to map to exactly 1.
  for (const seed of [653635086, 3099774617]) {
    const q = question("counting_ordering", "forward_sequence", 3, seed, 2);
    assert.ok(numbers(q.prompt).every((n) => n <= 20), q.prompt);
    assert.equal(q.options.length, 5);
    assert.ok(q.options.every((option) => typeof option === "string" && option.length > 0), q.id);
    assert.equal(new Set(q.options).size, 5);
    assert.equal(answer(q), "add 1");
  }
});

const visibleText = (svg: string) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);

function assertCounterOperands(svg: string, left: number, right: number, operation: "+" | "-"): void {
  const circles = [...svg.matchAll(/<circle data-counter-group='([^']+)' data-removed='(true|false)'/g)];
  const crossedOut = [...svg.matchAll(/<path data-take-away='true'/g)];
  assert.deepEqual(visibleText(svg), operation === "+" ? [`${left} + ${right} = ?`, "+"] : [`${left} - ${right} = ?`]);
  if (operation === "+") {
    assert.equal(circles.filter((circle) => circle[1] === "left").length, left);
    assert.equal(circles.filter((circle) => circle[1] === "right").length, right);
    assert.equal(circles.length, left + right);
    assert.equal(crossedOut.length, 0);
  } else {
    assert.ok(circles.every((circle) => circle[1] === "start"));
    assert.equal(circles.length, left, "Take-away marks must belong to the original set");
    assert.equal(circles.filter((circle) => circle[2] === "true").length, right);
    assert.equal(crossedOut.length, right);
    assert.equal(circles.filter((circle) => circle[2] === "false").length, left - right);
  }
  assertPrimitiveBounds(svg, `${left} ${operation} ${right}`);
}

test("First-mission question SVGs match the generated givens across grades, tiers and seeds", () => {
  const families: Array<[SkillId, string]> = [
    ["counting_ordering", "forward_sequence"],
    ["single_digit_add_sub", "fact_fluency"],
    ["shape_properties", "count_sides"]
  ];
  const shapesSeen = new Set<number>();
  for (const grade of [1, 2] as const) for (const tier of [3, 4, 5] as const) {
    for (const [skill, family] of families) for (const seed of AUDIT_SEEDS) {
      const template = createTemplate(grade, skill, family, tier, 1);
      const q = question(skill, family, tier, seed, grade);
      assert.equal(template.format, "svg");
      assert.equal(q.format, "svg");
      assert.ok(q.visualAssetSpec, q.id);
      const { svg } = q.visualAssetSpec;
      assert.equal(svg, question(skill, family, tier, seed, grade).visualAssetSpec!.svg, "Same givens must produce the same diagram");
      assertPrimitiveBounds(svg, q.id);
      if (family === "forward_sequence") {
        const givens = numbers(q.prompt);
        assert.deepEqual(visibleText(svg), givens.map(String));
        assert.equal([...svg.matchAll(/data-sequence-arrow='right'/g)].length, 2);
        assert.doesNotMatch(svg, /add |subtract |rule is|next number/i);
        assert.ok(givens.every((n) => n <= (tier === 5 ? 30 : 20)));
        assert.equal(answer(q), `add ${givens[1] - givens[0]}`);
      } else if (family === "fact_fluency") {
        const [left, right] = numbers(q.prompt);
        const operation = q.prompt.includes("+") ? "+" : "-";
        assertCounterOperands(svg, left, right, operation);
        assert.equal(Number(answer(q)), operation === "+" ? left + right : left - right);
      } else {
        const vertices = svg.match(/<polygon data-shape-outline='true' points='([^']+)'/)![1].split(" ");
        assert.equal(vertices.length, Number(answer(q)));
        assert.equal(new Set(vertices).size, vertices.length);
        assert.deepEqual(visibleText(svg), [], "Do not print the side-count answer on the shape");
        shapesSeen.add(vertices.length);
      }
    }
  }
  assert.deepEqual([...shapesSeen].sort(), [3, 4, 5, 6]);
});

test("Counter drawings represent every single-digit operand pair, including taking away all", () => {
  for (let left = 0; left <= 9; left++) for (let right = 0; right <= 9; right++) {
    assertCounterOperands(renderArithmeticCounters(left, right, "+").svg, left, right, "+");
    if (right <= left) assertCounterOperands(renderArithmeticCounters(left, right, "-").svg, left, right, "-");
  }
});

test("Question number cards and shape outlines render raw parameters without solving labels", () => {
  for (const [start, step] of [[1, 1], [18, 1], [26, 2]]) {
    const { svg, altText } = renderCountingSequence(start, step);
    assert.deepEqual(visibleText(svg), [start, start + step, start + 2 * step].map(String));
    assert.doesNotMatch(altText, /add|step|rule|next/i);
    assertPrimitiveBounds(svg, altText);
  }
  for (const [name, sides] of [["triangle", 3], ["square", 4], ["pentagon", 5], ["hexagon", 6]] as const) {
    const asset = renderSideCountShape(name, sides);
    assert.ok(asset.altText.includes(name));
    assert.doesNotMatch(asset.altText, /\d/);
    assertPrimitiveBounds(asset.svg, name);
  }
});
