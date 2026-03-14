import type { BandCoverageMap } from "./common";
import type { GuidedControl, GuidedStage, GuidedTopic, LessonValue } from "../../learn/guidedTypes";
import {
  angleVisual,
  areaGridVisual,
  arrayGroupsVisual,
  balanceVisual,
  barChartVisual,
  circleGeometryVisual,
  clockVisual,
  coordinateVisual,
  doubleNumberLineVisual,
  eliminationBoardVisual,
  formulaVisual,
  fractionBarVisual,
  functionMachineVisual,
  integerChipVisual,
  lessonCard,
  modularClockVisual,
  netVisual,
  parabolaVisual,
  placeValueVisual,
  polynomialRootsVisual,
  prismVisual,
  probabilityGridVisual,
  sequenceTableVisual,
  setDiagramVisual,
  similarityVisual,
  systemGraphVisual,
  transformGraphVisual,
  treeVisual,
  trigTriangleVisual
} from "./visuals";

function asNumber(values: Record<string, LessonValue>, key: string, fallback = 0): number {
  return Number(values[key] ?? fallback);
}

function asString(values: Record<string, LessonValue>, key: string, fallback = ""): string {
  return String(values[key] ?? fallback);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundHalfUp(value: number, base: number): number {
  return Math.floor((value + base / 2) / base) * base;
}

function numberOptions(correct: number, a: number, b: number): [string, string, string] {
  const out = [String(correct)];
  for (const candidate of [a, b, correct + 1, correct - 1, correct + 2, correct - 2]) {
    const text = String(candidate);
    if (!out.includes(text)) out.push(text);
    if (out.length === 3) break;
  }
  while (out.length < 3) out.push(String(correct + out.length));
  return out as [string, string, string];
}

function textOptions(correct: string, a: string, b: string): [string, string, string] {
  const out = [correct];
  for (const candidate of [a, b, "not enough info", "a different choice"]) {
    if (!out.includes(candidate)) out.push(candidate);
    if (out.length === 3) break;
  }
  while (out.length < 3) out.push(`choice ${out.length + 1}`);
  return out as [string, string, string];
}

function range(key: string, label: string, min: number, max: number, step = 1, formatter?: (value: LessonValue) => string): GuidedControl {
  return { kind: "range", key, label, min, max, step, formatter };
}

function toggle(key: string, label: string, options: Array<{ label: string; value: LessonValue }>): GuidedControl {
  return { kind: "toggle", key, label, options };
}

type TopicLessonConfig = {
  initialValues: Record<string, LessonValue>;
  stages: GuidedStage[];
};

type TopicBuilder = (title: string, summary: string) => TopicLessonConfig;

function buildPlaceValueStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { number: 346, roundBase: 100 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => {
          const n = asNumber(values, "number", 346);
          const hundreds = Math.floor(n / 100);
          const tens = Math.floor((n % 100) / 10);
          const ones = n % 10;
          return `Break ${n} into ${hundreds} hundreds, ${tens} tens, and ${ones} ones before you round or compare.`;
        },
        derivation: (values) => {
          const n = asNumber(values, "number", 346);
          return `${n} = ${Math.floor(n / 100) * 100} + ${Math.floor((n % 100) / 10) * 10} + ${n % 10}`;
        },
        visual: (values) => placeValueVisual(asNumber(values, "number", 346), `nearest ${asNumber(values, "roundBase", 100)}`),
        controls: [
          range("number", "number", 120, 980, 1),
          toggle("roundBase", "round to", [
            { label: "10", value: 10 },
            { label: "100", value: 100 }
          ])
        ],
        speak: (values) => `Use place value first. Then round ${asNumber(values, "number", 346)} to the nearest ${asNumber(values, "roundBase", 100)}.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          const low = Math.floor(n / base) * base;
          const high = low + base;
          return `${title} gets faster when you bracket the number between the two nearest benchmarks.`;
        },
        derivation: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          const low = Math.floor(n / base) * base;
          const high = low + base;
          return `${n} sits between ${low} and ${high}. Pick the closer benchmark.`;
        },
        visual: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          const low = Math.floor(n / base) * base;
          return sequenceTableVisual([low, n, low + base], `round by ${base}`);
        }
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Read the digits once, then round with confidence.`,
        derivation: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          return `${n} rounded to the nearest ${base}`;
        },
        visual: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          const low = Math.floor(n / base) * base;
          return sequenceTableVisual([low, n, low + base], "nearest benchmark");
        },
        prompt: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          return `What is ${n} rounded to the nearest ${base}?`;
        },
        options: (values) => {
          const n = asNumber(values, "number", 346);
          const base = asNumber(values, "roundBase", 100);
          const low = Math.floor(n / base) * base;
          const high = low + base;
          const correct = roundHalfUp(n, base);
          return numberOptions(correct, low, high);
        },
        correctIndex: (values) => {
          void values;
          return 0;
        },
        success: () => `Nice. The nearest benchmark wins.`,
        retry: () => `Bracket the number first, then compare the distance to each benchmark.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same place-value move helps with estimating sums and spotting unreasonable answers.`,
        derivation: () => `decompose → compare → decide`,
        visual: () => lessonCard("Estimate before solving", summary, "transfer")
      }
    ]
  };
}

function buildMultiplicativeStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { rows: 4, cols: 3, extra: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => {
          const rows = asNumber(values, "rows", 4);
          const cols = asNumber(values, "cols", 3);
          const extra = asNumber(values, "extra", 2);
          return `Build equal groups first: ${rows} groups of ${cols}, then deal with the ${extra} extras.`;
        },
        derivation: (values) => `${asNumber(values, "rows", 4)} × ${asNumber(values, "cols", 3)} + ${asNumber(values, "extra", 2)} = ${asNumber(values, "rows", 4) * asNumber(values, "cols", 3) + asNumber(values, "extra", 2)}`,
        visual: (values) => arrayGroupsVisual(asNumber(values, "rows", 4), asNumber(values, "cols", 3), asNumber(values, "extra", 2), "equal groups"),
        controls: [range("rows", "groups", 2, 6), range("cols", "in each group", 2, 6), range("extra", "extras", 0, 5)],
        speak: (values) => `See the rows as equal groups. Multiply first, then add any extras.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} questions often hide multiplication inside a picture.`,
        derivation: (values) => `group total = ${asNumber(values, "rows", 4)} × ${asNumber(values, "cols", 3)}`,
        visual: (values) => lessonCard(title, summary, "groups")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Count by groups, not one by one.`,
        derivation: (values) => `${asNumber(values, "rows", 4)} × ${asNumber(values, "cols", 3)} + ${asNumber(values, "extra", 2)}`,
        visual: (values) => arrayGroupsVisual(asNumber(values, "rows", 4), asNumber(values, "cols", 3), asNumber(values, "extra", 2), "count the full picture"),
        prompt: (values) => `How many objects are there altogether?`,
        options: (values) => {
          const rows = asNumber(values, "rows", 4);
          const cols = asNumber(values, "cols", 3);
          const extra = asNumber(values, "extra", 2);
          const correct = rows * cols + extra;
          return numberOptions(correct, rows + cols + extra, rows * cols);
        },
        correctIndex: () => 0,
        success: () => `Correct. Multiplication handles the equal groups quickly.`,
        retry: () => `Use rows times columns first. The extras come last.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same picture move works for area, repeated addition, and equal sharing.`,
        derivation: () => `array → multiplication → total`,
        visual: () => lessonCard("See the hidden array", summary, "transfer")
      }
    ]
  };
}

function buildFractionShareStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { parts: 4, shaded: 2, unit: 3 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Fractions talk about equal parts. ${asNumber(values, "shaded", 2)} of ${asNumber(values, "parts", 4)} equal parts are marked.`,
        derivation: (values) => `${asNumber(values, "shaded", 2)} selected out of ${asNumber(values, "parts", 4)} total = ${asNumber(values, "shaded", 2)}/${asNumber(values, "parts", 4)}`,
        visual: (values) => fractionBarVisual(asNumber(values, "parts", 4), asNumber(values, "shaded", 2), "equal parts"),
        controls: [range("parts", "parts", 2, 8), range("shaded", "selected", 1, 7), range("unit", "objects in one part", 2, 8)],
        speak: (values) => `Count selected parts over total equal parts.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} becomes manageable when you find one part first.`,
        derivation: (values) => `whole = ${asNumber(values, "parts", 4)} equal parts, each worth ${asNumber(values, "unit", 3)}`,
        visual: (values) => formulaVisual([`1 part = ${asNumber(values, "unit", 3)}`, `whole = ${asNumber(values, "parts", 4)} × ${asNumber(values, "unit", 3)}`], "one part")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Turn one part into the whole set.`,
        derivation: (values) => `${asNumber(values, "parts", 4)} × ${asNumber(values, "unit", 3)} = ${asNumber(values, "parts", 4) * asNumber(values, "unit", 3)}`,
        visual: (values) => fractionBarVisual(asNumber(values, "parts", 4), asNumber(values, "shaded", 2), "share to whole"),
        prompt: (values) => `If one part has ${asNumber(values, "unit", 3)} objects and there are ${asNumber(values, "parts", 4)} equal parts, how many objects are in the whole?`,
        options: (values) => {
          const parts = asNumber(values, "parts", 4);
          const unit = asNumber(values, "unit", 3);
          const correct = parts * unit;
          return numberOptions(correct, parts + unit, unit);
        },
        correctIndex: () => 0,
        success: () => `Yes. Equal parts mean repeated groups of the same size.`,
        retry: () => `Find the value of one equal part, then multiply by the number of parts.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same move helps with area fractions, recipe parts, and money shares.`,
        derivation: () => `one part first`,
        visual: () => lessonCard("One part first", summary, "transfer")
      }
    ]
  };
}

function buildMeasurementDataStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { hour: 3, minute: 30, cat: 4, dog: 6, bird: 5 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Measurement questions are really about labels and units. Read the clock or chart before you compare anything.`,
        derivation: (values) => `${String(asNumber(values, "hour", 3)).padStart(2, "0")}:${String(asNumber(values, "minute", 30)).padStart(2, "0")}`,
        visual: (values) => clockVisual(asNumber(values, "hour", 3), asNumber(values, "minute", 30), "read the unit"),
        controls: [
          range("hour", "hour", 1, 12),
          toggle("minute", "minutes", [
            { label: ":00", value: 0 },
            { label: ":30", value: 30 },
            { label: ":45", value: 45 }
          ])
        ],
        speak: () => `Read the label and the unit before you compare.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also shows up as bar charts and picture graphs. Compare like with like.`,
        derivation: (values) => `${asNumber(values, "dog", 6)} dogs − ${asNumber(values, "cat", 4)} cats = ${asNumber(values, "dog", 6) - asNumber(values, "cat", 4)}`,
        visual: (values) => barChartVisual([asNumber(values, "cat", 4), asNumber(values, "dog", 6), asNumber(values, "bird", 5)], ["cat", "dog", "bird"], "read the chart")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use the chart labels before subtracting.`,
        derivation: (values) => `${asNumber(values, "dog", 6)} - ${asNumber(values, "cat", 4)}`,
        visual: (values) => barChartVisual([asNumber(values, "cat", 4), asNumber(values, "dog", 6), asNumber(values, "bird", 5)], ["cat", "dog", "bird"], "difference") ,
        prompt: (values) => `How many more dogs than cats are shown?`,
        options: (values) => numberOptions(asNumber(values, "dog", 6) - asNumber(values, "cat", 4), asNumber(values, "dog", 6), asNumber(values, "cat", 4)),
        correctIndex: () => 0,
        success: () => `Right. Compare the two bars with the same unit.`,
        retry: () => `Read the bar labels and subtract the smaller count from the larger one.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same habit works for money, elapsed time, and data displays.`,
        derivation: () => `label → unit → compare`,
        visual: () => lessonCard("Read the label first", summary, "transfer")
      }
    ]
  };
}

function buildGeometrySpaceStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { width: 4, height: 3, angleA: 50, angleB: 60 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Draw the boundary or fill the grid. Geometry gets easier when the picture does the counting for you.`,
        derivation: (values) => `perimeter = 2 × (${asNumber(values, "width", 4)} + ${asNumber(values, "height", 3)})`,
        visual: (values) => areaGridVisual(asNumber(values, "width", 4), asNumber(values, "height", 3), "trace the boundary"),
        controls: [range("width", "width", 2, 7), range("height", "height", 2, 6), range("angleA", "angle A", 30, 70), range("angleB", "angle B", 30, 70)],
        speak: () => `Mark the lengths you know. Then trace or tile the shape.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} questions mix perimeter, angles, and 3D shape views. Annotate before you calculate.`,
        derivation: (values) => `third angle = 180 − ${asNumber(values, "angleA", 50)} − ${asNumber(values, "angleB", 60)}`,
        visual: (values) => angleVisual(asNumber(values, "angleA", 50), asNumber(values, "angleB", 60), 180 - asNumber(values, "angleA", 50) - asNumber(values, "angleB", 60), "angles add to 180")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Count all the outside edges exactly once.`,
        derivation: (values) => `2 × (${asNumber(values, "width", 4)} + ${asNumber(values, "height", 3)})`,
        visual: (values) => areaGridVisual(asNumber(values, "width", 4), asNumber(values, "height", 3), "perimeter") ,
        prompt: (values) => `What is the perimeter of this ${asNumber(values, "width", 4)} by ${asNumber(values, "height", 3)} rectangle?`,
        options: (values) => {
          const w = asNumber(values, "width", 4);
          const h = asNumber(values, "height", 3);
          return numberOptions(2 * (w + h), w * h, w + h);
        },
        correctIndex: () => 0,
        success: () => `Exactly. Perimeter counts the outside edge, not the inside squares.`,
        retry: () => `Trace the boundary once. Width and height each appear twice.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same sketch-first habit helps with nets, surface area, and angle sums.`,
        derivation: () => `annotate → count → solve`,
        visual: () => netVisual(6, "fold and match")
      }
    ]
  };
}

function buildPatternsEquationStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { start: 4, step: 3 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Look for the one rule that repeats. Here the pattern grows by ${asNumber(values, "step", 3)} each time.`,
        derivation: (values) => `${asNumber(values, "start", 4)}, ${asNumber(values, "start", 4) + asNumber(values, "step", 3)}, ${asNumber(values, "start", 4) + asNumber(values, "step", 3) * 2}`,
        visual: (values) => sequenceTableVisual([
          asNumber(values, "start", 4),
          asNumber(values, "start", 4) + asNumber(values, "step", 3),
          asNumber(values, "start", 4) + asNumber(values, "step", 3) * 2,
          asNumber(values, "start", 4) + asNumber(values, "step", 3) * 3
        ], "repeat the rule"),
        controls: [range("start", "first number", 1, 12), range("step", "change each time", 1, 9)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} questions reward consistency. Keep the same rule for every jump.`,
        derivation: (values) => `term n = first term + (n − 1) × step`,
        visual: () => lessonCard(title, summary, "pattern")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Predict the next term using the same jump.`,
        derivation: (values) => `${asNumber(values, "start", 4) + asNumber(values, "step", 3) * 3} + ${asNumber(values, "step", 3)}`,
        visual: (values) => sequenceTableVisual([
          asNumber(values, "start", 4),
          asNumber(values, "start", 4) + asNumber(values, "step", 3),
          asNumber(values, "start", 4) + asNumber(values, "step", 3) * 2,
          asNumber(values, "start", 4) + asNumber(values, "step", 3) * 3
        ], "what comes next?"),
        prompt: (values) => `What is the next number in the pattern?`,
        options: (values) => {
          const correct = asNumber(values, "start", 4) + asNumber(values, "step", 3) * 4;
          return numberOptions(correct, correct + asNumber(values, "step", 3), correct - asNumber(values, "step", 3));
        },
        correctIndex: () => 0,
        success: () => `Yes. One rule all the way across.`,
        retry: () => `Check the difference between each pair of neighboring terms.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same move helps when the pattern is hidden inside shapes or word problems.`,
        derivation: () => `find the repeating change`,
        visual: () => lessonCard("One rule every time", summary, "transfer")
      }
    ]
  };
}

function buildCoordinatesPathStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { startX: 2, startY: 2, dx: 3, dy: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Keep x and y separate. Move ${asNumber(values, "dx", 3)} horizontally and ${asNumber(values, "dy", 2)} vertically.`,
        derivation: (values) => `(${asNumber(values, "startX", 2)}, ${asNumber(values, "startY", 2)}) → (${asNumber(values, "startX", 2) + asNumber(values, "dx", 3)}, ${asNumber(values, "startY", 2) + asNumber(values, "dy", 2)})`,
        visual: (values) => coordinateVisual([
          { x: asNumber(values, "startX", 2), y: asNumber(values, "startY", 2), label: "S" },
          { x: asNumber(values, "startX", 2) + asNumber(values, "dx", 3), y: asNumber(values, "startY", 2) + asNumber(values, "dy", 2), label: "F" }
        ], 1, [0]),
        controls: [range("startX", "start x", 1, 5), range("startY", "start y", 1, 5), range("dx", "move right", 1, 4), range("dy", "move up", 1, 4)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} gets easier when you imagine two small moves instead of one mysterious jump.`,
        derivation: () => `horizontal first, vertical second`,
        visual: () => lessonCard(title, summary, "grid move")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Track x and y in separate columns in your head.`,
        derivation: (values) => `${asNumber(values, "startX", 2)} + ${asNumber(values, "dx", 3)}, ${asNumber(values, "startY", 2)} + ${asNumber(values, "dy", 2)}`,
        visual: (values) => coordinateVisual([
          { x: asNumber(values, "startX", 2), y: asNumber(values, "startY", 2), label: "S" },
          { x: asNumber(values, "startX", 2) + asNumber(values, "dx", 3), y: asNumber(values, "startY", 2) + asNumber(values, "dy", 2), label: "F" }
        ], 1, [0]),
        prompt: (values) => `Where do you land after the move?`,
        options: (values) => textOptions(
          `(${asNumber(values, "startX", 2) + asNumber(values, "dx", 3)}, ${asNumber(values, "startY", 2) + asNumber(values, "dy", 2)})`,
          `(${asNumber(values, "startX", 2) + asNumber(values, "dy", 2)}, ${asNumber(values, "startY", 2) + asNumber(values, "dx", 3)})`,
          `(${asNumber(values, "startX", 2)}, ${asNumber(values, "startY", 2)})`
        ),
        correctIndex: () => 0,
        success: () => `Correct. Horizontal and vertical changes do different jobs.`,
        retry: () => `Update x and y separately; do not swap them.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same move works for paths, reflections, and graph questions later on.`,
        derivation: () => `change x, then change y`,
        visual: () => lessonCard("Separate x and y", summary, "transfer")
      }
    ]
  };
}

function buildExamStageBundle(title: string, summary: string, accent: string, moveOptions: Array<{ label: string; value: LessonValue }>): TopicLessonConfig {
  return {
    initialValues: { move: moveOptions[0]?.value || "eliminate" },
    stages: [
      {
        id: "idea",
        title: "Exam Move",
        body: (values) => `Contest questions reward a first move. Start with ${asString(values, "move", String(moveOptions[0]?.value || "eliminate"))} before doing heavy arithmetic.`,
        derivation: (values) => `${asString(values, "move", String(moveOptions[0]?.value || "eliminate"))} → test the survivors → compute only if needed`,
        visual: (values) => {
          const move = asString(values, "move", String(moveOptions[0]?.value || "eliminate"));
          if (move === "pattern") return sequenceTableVisual([2, 5, 8, 11], "pattern first");
          if (move === "parity" || move === "invariant") return probabilityGridVisual(3, 4, [[0, 0], [0, 2], [1, 1], [1, 3], [2, 0], [2, 2]], "same / flip");
          return eliminationBoardVisual(["A", "B", "C", "D"], [0, 2, 3], accent);
        },
        controls: [toggle("move", "first move", moveOptions)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `Good contest solvers cross out, test parity, or spot a pattern before they calculate.`,
        derivation: () => `short route first`,
        visual: () => formulaVisual(["Cross out impossible choices.", "Look for what stays the same.", "Only then compute."], accent)
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use the clue to eliminate quickly.`,
        derivation: () => `not red, not green, not yellow`,
        visual: () => eliminationBoardVisual(["blue", "red", "green", "yellow"], [1, 2, 3], "eliminate"),
        prompt: () => `A choice is not red, not green, and not yellow. What must it be?`,
        options: () => textOptions("blue", "red", "green"),
        correctIndex: () => 0,
        success: () => `Exactly. Elimination can finish the problem before the arithmetic starts.`,
        retry: () => `Cross out what cannot happen. The last survivor is your answer.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `Now use the same shortcut on set questions, parity flips, or optimization tasks.`,
        derivation: () => `same habit, different wrapper`,
        visual: () => lessonCard(title, summary, accent)
      }
    ]
  };
}

function buildG34ExamStages(title: string, summary: string): TopicLessonConfig {
  return buildExamStageBundle(title, summary, "elim + pattern", [
    { label: "Eliminate", value: "eliminate" },
    { label: "Pattern", value: "pattern" },
    { label: "Parity", value: "parity" }
  ]);
}

function buildG56ExamStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { move: "sets", leftOnly: 4, both: 2, rightOnly: 3 },
    stages: [
      {
        id: "idea",
        title: "Exam Move",
        body: () => `For set-and-logic problems, sketch the overlap first so you can count each region once.`,
        derivation: (values) => `A only ${asNumber(values, "leftOnly", 4)}, both ${asNumber(values, "both", 2)}, B only ${asNumber(values, "rightOnly", 3)}`,
        visual: (values) => setDiagramVisual(asNumber(values, "leftOnly", 4), asNumber(values, "both", 2), asNumber(values, "rightOnly", 3), "set regions"),
        controls: [range("leftOnly", "A only", 1, 7), range("both", "both sets", 1, 5), range("rightOnly", "B only", 1, 7)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `If a logic problem mentions both, either, or neither, put the counts into regions before touching the options.`,
        derivation: () => `region count first, elimination second`,
        visual: (values) => eliminationBoardVisual(["A only", "both", "B only", "neither"], [3], "count regions")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Count A by adding the A-only region and the overlap once.`,
        derivation: (values) => `${asNumber(values, "leftOnly", 4)} + ${asNumber(values, "both", 2)}`,
        visual: (values) => setDiagramVisual(asNumber(values, "leftOnly", 4), asNumber(values, "both", 2), asNumber(values, "rightOnly", 3), "who is in A?"),
        prompt: (values) => `How many items are in set A altogether?`,
        options: (values) => numberOptions(asNumber(values, "leftOnly", 4) + asNumber(values, "both", 2), asNumber(values, "rightOnly", 3) + asNumber(values, "both", 2), asNumber(values, "leftOnly", 4) + asNumber(values, "rightOnly", 3)),
        correctIndex: () => 0,
        success: () => `Yes. Count the overlap only once.`,
        retry: () => `Set A includes the A-only region and the overlap, but not the B-only region.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same region move helps with casework, divisibility filters, and probability sample spaces.`,
        derivation: () => `label regions before solving`,
        visual: () => lessonCard(title, summary, "set logic")
      }
    ]
  };
}

function buildG78ExamStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { modulus: 2, value: 9 },
    stages: [
      {
        id: "idea",
        title: "Exam Move",
        body: () => `Parity and invariants often solve a contest problem before the arithmetic does.`,
        derivation: (values) => `${asNumber(values, "value", 9)} mod ${asNumber(values, "modulus", 2)} = ${asNumber(values, "value", 9) % asNumber(values, "modulus", 2)}`,
        visual: (values) => modularClockVisual(Math.max(2, asNumber(values, "modulus", 2)), asNumber(values, "value", 9), "same or flips"),
        controls: [toggle("modulus", "check with", [{ label: "mod 2", value: 2 }, { label: "mod 3", value: 3 }]), range("value", "test number", 4, 18)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `Ask what changes every move and what never changes. That is where invariants come from.`,
        derivation: () => `same / flip / repeat`,
        visual: () => probabilityGridVisual(3, 4, [[0, 0], [0, 2], [1, 1], [1, 3], [2, 0], [2, 2]], "checker pattern")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `An odd number leaves remainder 1 when divided by 2.`,
        derivation: (values) => `${asNumber(values, "value", 9)} mod 2`,
        visual: (values) => modularClockVisual(2, asNumber(values, "value", 9), "parity"),
        prompt: (values) => `Is ${asNumber(values, "value", 9)} even or odd?`,
        options: (values) => textOptions(asNumber(values, "value", 9) % 2 === 0 ? "even" : "odd", asNumber(values, "value", 9) % 2 === 0 ? "odd" : "even", "cannot tell"),
        correctIndex: () => 0,
        success: () => `Correct. Parity is just the remainder mod 2.`,
        retry: () => `If a number leaves remainder 1 when divided by 2, it is odd.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same shortcut shows up in tilings, move games, and logical reasoning questions.`,
        derivation: () => `look for what repeats or stays fixed`,
        visual: () => lessonCard(title, summary, "invariant")
      }
    ]
  };
}

function buildG910ExamStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { h: 4, k: 1 },
    stages: [
      {
        id: "idea",
        title: "Exam Move",
        body: () => `Optimization questions often become a graph with one best point. Look for the turning point or boundary first.`,
        derivation: (values) => `best point near x = ${asNumber(values, "h", 4)}`,
        visual: (values) => parabolaVisual(1, asNumber(values, "h", 4), asNumber(values, "k", 1), "maximum / minimum"),
        controls: [range("h", "best x", 2, 7), range("k", "best y", 0, 4)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `If the picture has a best point, compare nearby cases instead of checking everything.`,
        derivation: () => `test the boundary and the turning point`,
        visual: () => systemGraphVisual(1, 1, -1, 9, "compare constraints")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `On a parabola, the vertex is the extreme point.`,
        derivation: (values) => `vertex x = ${asNumber(values, "h", 4)}`,
        visual: (values) => parabolaVisual(1, asNumber(values, "h", 4), asNumber(values, "k", 1), "vertex check"),
        prompt: (values) => `Where does the graph reach its turning point?`,
        options: (values) => numberOptions(asNumber(values, "h", 4), asNumber(values, "h", 4) + 1, asNumber(values, "h", 4) - 1),
        correctIndex: () => 0,
        success: () => `Yes. The turning point gives the best candidate.`,
        retry: () => `Look for where the graph switches direction.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same move helps with inequality regions, area optimization, and logical best-case problems.`,
        derivation: () => `best point first, details second`,
        visual: () => lessonCard(title, summary, "optimize")
      }
    ]
  };
}

function buildG1112ExamStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { modulus: 5, value: 17, h: 3, k: 1 },
    stages: [
      {
        id: "idea",
        title: "Exam Move",
        body: () => `Proof-style contest questions reward a short invariant or extremal idea before formal algebra.`,
        derivation: (values) => `${asNumber(values, "value", 17)} mod ${asNumber(values, "modulus", 5)} = ${asNumber(values, "value", 17) % asNumber(values, "modulus", 5)}`,
        visual: (values) => modularClockVisual(asNumber(values, "modulus", 5), asNumber(values, "value", 17), "invariant test"),
        controls: [range("modulus", "modulus", 3, 8), range("value", "test value", 10, 30)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `For modeling or proof-by-structure questions, ask which quantity cannot keep improving forever.`,
        derivation: () => `extremal reasoning picks the critical case`,
        visual: (values) => parabolaVisual(1, asNumber(values, "h", 3), asNumber(values, "k", 1), "extremal case")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `A modular check can confirm or reject a claim quickly.`,
        derivation: (values) => `${asNumber(values, "value", 17)} mod ${asNumber(values, "modulus", 5)}`,
        visual: (values) => modularClockVisual(asNumber(values, "modulus", 5), asNumber(values, "value", 17), "proof shortcut"),
        prompt: (values) => `What remainder does ${asNumber(values, "value", 17)} leave when divided by ${asNumber(values, "modulus", 5)}?`,
        options: (values) => numberOptions(asNumber(values, "value", 17) % asNumber(values, "modulus", 5), asNumber(values, "modulus", 5) - 1, Math.floor(asNumber(values, "value", 17) / asNumber(values, "modulus", 5))),
        correctIndex: () => 0,
        success: () => `Right. A quick modular check often decides whether a claim can be true.`,
        retry: () => `Walk around the modular cycle and stop at the leftover position.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same idea supports contradiction, invariants, optimization, and modeling questions.`,
        derivation: () => `find the invariant or extreme`, 
        visual: () => lessonCard(title, summary, "proof move")
      }
    ]
  };
}

function buildNumberTheoryStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { number: 24, divisor: 6 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Factors make exact groups. Remainders tell you what is left over after the grouping.`,
        derivation: (values) => `${asNumber(values, "number", 24)} = ${asNumber(values, "divisor", 6)} × ${Math.floor(asNumber(values, "number", 24) / asNumber(values, "divisor", 6))} + ${asNumber(values, "number", 24) % asNumber(values, "divisor", 6)}`,
        visual: (values) => arrayGroupsVisual(asNumber(values, "divisor", 6), Math.floor(asNumber(values, "number", 24) / asNumber(values, "divisor", 6)), asNumber(values, "number", 24) % asNumber(values, "divisor", 6), "groups and leftovers"),
        controls: [range("number", "number", 12, 60), range("divisor", "divide by", 2, 10)],
        speak: () => `See the quotient as full groups, then check the leftover.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often starts with one quick divisibility test instead of long calculation.`,
        derivation: (values) => `remainder when dividing by ${asNumber(values, "divisor", 6)}`,
        visual: (values) => modularClockVisual(Math.max(2, asNumber(values, "divisor", 6)), asNumber(values, "number", 24), "remainder wheel")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Ask what is left after the full groups are made.`,
        derivation: (values) => `${asNumber(values, "number", 24)} mod ${asNumber(values, "divisor", 6)}`,
        visual: (values) => modularClockVisual(Math.max(2, asNumber(values, "divisor", 6)), asNumber(values, "number", 24), "mod move"),
        prompt: (values) => `What is the remainder when ${asNumber(values, "number", 24)} is divided by ${asNumber(values, "divisor", 6)}?`,
        options: (values) => {
          const number = asNumber(values, "number", 24);
          const divisor = Math.max(2, asNumber(values, "divisor", 6));
          return numberOptions(number % divisor, divisor, Math.floor(number / divisor));
        },
        correctIndex: () => 0,
        success: () => `Yes. That is the leftover after the full groups.`,
        retry: () => `Think in full groups of the divisor, then see what remains.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same idea powers modular reasoning and prime/factor questions later on.`,
        derivation: () => `groups, factors, and remainders are one family`,
        visual: () => lessonCard(title, summary, "factors")
      }
    ]
  };
}

function buildFractionsRatiosStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { left: 2, right: 3, scale: 20 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Ratios stay equivalent when both parts are scaled by the same factor.`,
        derivation: (values) => `${asNumber(values, "left", 2)}:${asNumber(values, "right", 3)} = ${asNumber(values, "left", 2) * asNumber(values, "scale", 20)}:${asNumber(values, "right", 3) * asNumber(values, "scale", 20)}`,
        visual: (values) => doubleNumberLineVisual("ratio", "scaled", [1, asNumber(values, "left", 2), asNumber(values, "right", 3)], [asNumber(values, "scale", 20), asNumber(values, "left", 2) * asNumber(values, "scale", 20), asNumber(values, "right", 3) * asNumber(values, "scale", 20)], "scale both parts"),
        controls: [range("left", "left part", 1, 6), range("right", "right part", 2, 8), range("scale", "scale by", 5, 30)],
        speak: () => `Whatever you do to one part of a ratio, do to the other part too.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often hides a ratio inside a fraction, percent, or word comparison.`,
        derivation: (values) => `percent = part / whole × 100`,
        visual: (values) => fractionBarVisual(10, clamp(Math.round((asNumber(values, "left", 2) / (asNumber(values, "left", 2) + asNumber(values, "right", 3))) * 10), 1, 9), "ratio as percent")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Scale both sides, not just one side.`,
        derivation: (values) => `${asNumber(values, "left", 2)} × ${asNumber(values, "scale", 20)}`,
        visual: (values) => doubleNumberLineVisual("original", "scaled", [asNumber(values, "left", 2), asNumber(values, "right", 3)], [asNumber(values, "left", 2) * asNumber(values, "scale", 20), asNumber(values, "right", 3) * asNumber(values, "scale", 20)], "equivalent ratio"),
        prompt: (values) => `If the ratio is ${asNumber(values, "left", 2)}:${asNumber(values, "right", 3)}, what is the matching first part when the second part becomes ${asNumber(values, "right", 3) * asNumber(values, "scale", 20)}?`,
        options: (values) => {
          const correct = asNumber(values, "left", 2) * asNumber(values, "scale", 20);
          return numberOptions(correct, asNumber(values, "left", 2) + asNumber(values, "scale", 20), asNumber(values, "right", 3) * asNumber(values, "scale", 20));
        },
        correctIndex: () => 0,
        success: () => `Correct. Equivalent ratios scale both parts together.`,
        retry: () => `If one part was multiplied, the matching part must be multiplied by the same factor.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same scale move helps with maps, recipes, probabilities, and percent problems.`,
        derivation: () => `keep the relationship, not the raw numbers`,
        visual: () => lessonCard(title, summary, "ratio move")
      }
    ]
  };
}

function buildAlgebraPatternStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { input: 4, multiplier: 3, shift: 2, start: 5, step: 4 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Algebra gives a rule. Patterns tell you how the rule changes from one step to the next.`,
        derivation: (values) => `y = ${asNumber(values, "multiplier", 3)}x + ${asNumber(values, "shift", 2)}`,
        visual: (values) => functionMachineVisual(asNumber(values, "input", 4), asNumber(values, "multiplier", 3) * asNumber(values, "input", 4) + asNumber(values, "shift", 2), `${asNumber(values, "multiplier", 3)}x + ${asNumber(values, "shift", 2)}`, "rule machine"),
        controls: [range("input", "input", 1, 8), range("multiplier", "multiplier", 1, 6), range("shift", "shift", 0, 9)],
        speak: () => `Substitute the input. Then simplify the rule in order.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} gets easier when you decide what stays fixed and what can change.`,
        derivation: (values) => `${asNumber(values, "start", 5)}, ${asNumber(values, "start", 5) + asNumber(values, "step", 4)}, ${asNumber(values, "start", 5) + asNumber(values, "step", 4) * 2}`,
        visual: (values) => sequenceTableVisual([
          asNumber(values, "start", 5),
          asNumber(values, "start", 5) + asNumber(values, "step", 4),
          asNumber(values, "start", 5) + asNumber(values, "step", 4) * 2,
          asNumber(values, "start", 5) + asNumber(values, "step", 4) * 3
        ], "pattern table")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Feed the input through the rule machine.`,
        derivation: (values) => `${asNumber(values, "multiplier", 3)} × ${asNumber(values, "input", 4)} + ${asNumber(values, "shift", 2)}`,
        visual: (values) => functionMachineVisual(asNumber(values, "input", 4), asNumber(values, "multiplier", 3) * asNumber(values, "input", 4) + asNumber(values, "shift", 2), `${asNumber(values, "multiplier", 3)}x + ${asNumber(values, "shift", 2)}`, "evaluate"),
        prompt: (values) => `If y = ${asNumber(values, "multiplier", 3)}x + ${asNumber(values, "shift", 2)}, what is y when x = ${asNumber(values, "input", 4)}?`,
        options: (values) => {
          const correct = asNumber(values, "multiplier", 3) * asNumber(values, "input", 4) + asNumber(values, "shift", 2);
          return numberOptions(correct, correct + 2, correct - 2);
        },
        correctIndex: () => 0,
        success: () => `Exactly. Substitute first, then simplify.`,
        retry: () => `Put the input into the rule before you calculate.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same move works when the rule is hidden inside a table or a growing shape.`,
        derivation: () => `rule first, arithmetic second`,
        visual: () => lessonCard(title, summary, "rule")
      }
    ]
  };
}

function buildGeometryMeasurementStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { length: 5, width: 3, height: 2, angleA: 40, angleB: 60 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Geometry questions often ask whether to count square units, cubic units, or turn measures. Decide the unit first.`,
        derivation: (values) => `volume = ${asNumber(values, "length", 5)} × ${asNumber(values, "width", 3)} × ${asNumber(values, "height", 2)}`,
        visual: (values) => prismVisual(asNumber(values, "length", 5), asNumber(values, "width", 3), asNumber(values, "height", 2), "3D measurement"),
        controls: [range("length", "length", 2, 8), range("width", "width", 2, 5), range("height", "height", 2, 5)],
        speak: () => `Ask: am I counting length, area, or volume?`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also mixes angle facts into measurement.`,
        derivation: (values) => `third angle = 180 − ${asNumber(values, "angleA", 40)} − ${asNumber(values, "angleB", 60)}`,
        visual: (values) => angleVisual(asNumber(values, "angleA", 40), asNumber(values, "angleB", 60), 180 - asNumber(values, "angleA", 40) - asNumber(values, "angleB", 60), "angle fact")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Multiply the three dimensions once you know the unit is cubic.`,
        derivation: (values) => `${asNumber(values, "length", 5)} × ${asNumber(values, "width", 3)} × ${asNumber(values, "height", 2)}`,
        visual: (values) => prismVisual(asNumber(values, "length", 5), asNumber(values, "width", 3), asNumber(values, "height", 2), "volume"),
        prompt: (values) => `What is the volume of the prism?`,
        options: (values) => {
          const l = asNumber(values, "length", 5);
          const w = asNumber(values, "width", 3);
          const h = asNumber(values, "height", 2);
          return numberOptions(l * w * h, l * w, 2 * (l + w + h));
        },
        correctIndex: () => 0,
        success: () => `Right. Volume counts cubic units.`,
        retry: () => `Volume needs three dimensions multiplied together.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same unit-first habit helps with surface area, angle sums, and scale drawings.`,
        derivation: () => `unit choice before computation`,
        visual: () => lessonCard(title, summary, "unit first")
      }
    ]
  };
}

function buildGraphsProbabilityStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { favorable: 5, rows: 3, cols: 4, dx: 3, dy: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Graph and probability questions both start with one honest count.`,
        derivation: (values) => `${asNumber(values, "favorable", 5)}/${asNumber(values, "rows", 3) * asNumber(values, "cols", 4)}`,
        visual: (values) => probabilityGridVisual(asNumber(values, "rows", 3), asNumber(values, "cols", 4), Array.from({ length: clamp(asNumber(values, "favorable", 5), 1, asNumber(values, "rows", 3) * asNumber(values, "cols", 4)) }).map((_, index) => [Math.floor(index / asNumber(values, "cols", 4)), index % asNumber(values, "cols", 4)] as [number, number]), "count outcomes"),
        controls: [range("rows", "rows", 2, 4), range("cols", "cols", 2, 5), range("favorable", "favorable", 1, 10)],
        speak: () => `Count the favorable outcomes and the total outcomes separately.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also asks you to read positions on a graph carefully.`,
        derivation: (values) => `(1, 1) → (${1 + asNumber(values, "dx", 3)}, ${1 + asNumber(values, "dy", 2)})`,
        visual: (values) => coordinateVisual([{ x: 1, y: 1, label: "S" }, { x: 1 + asNumber(values, "dx", 3), y: 1 + asNumber(values, "dy", 2), label: "F" }], 1, [0])
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Probability is favorable over total.`,
        derivation: (values) => `${asNumber(values, "favorable", 5)}/${asNumber(values, "rows", 3) * asNumber(values, "cols", 4)}`,
        visual: (values) => probabilityGridVisual(asNumber(values, "rows", 3), asNumber(values, "cols", 4), Array.from({ length: clamp(asNumber(values, "favorable", 5), 1, asNumber(values, "rows", 3) * asNumber(values, "cols", 4)) }).map((_, index) => [Math.floor(index / asNumber(values, "cols", 4)), index % asNumber(values, "cols", 4)] as [number, number]), "probability ratio"),
        prompt: (values) => `What is the probability of a favorable outcome?`,
        options: (values) => {
          const favorable = asNumber(values, "favorable", 5);
          const total = asNumber(values, "rows", 3) * asNumber(values, "cols", 4);
          return textOptions(`${favorable}/${total}`, `${total}/${favorable}`, `1/${favorable}`);
        },
        correctIndex: () => 0,
        success: () => `Exactly. Favorable goes on top; total goes below.`,
        retry: () => `Count the total number of outcomes, not just the favorable ones.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same count-first habit helps with graph reading, tables, and outcome trees.`,
        derivation: () => `count → compare → simplify`,
        visual: () => lessonCard(title, summary, "count first")
      }
    ]
  };
}

function buildAlgebraCoreStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { positive: 4, negative: 2, x: 5, shift: 3 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Integers and linear equations get easier when you track direction and undo steps in reverse order.`,
        derivation: (values) => `${asNumber(values, "positive", 4)} + (−${asNumber(values, "negative", 2)}) = ${asNumber(values, "positive", 4) - asNumber(values, "negative", 2)}`,
        visual: (values) => integerChipVisual(asNumber(values, "positive", 4), asNumber(values, "negative", 2), "positive and negative"),
        controls: [range("positive", "positive chips", 1, 7), range("negative", "negative chips", 1, 7), range("x", "x", 2, 9), range("shift", "subtract", 1, 5)],
        speak: () => `Positive chips and negative chips can cancel. In equations, undo the last step first.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} questions often hide a balance move.`,
        derivation: (values) => `${asNumber(values, "x", 5)} − ${asNumber(values, "shift", 3)} = ${asNumber(values, "x", 5) - asNumber(values, "shift", 3)}`,
        visual: (values) => balanceVisual(`x − ${asNumber(values, "shift", 3)}`, String(asNumber(values, "x", 5) - asNumber(values, "shift", 3)), "undo the shift")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use cancellation or undoing, not guessing.`,
        derivation: (values) => `${asNumber(values, "positive", 4)} - ${asNumber(values, "negative", 2)}`,
        visual: (values) => integerChipVisual(asNumber(values, "positive", 4), asNumber(values, "negative", 2), "cancel pairs"),
        prompt: (values) => `What is ${asNumber(values, "positive", 4)} + (−${asNumber(values, "negative", 2)})?`,
        options: (values) => numberOptions(asNumber(values, "positive", 4) - asNumber(values, "negative", 2), asNumber(values, "positive", 4) + asNumber(values, "negative", 2), asNumber(values, "negative", 2) - asNumber(values, "positive", 4)),
        correctIndex: () => 0,
        success: () => `Correct. Positive and negative pairs cancel one-for-one.`,
        retry: () => `Pair one positive with one negative until one kind is left.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same undo move powers solving equations, inequalities, and coordinate changes.`,
        derivation: () => `cancel or undo in reverse order`,
        visual: () => lessonCard(title, summary, "undo move")
      }
    ]
  };
}

function buildRatiosPercentsStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { part: 3, whole: 5 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Percent is just another way to say part per hundred.`,
        derivation: (values) => `${asNumber(values, "part", 3)}/${asNumber(values, "whole", 5)} = ${(asNumber(values, "part", 3) / asNumber(values, "whole", 5) * 100).toFixed(0)}%`,
        visual: (values) => doubleNumberLineVisual("fraction", "percent", [0, asNumber(values, "part", 3), asNumber(values, "whole", 5)], [0, Math.round(asNumber(values, "part", 3) / asNumber(values, "whole", 5) * 100), 100], "fraction to percent"),
        controls: [range("part", "part", 1, 9), range("whole", "whole", 2, 10)],
        speak: () => `Think of percent as out of one hundred.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} gets easier when you benchmark with 50%, 25%, 10%, and 1%.`,
        derivation: () => `scale to 100 or use benchmark fractions`,
        visual: (values) => fractionBarVisual(10, clamp(Math.round(asNumber(values, "part", 3) / asNumber(values, "whole", 5) * 10), 1, 10), "percent strip")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Convert the ratio into a percent.`,
        derivation: (values) => `${asNumber(values, "part", 3)} ÷ ${asNumber(values, "whole", 5)} × 100`,
        visual: (values) => doubleNumberLineVisual("ratio", "percent", [0, asNumber(values, "part", 3), asNumber(values, "whole", 5)], [0, Math.round(asNumber(values, "part", 3) / asNumber(values, "whole", 5) * 100), 100], "percent check"),
        prompt: (values) => `What percent is ${asNumber(values, "part", 3)}/${asNumber(values, "whole", 5)}?`,
        options: (values) => {
          const correct = Math.round(asNumber(values, "part", 3) / asNumber(values, "whole", 5) * 100);
          return textOptions(`${correct}%`, `${asNumber(values, "part", 3) * 10}%`, `${asNumber(values, "whole", 5) * 10}%`);
        },
        correctIndex: () => 0,
        success: () => `Yes. Scale the whole to 100 or use a benchmark percent.`,
        retry: () => `Ask: if the whole were 100, how many would the part be?`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same move powers discounts, tax, mixtures, and probability.`,
        derivation: () => `ratio ↔ percent`,
        visual: () => lessonCard(title, summary, "percent move")
      }
    ]
  };
}

function buildGeometryReasoningStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { scale: 2, side: 3 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `When side lengths scale, areas and volumes scale by powers of that factor.`,
        derivation: (values) => `side scale ${asNumber(values, "scale", 2)} → area scale ${asNumber(values, "scale", 2) ** 2}`,
        visual: (values) => similarityVisual(asNumber(values, "scale", 2), "similar figures"),
        controls: [range("scale", "scale factor", 2, 4), range("side", "small side", 2, 6)],
        speak: () => `Side lengths scale directly. Area scales with the square of the factor.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often hides a scale factor inside two drawings.`,
        derivation: (values) => `${asNumber(values, "side", 3)} → ${asNumber(values, "side", 3) * asNumber(values, "scale", 2)}`,
        visual: (values) => areaGridVisual(asNumber(values, "side", 3), asNumber(values, "side", 3), "small area")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `If the side scale doubles, area does not just double.`,
        derivation: (values) => `${asNumber(values, "scale", 2)}² = ${asNumber(values, "scale", 2) ** 2}`,
        visual: (values) => similarityVisual(asNumber(values, "scale", 2), "area scale"),
        prompt: (values) => `If the side lengths are multiplied by ${asNumber(values, "scale", 2)}, what happens to area?`,
        options: (values) => textOptions(`${asNumber(values, "scale", 2) ** 2} times as large`, `${asNumber(values, "scale", 2)} times as large`, `stays the same`),
        correctIndex: () => 0,
        success: () => `Exactly. Area scales with the square of the side factor.`,
        retry: () => `Imagine tiling the larger figure. Both width and height scale.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This is the same reason volume scales by the cube of the side factor.`,
        derivation: () => `length → square → cube`,
        visual: () => lessonCard(title, summary, "scale law")
      }
    ]
  };
}

function buildGraphsFunctionsStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { slope: 2, intercept: 1, start: 3, step: 4 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Functions connect inputs and outputs. Graphs show the same rule as a picture.`,
        derivation: (values) => `y = ${asNumber(values, "slope", 2)}x + ${asNumber(values, "intercept", 1)}`,
        visual: (values) => coordinateVisual([
          { x: 1, y: asNumber(values, "slope", 2) + asNumber(values, "intercept", 1), label: "1" },
          { x: 2, y: asNumber(values, "slope", 2) * 2 + asNumber(values, "intercept", 1), label: "2" },
          { x: 3, y: asNumber(values, "slope", 2) * 3 + asNumber(values, "intercept", 1), label: "3" }
        ], 2, [0, 1]),
        controls: [range("slope", "slope", 1, 4), range("intercept", "y-intercept", 0, 4)],
        speak: () => `A function table and a graph are two views of the same rule.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often gives a pattern table first, then asks for the rule or a graph point.`,
        derivation: (values) => `${asNumber(values, "start", 3)}, ${asNumber(values, "start", 3) + asNumber(values, "step", 4)}, ${asNumber(values, "start", 3) + asNumber(values, "step", 4) * 2}`,
        visual: (values) => sequenceTableVisual([
          asNumber(values, "start", 3),
          asNumber(values, "start", 3) + asNumber(values, "step", 4),
          asNumber(values, "start", 3) + asNumber(values, "step", 4) * 2,
          asNumber(values, "start", 3) + asNumber(values, "step", 4) * 3
        ], "table to rule")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use the rule to get one graph point.`,
        derivation: (values) => `${asNumber(values, "slope", 2)} × 4 + ${asNumber(values, "intercept", 1)}`,
        visual: (values) => coordinateVisual([
          { x: 1, y: asNumber(values, "slope", 2) + asNumber(values, "intercept", 1) },
          { x: 2, y: asNumber(values, "slope", 2) * 2 + asNumber(values, "intercept", 1) },
          { x: 4, y: asNumber(values, "slope", 2) * 4 + asNumber(values, "intercept", 1), label: "?" }
        ], 2, [0, 1]),
        prompt: (values) => `If y = ${asNumber(values, "slope", 2)}x + ${asNumber(values, "intercept", 1)}, what is y when x = 4?`,
        options: (values) => {
          const correct = asNumber(values, "slope", 2) * 4 + asNumber(values, "intercept", 1);
          return numberOptions(correct, correct + asNumber(values, "slope", 2), correct - asNumber(values, "slope", 2));
        },
        correctIndex: () => 0,
        success: () => `Correct. The graph point must obey the same rule.`,
        retry: () => `Use the rule to compute the output for x = 4.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `The same rule-reading move helps with sequences, tables, and slope questions.`,
        derivation: () => `same rule, different wrapper`,
        visual: () => lessonCard(title, summary, "function view")
      }
    ]
  };
}

function buildCountingProbabilityStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { choicesA: 3, choicesB: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Counting questions are usually a tree in disguise. Count stage by stage.`,
        derivation: (values) => `${asNumber(values, "choicesA", 3)} × ${asNumber(values, "choicesB", 2)} = ${asNumber(values, "choicesA", 3) * asNumber(values, "choicesB", 2)}`,
        visual: (values) => treeVisual([
          Array.from({ length: asNumber(values, "choicesA", 3) }, (_, index) => String.fromCharCode(65 + index)),
          Array.from({ length: asNumber(values, "choicesB", 2) }, (_, index) => String(index + 1)),
          ["finish"]
        ], "branch by branch"),
        controls: [range("choicesA", "first choice", 2, 4), range("choicesB", "second choice", 2, 4)],
        speak: () => `Count the choices at each stage, then multiply.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also shows up as probability after the counting is done.`,
        derivation: () => `count total outcomes first`,
        visual: (values) => probabilityGridVisual(asNumber(values, "choicesA", 3), asNumber(values, "choicesB", 2), [[0, 0], [1, 1]], "outcome space")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `One branch for the first choice and one branch for the second choice.`,
        derivation: (values) => `${asNumber(values, "choicesA", 3)} × ${asNumber(values, "choicesB", 2)}`,
        visual: (values) => treeVisual([
          Array.from({ length: asNumber(values, "choicesA", 3) }, (_, index) => String.fromCharCode(65 + index)),
          Array.from({ length: asNumber(values, "choicesB", 2) }, (_, index) => String(index + 1)),
          ["finish"]
        ], "count outcomes"),
        prompt: (values) => `How many total outcomes are there?`,
        options: (values) => numberOptions(asNumber(values, "choicesA", 3) * asNumber(values, "choicesB", 2), asNumber(values, "choicesA", 3) + asNumber(values, "choicesB", 2), asNumber(values, "choicesA", 3) ** asNumber(values, "choicesB", 2)),
        correctIndex: () => 0,
        success: () => `Exactly. Multiply the choice counts stage by stage.`,
        retry: () => `A tree multiplies the number of choices at each step.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same tree move helps with combinations, sample spaces, and repeated trials.`,
        derivation: () => `count in stages`,
        visual: () => lessonCard(title, summary, "tree move")
      }
    ]
  };
}

function buildAlgebraModelsStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { slope1: 1, intercept1: 2, slope2: -1, intercept2: 6 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Model the situation first. On a graph, the answer is often where two rules meet.`,
        derivation: (values) => `${asNumber(values, "slope1", 1)}x + ${asNumber(values, "intercept1", 2)} = ${asNumber(values, "slope2", -1)}x + ${asNumber(values, "intercept2", 6)}`,
        visual: (values) => systemGraphVisual(asNumber(values, "slope1", 1), asNumber(values, "intercept1", 2), asNumber(values, "slope2", -1), asNumber(values, "intercept2", 6), "two rules, one point"),
        controls: [range("slope1", "line 1 slope", 1, 3), range("intercept1", "line 1 intercept", 0, 4), range("intercept2", "line 2 intercept", 4, 8)],
        speak: () => `A model becomes solvable once you can see the two rules clearly.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often asks you to isolate a variable or compare two expressions.`,
        derivation: () => `line up like terms, then solve`,
        visual: () => formulaVisual(["isolate one variable", "substitute or compare", "check the model"], "model algebra")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Intersection means both rules are true at the same time.`,
        derivation: (values) => `${asNumber(values, "slope1", 1)}x + ${asNumber(values, "intercept1", 2)} = ${asNumber(values, "slope2", -1)}x + ${asNumber(values, "intercept2", 6)}`,
        visual: (values) => systemGraphVisual(asNumber(values, "slope1", 1), asNumber(values, "intercept1", 2), asNumber(values, "slope2", -1), asNumber(values, "intercept2", 6), "find the meeting point"),
        prompt: (values) => `What is the x-value where the two lines meet?`,
        options: (values) => {
          const m1 = asNumber(values, "slope1", 1);
          const b1 = asNumber(values, "intercept1", 2);
          const m2 = asNumber(values, "slope2", -1);
          const b2 = asNumber(values, "intercept2", 6);
          const correct = (b2 - b1) / (m1 - m2);
          return numberOptions(Math.round(correct), Math.round(correct) + 1, Math.round(correct) - 1);
        },
        correctIndex: () => 0,
        success: () => `Nice. The intersection is where both equations agree.`,
        retry: () => `Set the two expressions equal because they describe the same y-value at the meeting point.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same modeling move helps with surds, inequalities, and word models.`,
        derivation: () => `translate → model → solve → check`,
        visual: () => lessonCard(title, summary, "model first")
      }
    ]
  };
}

function buildFunctionsSequencesStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { a: 1, h: 3, k: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Quadratic patterns bend. The vertex tells you the turn and the symmetry of the graph.`,
        derivation: (values) => `y = ${asNumber(values, "a", 1)}(x − ${asNumber(values, "h", 3)})² + ${asNumber(values, "k", 2)}`,
        visual: (values) => parabolaVisual(asNumber(values, "a", 1), asNumber(values, "h", 3), asNumber(values, "k", 2), "vertex view"),
        controls: [range("a", "stretch", 1, 3), range("h", "horizontal shift", 2, 5), range("k", "vertical shift", 0, 4)],
        speak: () => `Look for the turning point. That is the anchor for the whole graph.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also appears as second differences in a table.`,
        derivation: (values) => `constant second difference signals a quadratic pattern`,
        visual: () => formulaVisual(["first differences change", "second differences stay steady"], "quadratic clue")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `The vertex is the turn point of the parabola.`,
        derivation: (values) => `vertex = (${asNumber(values, "h", 3)}, ${asNumber(values, "k", 2)})`,
        visual: (values) => parabolaVisual(asNumber(values, "a", 1), asNumber(values, "h", 3), asNumber(values, "k", 2), "find the vertex"),
        prompt: (values) => `What is the x-coordinate of the vertex?`,
        options: (values) => numberOptions(asNumber(values, "h", 3), asNumber(values, "h", 3) + 1, asNumber(values, "h", 3) - 1),
        correctIndex: () => 0,
        success: () => `Correct. The vertex tells you where the graph turns.`,
        retry: () => `Find the lowest or highest point on the graph.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same structure helps with sequences, graphs, and maximum/minimum questions.`,
        derivation: () => `turning point + symmetry`,
        visual: () => lessonCard(title, summary, "vertex first")
      }
    ]
  };
}

function buildGeometryAdvancedStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { radius: 5, angle: 60 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Advanced geometry questions often become simpler when you spot the key radius, chord, or similar triangle.`,
        derivation: (values) => `${asNumber(values, "angle", 60)}° is ${asNumber(values, "angle", 60) / 360} of a full circle`,
        visual: (values) => circleGeometryVisual(asNumber(values, "radius", 5), asNumber(values, "angle", 60), "circle fact"),
        controls: [range("radius", "radius", 3, 8), range("angle", "central angle", 30, 150)],
        speak: () => `Mark the radius or angle that controls the whole picture.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} also blends circle facts with coordinate reasoning.`,
        derivation: () => `use the key relation that stays true`,
        visual: () => lessonCard(title, summary, "geometry hook")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Turn the central angle into a fraction of the circle.`,
        derivation: (values) => `${asNumber(values, "angle", 60)}/360`,
        visual: (values) => circleGeometryVisual(asNumber(values, "radius", 5), asNumber(values, "angle", 60), "circle fraction"),
        prompt: (values) => `What fraction of the circle is ${asNumber(values, "angle", 60)}°?`,
        options: (values) => {
          const angle = asNumber(values, "angle", 60);
          return textOptions(`${angle}/360`, `${360}/${angle}`, `${angle}/180`);
        },
        correctIndex: () => 0,
        success: () => `Yes. The central angle tells you the fraction of the full turn.`,
        retry: () => `A full circle is 360°. Compare the angle to the full turn.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same idea supports arc length, sector area, and coordinate-circle problems.`,
        derivation: () => `fraction of circle → fraction of measure`,
        visual: () => lessonCard(title, summary, "circle ratio")
      }
    ]
  };
}

function buildProbabilityStrategyStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { rows: 4, cols: 4, favorable: 6 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Probability strategy questions ask you to count smartly, not exhaustively.`,
        derivation: (values) => `${asNumber(values, "favorable", 6)}/${asNumber(values, "rows", 4) * asNumber(values, "cols", 4)}`,
        visual: (values) => probabilityGridVisual(asNumber(values, "rows", 4), asNumber(values, "cols", 4), Array.from({ length: clamp(asNumber(values, "favorable", 6), 1, asNumber(values, "rows", 4) * asNumber(values, "cols", 4)) }).map((_, index) => [Math.floor(index / asNumber(values, "cols", 4)), index % asNumber(values, "cols", 4)] as [number, number]), "sample space"),
        controls: [range("rows", "row choices", 2, 5), range("cols", "column choices", 2, 5), range("favorable", "favorable", 1, 12)],
        speak: () => `Count the total space first. Then locate the favorable part.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often gets easier when you count the complement instead.`,
        derivation: (values) => `not favorable = total − favorable`,
        visual: (values) => formulaVisual([`total = ${asNumber(values, "rows", 4) * asNumber(values, "cols", 4)}`, `not favorable = total − ${asNumber(values, "favorable", 6)}`], "complement")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use favorable over total.`,
        derivation: (values) => `${asNumber(values, "favorable", 6)}/${asNumber(values, "rows", 4) * asNumber(values, "cols", 4)}`,
        visual: (values) => probabilityGridVisual(asNumber(values, "rows", 4), asNumber(values, "cols", 4), Array.from({ length: clamp(asNumber(values, "favorable", 6), 1, asNumber(values, "rows", 4) * asNumber(values, "cols", 4)) }).map((_, index) => [Math.floor(index / asNumber(values, "cols", 4)), index % asNumber(values, "cols", 4)] as [number, number]), "probability check"),
        prompt: (values) => `What is the probability of the favorable event?`,
        options: (values) => {
          const favorable = asNumber(values, "favorable", 6);
          const total = asNumber(values, "rows", 4) * asNumber(values, "cols", 4);
          return textOptions(`${favorable}/${total}`, `${total - favorable}/${total}`, `${total}/${favorable}`);
        },
        correctIndex: () => 0,
        success: () => `Correct. Favorable over total is still the main move.`,
        retry: () => `Do not confuse the complement with the favorable count.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same strategy helps with expected value, repeated trials, and combinatorics.`,
        derivation: () => `count smartly`,
        visual: () => lessonCard(title, summary, "strategy count")
      }
    ]
  };
}

function buildNumberTheoryStrategyStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { modulus: 7, value: 23 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Modular thinking compresses big numbers into a small repeating cycle.`,
        derivation: (values) => `${asNumber(values, "value", 23)} mod ${asNumber(values, "modulus", 7)} = ${asNumber(values, "value", 23) % asNumber(values, "modulus", 7)}`,
        visual: (values) => modularClockVisual(asNumber(values, "modulus", 7), asNumber(values, "value", 23), "repeat cycle"),
        controls: [range("modulus", "modulus", 3, 10), range("value", "value", 10, 80)],
        speak: () => `A modulus turns a long path into a short repeating wheel.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often becomes simpler when you reduce early instead of late.`,
        derivation: () => `reduce each part before multiplying or adding`,
        visual: () => lessonCard(title, summary, "mod first")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Walk around the modular wheel, then stop at the remainder.`,
        derivation: (values) => `${asNumber(values, "value", 23)} mod ${asNumber(values, "modulus", 7)}`,
        visual: (values) => modularClockVisual(asNumber(values, "modulus", 7), asNumber(values, "value", 23), "remainder stop"),
        prompt: (values) => `What is ${asNumber(values, "value", 23)} mod ${asNumber(values, "modulus", 7)}?`,
        options: (values) => {
          const value = asNumber(values, "value", 23);
          const modulus = asNumber(values, "modulus", 7);
          return numberOptions(value % modulus, modulus - 1, Math.floor(value / modulus));
        },
        correctIndex: () => 0,
        success: () => `Yes. The remainder is the modular position.`,
        retry: () => `Ask how many full laps fit, then keep what is left.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same cycle idea powers divisibility, powers, and parity arguments.`,
        derivation: () => `reduce to a short cycle`,
        visual: () => lessonCard(title, summary, "cycle")
      }
    ]
  };
}

function buildAdvancedAlgebraStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { root1: 2, root2: 5 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Advanced algebra is still about structure. Roots, factors, and symmetry are faster than expansion.`,
        derivation: (values) => `(x − ${asNumber(values, "root1", 2)})(x − ${asNumber(values, "root2", 5)}) = 0`,
        visual: (values) => polynomialRootsVisual(asNumber(values, "root1", 2), asNumber(values, "root2", 5), "roots and factors"),
        controls: [range("root1", "first root", 1, 6), range("root2", "second root", 2, 8)],
        speak: () => `When you can see the roots or factors, use them before expanding anything.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} questions often ask for the sum or product of roots, not the entire expansion.`,
        derivation: (values) => `sum of roots = ${asNumber(values, "root1", 2)} + ${asNumber(values, "root2", 5)}`,
        visual: (values) => formulaVisual([
          `(x − ${asNumber(values, "root1", 2)})(x − ${asNumber(values, "root2", 5)})`,
          `roots: ${asNumber(values, "root1", 2)}, ${asNumber(values, "root2", 5)}`
        ], "factor view")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `If the roots are visible, the x-intercepts are visible too.`,
        derivation: (values) => `root sum = ${asNumber(values, "root1", 2) + asNumber(values, "root2", 5)}`,
        visual: (values) => polynomialRootsVisual(asNumber(values, "root1", 2), asNumber(values, "root2", 5), "root sum"),
        prompt: (values) => `What is the sum of the roots?`,
        options: (values) => numberOptions(asNumber(values, "root1", 2) + asNumber(values, "root2", 5), asNumber(values, "root1", 2) * asNumber(values, "root2", 5), Math.abs(asNumber(values, "root2", 5) - asNumber(values, "root1", 2))),
        correctIndex: () => 0,
        success: () => `Correct. Read the roots straight from the factor form.`,
        retry: () => `The roots are the numbers that make each factor zero.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same structure-first habit helps with inequalities, systems, and polynomials.`,
        derivation: () => `factor, then read the structure`,
        visual: () => lessonCard(title, summary, "structure first")
      }
    ]
  };
}

function buildFunctionsAnalysisStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { shiftX: 1, shiftY: 2, stretch: 2 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Function analysis is about seeing how a graph changes when the rule changes.`,
        derivation: (values) => `g(x) = ${asNumber(values, "stretch", 2)}f(x − ${asNumber(values, "shiftX", 1)}) + ${asNumber(values, "shiftY", 2)}`,
        visual: (values) => transformGraphVisual(asNumber(values, "shiftX", 1), asNumber(values, "shiftY", 2), asNumber(values, "stretch", 2), "transform the graph"),
        controls: [range("shiftX", "right shift", 0, 3), range("shiftY", "up shift", 0, 3), range("stretch", "stretch", 1, 3)],
        speak: () => `Inside the function changes horizontal position. Outside changes vertical position.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} gets clearer when you separate horizontal, vertical, and stretch effects.`,
        derivation: () => `inside = horizontal, outside = vertical`,
        visual: () => formulaVisual(["inside shifts left/right", "outside shifts up/down", "stretch changes steepness"], "transform rules")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Name the vertical change correctly.`,
        derivation: (values) => `+ ${asNumber(values, "shiftY", 2)} moves the graph up ${asNumber(values, "shiftY", 2)}`,
        visual: (values) => transformGraphVisual(asNumber(values, "shiftX", 1), asNumber(values, "shiftY", 2), asNumber(values, "stretch", 2), "vertical change"),
        prompt: (values) => `If a graph becomes f(x) + ${asNumber(values, "shiftY", 2)}, what happens?`,
        options: (values) => textOptions(`it moves up ${asNumber(values, "shiftY", 2)}`, `it moves right ${asNumber(values, "shiftY", 2)}`, `it stretches by ${asNumber(values, "shiftY", 2)}`),
        correctIndex: () => 0,
        success: () => `Exactly. Adding outside the function moves the graph up.`,
        retry: () => `Outside the function changes height, not horizontal position.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same move helps with exponentials, logs, and inverse-style graph questions.`,
        derivation: () => `separate horizontal and vertical effects`,
        visual: () => lessonCard(title, summary, "transform mindset")
      }
    ]
  };
}

function buildGeometryTrigStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { adjacent: 6, opposite: 8 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Trigonometric geometry starts with one clean triangle. Label the opposite, adjacent, and hypotenuse.`,
        derivation: (values) => `${asNumber(values, "adjacent", 6)}² + ${asNumber(values, "opposite", 8)}²`,
        visual: (values) => trigTriangleVisual(asNumber(values, "adjacent", 6), asNumber(values, "opposite", 8), "right triangle"),
        controls: [range("adjacent", "adjacent", 3, 9), range("opposite", "opposite", 4, 12)],
        speak: () => `Name the sides relative to the chosen angle before using a trig ratio or Pythagorean fact.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often becomes a coordinate or right-triangle problem after one redraw.`,
        derivation: () => `label the triangle, then choose the right relation`,
        visual: () => lessonCard(title, summary, "triangle first")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use the side labels, not memory alone.`,
        derivation: (values) => `${asNumber(values, "adjacent", 6)}² + ${asNumber(values, "opposite", 8)}²`,
        visual: (values) => trigTriangleVisual(asNumber(values, "adjacent", 6), asNumber(values, "opposite", 8), "find the hypotenuse"),
        prompt: (values) => `What is the hypotenuse?`,
        options: (values) => {
          const a = asNumber(values, "adjacent", 6);
          const b = asNumber(values, "opposite", 8);
          const hyp = Math.round(Math.sqrt(a * a + b * b));
          return numberOptions(hyp, a + b, Math.abs(a - b));
        },
        correctIndex: () => 0,
        success: () => `Correct. The right triangle gave you the structure.`,
        retry: () => `Use the Pythagorean relationship on the labeled sides.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same picture move helps with sine, cosine, and analytic-geometry distance questions.`,
        derivation: () => `label → relate → solve`,
        visual: () => lessonCard(title, summary, "diagram first")
      }
    ]
  };
}

function buildUpperCountingProbabilityStages(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { first: 4, second: 3 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: () => `Upper-band counting is still stage-by-stage counting. The difference is that the stages may shrink as choices are used.`,
        derivation: (values) => `${asNumber(values, "first", 4)} × ${asNumber(values, "second", 3)} = ${asNumber(values, "first", 4) * asNumber(values, "second", 3)}`,
        visual: (values) => treeVisual([
          Array.from({ length: asNumber(values, "first", 4) }, (_, index) => `A${index + 1}`),
          Array.from({ length: asNumber(values, "second", 3) }, (_, index) => `B${index + 1}`),
          ["finish"]
        ], "ordered stages"),
        controls: [range("first", "first-stage choices", 2, 5), range("second", "second-stage choices", 1, 4)],
        speak: () => `Count one stage at a time. If choices are used up, the next stage shrinks.`
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} often asks whether order matters.`,
        derivation: () => `ordered selections multiply through the stages`,
        visual: () => formulaVisual(["order matters → staged count", "order does not matter → divide duplicates"], "counting choice")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Multiply the available choices at each stage.`,
        derivation: (values) => `${asNumber(values, "first", 4)} × ${asNumber(values, "second", 3)}`,
        visual: (values) => treeVisual([
          Array.from({ length: asNumber(values, "first", 4) }, (_, index) => `A${index + 1}`),
          Array.from({ length: asNumber(values, "second", 3) }, (_, index) => `B${index + 1}`),
          ["finish"]
        ], "stage product"),
        prompt: (values) => `How many ordered outcomes are there?`,
        options: (values) => numberOptions(asNumber(values, "first", 4) * asNumber(values, "second", 3), asNumber(values, "first", 4) + asNumber(values, "second", 3), asNumber(values, "first", 4) ** asNumber(values, "second", 3)),
        correctIndex: () => 0,
        success: () => `Yes. Ordered choices multiply across the stages.`,
        retry: () => `Think of the problem as a short tree with one branch per stage.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `This same move powers combinations, binomial counting, and probability numerators.`,
        derivation: () => `stage-by-stage before formulas`,
        visual: () => lessonCard(title, summary, "stages first")
      }
    ]
  };
}

const SPECIFIC_TOPIC_BUILDERS: Record<string, TopicBuilder> = {
  "g34:operations_place_value": buildPlaceValueStages,
  "g34:multiplicative_thinking": buildMultiplicativeStages,
  "g34:fractions_shares": buildFractionShareStages,
  "g34:measurement_data": buildMeasurementDataStages,
  "g34:geometry_space": buildGeometrySpaceStages,
  "g34:patterns_equations": buildPatternsEquationStages,
  "g34:coordinates_paths": buildCoordinatesPathStages,
  "g34:exam_labs": buildG34ExamStages,
  "g56:number_theory": buildNumberTheoryStages,
  "g56:fractions_ratios": buildFractionsRatiosStages,
  "g56:algebra_patterns": buildAlgebraPatternStages,
  "g56:geometry_measurement": buildGeometryMeasurementStages,
  "g56:graphs_probability": buildGraphsProbabilityStages,
  "g56:exam_labs": buildG56ExamStages,
  "g78:algebra_core": buildAlgebraCoreStages,
  "g78:ratios_percents": buildRatiosPercentsStages,
  "g78:geometry_reasoning": buildGeometryReasoningStages,
  "g78:graphs_functions": buildGraphsFunctionsStages,
  "g78:counting_probability": buildCountingProbabilityStages,
  "g78:exam_labs": buildG78ExamStages,
  "g910:algebra_models": buildAlgebraModelsStages,
  "g910:functions_sequences": buildFunctionsSequencesStages,
  "g910:geometry_advanced": buildGeometryAdvancedStages,
  "g910:probability_strategy": buildProbabilityStrategyStages,
  "g910:number_theory_strategy": buildNumberTheoryStrategyStages,
  "g910:exam_labs": buildG910ExamStages,
  "g1112:advanced_algebra": buildAdvancedAlgebraStages,
  "g1112:functions_analysis": buildFunctionsAnalysisStages,
  "g1112:geometry_trig": buildGeometryTrigStages,
  "g1112:counting_probability": buildUpperCountingProbabilityStages,
  "g1112:number_theory": buildNumberTheoryStrategyStages,
  "g1112:exam_labs": buildG1112ExamStages
};

export const SPECIFIC_GUIDED_BUILDER_KEYS = Object.keys(SPECIFIC_TOPIC_BUILDERS);

export function hasSpecificGuidedBuilder(bandId: string, topicKey: string): boolean {
  return Boolean(SPECIFIC_TOPIC_BUILDERS[`${bandId}:${topicKey}`]);
}

function fallbackGuidedTopic(title: string, summary: string): TopicLessonConfig {
  return {
    initialValues: { a: 8, b: 5 },
    stages: [
      {
        id: "idea",
        title: "Big Idea",
        body: (values) => `Use structure before calculation. Start with ${asNumber(values, "a", 8)} and ${asNumber(values, "b", 5)} in one clean equation.`,
        derivation: (values) => `${asNumber(values, "a", 8)} + ${asNumber(values, "b", 5)} = ${asNumber(values, "a", 8) + asNumber(values, "b", 5)}`,
        visual: (values) => lessonCard(title, summary, "lesson"),
        controls: [range("a", "first number", 2, 20), range("b", "second number", 2, 20)]
      },
      {
        id: "worked",
        title: "Worked Move",
        body: () => `${title} becomes easier when the structure is visible.`,
        derivation: () => `one clean move`,
        visual: () => lessonCard(title, summary, "worked")
      },
      {
        id: "check",
        title: "Quick Check",
        body: () => `Use the visible structure first.`,
        derivation: (values) => `${asNumber(values, "a", 8)} + ${asNumber(values, "b", 5)}`,
        visual: () => lessonCard(title, summary, "check"),
        prompt: (values) => `What is ${asNumber(values, "a", 8)} + ${asNumber(values, "b", 5)}?`,
        options: (values) => numberOptions(asNumber(values, "a", 8) + asNumber(values, "b", 5), asNumber(values, "a", 8) + asNumber(values, "b", 5) + 1, asNumber(values, "a", 8) + asNumber(values, "b", 5) - 1),
        correctIndex: () => 0,
        success: () => `Correct.`,
        retry: () => `Try one clean equation first.`
      },
      {
        id: "transfer",
        title: "Transfer",
        body: () => `Reuse the same move in a fresh wrapper.`,
        derivation: () => `same structure, new surface`,
        visual: () => lessonCard(title, summary, "transfer")
      }
    ]
  };
}

export function buildGuidedTopics(coverageMap: BandCoverageMap): GuidedTopic[] {
  const groups = new Map<string, typeof coverageMap.curriculum>();
  for (const row of coverageMap.curriculum) {
    const list = groups.get(row.lessonTopic) || [];
    list.push(row);
    groups.set(row.lessonTopic, list);
  }

  return [...groups.entries()].map(([topicKey, rows]) => {
    const title = rows.map((row) => row.title).slice(0, 2).join(" + ");
    const summary = rows[0]?.summary || "Interactive concept practice";
    const builder = SPECIFIC_TOPIC_BUILDERS[`${coverageMap.bandId}:${topicKey}`] || fallbackGuidedTopic;
    const built = builder(title, summary);

    return {
      id: `${coverageMap.bandId}_${topicKey}`,
      title,
      summary,
      skills: rows.map((row) => row.skillId),
      grades: coverageMap.grades,
      initialValues: built.initialValues,
      stages: built.stages
    };
  });
}
