import type { Grade, SkillId, VisualAssetSpec } from "../domain/types";
import { renderBrokenLine, renderCube, renderPictograph, renderSymmetry, renderVenn } from "../render/visualQuestionRenderer";

type LessonValue = number | string;
export type GuidedTopicId =
  | "counting_patterns"
  | "compare_place_value"
  | "add_sub_balance"
  | "number_line_positions"
  | "fractions_groups"
  | "sorting_sets_logic"
  | "measure_money_time"
  | "shapes_space"
  | "data_likelihood"
  | "perimeter_regions";

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asNumber(values: Record<string, LessonValue>, key: string): number {
  return Number(values[key] ?? 0);
}

function asString(values: Record<string, LessonValue>, key: string): string {
  return String(values[key] ?? "");
}

function ordinalLabel(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
  const last = value % 10;
  if (last === 1) return `${value}st`;
  if (last === 2) return `${value}nd`;
  if (last === 3) return `${value}rd`;
  return `${value}th`;
}

function formatMoney(cents: number): string {
  return `${cents}c`;
}

function numberChoice(correct: number, offsets: [number, number, number]): { options: [string, string, string]; correctIndex: number } {
  const numbers: number[] = [];
  for (const offset of offsets) {
    let candidate = clamp(correct + offset, 0, 99);
    while (numbers.includes(candidate)) candidate += 1;
    numbers.push(candidate);
  }
  const correctIndex = numbers.indexOf(correct);
  if (correctIndex === -1) {
    numbers[1] = correct;
    return { options: [String(numbers[0]), String(numbers[1]), String(numbers[2])], correctIndex: 1 };
  }
  return { options: [String(numbers[0]), String(numbers[1]), String(numbers[2])], correctIndex };
}

const SVG_HEAD =
  "xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120' preserveAspectRatio='xMidYMid meet' shape-rendering='geometricPrecision' text-rendering='geometricPrecision'";
const GUIDED_SVG_INK = "#f2f7ff";

function svg(inner: string): string {
  return `<svg ${SVG_HEAD} role='img'>${inner.replaceAll("currentColor", GUIDED_SVG_INK)}</svg>`;
}

function scene(inner: string): string {
  return `
    <rect x='8' y='8' width='224' height='104' rx='12' fill='currentColor' fill-opacity='0.045' stroke='currentColor' stroke-width='2'/>
    <g stroke='currentColor' stroke-opacity='0.12' stroke-width='1'>
      <line x1='18' y1='34' x2='222' y2='34'/>
      <line x1='18' y1='62' x2='222' y2='62'/>
      <line x1='18' y1='90' x2='222' y2='90'/>
    </g>
    ${inner}
  `;
}

function badge(x: number, y: number, text: string): string {
  const width = Math.max(26, text.length * 6 + 10);
  return `
    <g transform='translate(${x} ${y})'>
      <rect width='${width}' height='16' rx='8' fill='currentColor' fill-opacity='0.14' stroke='currentColor' stroke-width='1.5'/>
      <text x='${width / 2}' y='11' text-anchor='middle' font-size='9' font-weight='700' fill='currentColor'>${text}</text>
    </g>
  `;
}

function label(x: number, y: number, text: string, size = 10, anchor = "middle"): string {
  return `<text x='${x}' y='${y}' text-anchor='${anchor}' font-size='${size}' font-weight='700' fill='currentColor'>${text}</text>`;
}

function sequenceVisual(start: number, step: number, count: number, highlightIndex = -1): VisualAssetSpec {
  const values = Array.from({ length: count }, (_, index) => start + step * index);
  const chips = values
    .map((value, index) => {
      const x = 24 + index * 38;
      const active = index === highlightIndex;
      return `
        <g transform='translate(${x} 46)'>
          <rect x='0' y='0' width='30' height='28' rx='14' fill='currentColor' fill-opacity='${active ? 0.22 : 0.09}' stroke='currentColor' stroke-width='${active ? 2.5 : 1.6}'/>
          <text x='15' y='18' text-anchor='middle' font-size='12' font-weight='800' fill='currentColor'>${value}</text>
        </g>
      `;
    })
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `+${step}`)}${chips}`)),
    altText: `Sequence starting at ${start} and growing by ${step}`
  };
}

function placeValueVisual(aTens: number, aOnes: number, bTens: number, bOnes: number): VisualAssetSpec {
  const rods = (x: number, tens: number, ones: number, name: string) => {
    const tensRods = Array.from({ length: tens })
      .map((_, index) => `<rect x='${x + index * 10}' y='38' width='6' height='44' rx='3' fill='currentColor' fill-opacity='0.22' stroke='currentColor' stroke-width='1.2'/>`)
      .join("");
    const onesDots = Array.from({ length: ones })
      .map((_, index) => `<circle cx='${x + index * 10 + 3}' cy='95' r='3.2' fill='currentColor' fill-opacity='0.85'/>`)
      .join("");
    return `${badge(x, 14, `${name} ${tens}${ones}`)}${tensRods}${onesDots}`;
  };
  return {
    kind: "lesson",
    svg: svg(scene(`${rods(24, aTens, aOnes, "A")}${rods(126, bTens, bOnes, "B")}`)),
    altText: `Place value cards A ${aTens}${aOnes} and B ${bTens}${bOnes}`
  };
}

function partWholeVisual(partA: number, partB: number): VisualAssetSpec {
  const total = partA + partB;
  const counters = (x: number, count: number, tone: number) =>
    Array.from({ length: count })
      .map((_, index) => `<circle cx='${x + (index % 5) * 14}' cy='${52 + Math.floor(index / 5) * 14}' r='5' fill='currentColor' fill-opacity='${tone}'/>`)
      .join("");
  return {
    kind: "lesson",
    svg: svg(
      scene(`
        ${badge(22, 14, `part ${partA}`)}
        ${badge(98, 14, `part ${partB}`)}
        ${badge(170, 14, `whole ${total}`)}
        ${counters(28, partA, 0.5)}
        ${counters(104, partB, 0.7)}
        ${counters(176, total, 0.88)}
      `)
    ),
    altText: `Part whole model with parts ${partA} and ${partB} making ${total}`
  };
}

function balanceVisual(boxValue: number, extra: number): VisualAssetSpec {
  const total = boxValue + extra;
  return {
    kind: "lesson",
    svg: svg(
      scene(`
        <line x1='120' y1='22' x2='120' y2='42' stroke='currentColor' stroke-width='3'/>
        <line x1='62' y1='42' x2='178' y2='42' stroke='currentColor' stroke-width='3'/>
        <line x1='86' y1='42' x2='72' y2='82' stroke='currentColor' stroke-width='2.5'/>
        <line x1='154' y1='42' x2='168' y2='82' stroke='currentColor' stroke-width='2.5'/>
        <rect x='54' y='82' width='36' height='8' rx='4' fill='currentColor' fill-opacity='0.2'/>
        <rect x='150' y='82' width='36' height='8' rx='4' fill='currentColor' fill-opacity='0.2'/>
        <rect x='58' y='58' width='28' height='20' rx='6' fill='currentColor' fill-opacity='0.18' stroke='currentColor' stroke-width='1.5'/>
        ${label(72, 71, "box", 9)}
        ${Array.from({ length: total })
          .map((_, index) => `<circle cx='${156 + (index % 4) * 12}' cy='${62 + Math.floor(index / 4) * 12}' r='4' fill='currentColor' fill-opacity='0.85'/>`)
          .join("")}
        ${badge(18, 14, `box = ${boxValue}`)}
        ${badge(122, 14, `${boxValue} + ${extra} = ${total}`)}
      `)
    ),
    altText: `Balance showing one box and ${total} counters`
  };
}

function numberLineVisual(start: number, jump: number, direction: string): VisualAssetSpec {
  const delta = direction === "left" ? -jump : jump;
  const end = start + delta;
  const low = Math.min(start, end) - 1;
  const high = Math.max(start, end) + 1;
  const ticks = Array.from({ length: high - low + 1 }, (_, index) => low + index)
    .map((value, index) => {
      const x = 32 + index * 30;
      return `<line x1='${x}' y1='68' x2='${x}' y2='80' stroke='currentColor' stroke-width='2'/><text x='${x}' y='94' text-anchor='middle' font-size='10' fill='currentColor'>${value}</text>`;
    })
    .join("");
  const startX = 32 + (start - low) * 30;
  const endX = 32 + (end - low) * 30;
  const arrowHead = direction === "left" ? `${endX + 2},52 ${endX + 12},46 ${endX + 12},58` : `${endX - 2},52 ${endX - 12},46 ${endX - 12},58`;
  return {
    kind: "lesson",
    svg: svg(
      scene(`
        ${badge(18, 14, `${start} ${direction === "left" ? "-" : "+"} ${jump}`)}
        ${badge(146, 14, `land ${end}`)}
        <line x1='32' y1='74' x2='208' y2='74' stroke='currentColor' stroke-width='2.5'/>
        ${ticks}
        <line x1='${startX}' y1='52' x2='${endX}' y2='52' stroke='currentColor' stroke-width='3'/>
        <polygon points='${arrowHead}' fill='currentColor'/>
      `)
    ),
    altText: `Number line jump from ${start} ${direction} by ${jump} to ${end}`
  };
}

function fractionVisual(parts: number, shaded: number): VisualAssetSpec {
  const cells = Array.from({ length: parts })
    .map((_, index) => {
      const x = 30 + index * 24;
      return `<rect x='${x}' y='44' width='20' height='36' rx='6' fill='currentColor' fill-opacity='${index < shaded ? 0.72 : 0.08}' stroke='currentColor' stroke-width='1.5'/>`;
    })
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `${shaded}/${parts}`)}${cells}`)),
    altText: `Bar model with ${shaded} of ${parts} equal parts shaded`
  };
}

function groupingVisual(groups: number, each: number): VisualAssetSpec {
  const blocks = Array.from({ length: groups })
    .map((_, groupIndex) => {
      const x = 26 + groupIndex * 52;
      const circles = Array.from({ length: each })
        .map((__, itemIndex) => `<circle cx='${x + 10 + (itemIndex % 3) * 12}' cy='${48 + Math.floor(itemIndex / 3) * 12}' r='4.5' fill='currentColor' fill-opacity='0.85'/>`)
        .join("");
      return `<rect x='${x}' y='34' width='42' height='44' rx='10' fill='currentColor' fill-opacity='0.05' stroke='currentColor' stroke-width='1.5'/>${circles}`;
    })
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `${groups} groups`)}${badge(98, 14, `${each} in each`)}${blocks}`)),
    altText: `${groups} equal groups with ${each} in each group`
  };
}

function rulerVisual(length: number): VisualAssetSpec {
  const ticks = Array.from({ length: 11 })
    .map((_, index) => {
      const x = 26 + index * 18;
      return `<line x1='${x}' y1='52' x2='${x}' y2='${index % 5 === 0 ? 84 : 74}' stroke='currentColor' stroke-width='2'/><text x='${x}' y='94' text-anchor='middle' font-size='9' fill='currentColor'>${index}</text>`;
    })
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `${length} cm`)}<rect x='26' y='58' width='${length * 18}' height='12' rx='6' fill='currentColor' fill-opacity='0.22'/>${ticks}`)),
    altText: `Ruler showing a length of ${length} centimeters`
  };
}

function clockVisual(hour: number, halfTurn: string): VisualAssetSpec {
  const minuteAngle = halfTurn === "half" ? 180 : 0;
  const hourAngle = ((hour % 12) / 12) * 360 + (halfTurn === "half" ? 15 : 0);
  const hand = (angle: number, length: number, width: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = 120 + Math.cos(rad) * length;
    const y = 66 + Math.sin(rad) * length;
    return `<line x1='120' y1='66' x2='${x}' y2='${y}' stroke='currentColor' stroke-width='${width}' stroke-linecap='round'/>`;
  };
  const labelText = `${hour}:${halfTurn === "half" ? "30" : "00"}`;
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, labelText)}<circle cx='120' cy='66' r='34' fill='none' stroke='currentColor' stroke-width='2.5'/>${Array.from({ length: 12 }).map((_, index) => {
      const angle = ((index + 1) / 12) * 360;
      const rad = ((angle - 90) * Math.PI) / 180;
      return `<text x='${120 + Math.cos(rad) * 24}' y='${70 + Math.sin(rad) * 24}' text-anchor='middle' font-size='8' fill='currentColor'>${index + 1}</text>`;
    }).join("")}${hand(minuteAngle, 26, 3)}${hand(hourAngle, 18, 4)}<circle cx='120' cy='66' r='3' fill='currentColor'/>`)),
    altText: `Clock showing ${labelText}`
  };
}

function moneyVisual(pennies: number, nickels: number, dimes: number): VisualAssetSpec {
  const total = pennies + nickels * 5 + dimes * 10;
  const coins = [
    ...Array.from({ length: pennies }, () => ["1", "p"]),
    ...Array.from({ length: nickels }, () => ["5", "n"]),
    ...Array.from({ length: dimes }, () => ["10", "d"])
  ];
  const nodes = coins
    .slice(0, 9)
    .map(([labelText], index) => `<circle cx='${36 + (index % 3) * 34}' cy='${48 + Math.floor(index / 3) * 24}' r='11' fill='currentColor' fill-opacity='0.18' stroke='currentColor' stroke-width='1.5'/><text x='${36 + (index % 3) * 34}' y='${52 + Math.floor(index / 3) * 24}' text-anchor='middle' font-size='9' font-weight='700' fill='currentColor'>${labelText}</text>`)
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, formatMoney(total))}${badge(110, 14, `${dimes}d ${nickels}n ${pennies}p`)}${nodes}`)),
    altText: `Coins totaling ${total} cents`
  };
}

function calendarVisual(day: number, move: number): VisualAssetSpec {
  const target = day + move;
  const cells = Array.from({ length: 14 })
    .map((_, index) => {
      const value = index + 1;
      const row = Math.floor(index / 7);
      const col = index % 7;
      const x = 38 + col * 24;
      const y = 36 + row * 24;
      const active = value === day;
      const landing = value === target;
      return `<rect x='${x}' y='${y}' width='20' height='18' rx='5' fill='currentColor' fill-opacity='${landing ? 0.22 : active ? 0.14 : 0.04}' stroke='currentColor' stroke-width='${landing ? 2 : 1.2}'/><text x='${x + 10}' y='${y + 12}' text-anchor='middle' font-size='9' fill='currentColor'>${value}</text>`;
    })
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `${day} + ${move}`)}${badge(132, 14, `land ${target}`)}${cells}`)),
    altText: `Calendar move from day ${day} forward ${move} days`
  };
}

function shapeVisual(sides: number): VisualAssetSpec {
  const polygonPoints: Record<number, string> = {
    3: "120,30 160,92 80,92",
    4: "84,34 156,34 156,92 84,92",
    5: "120,26 162,52 146,94 94,94 78,52",
    6: "100,28 140,28 166,58 140,90 100,90 74,58"
  };
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `${sides} sides`)}<polygon points='${polygonPoints[sides] || polygonPoints[4]}' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2.5'/>`)),
    altText: `Polygon with ${sides} sides`
  };
}

function likelihoodVisual(blue: number, red: number): VisualAssetSpec {
  const marbles = [
    ...Array.from({ length: blue }, () => "blue"),
    ...Array.from({ length: red }, () => "red")
  ];
  const nodes = marbles
    .map((color, index) => `<circle cx='${44 + (index % 4) * 28}' cy='${46 + Math.floor(index / 4) * 24}' r='8' fill='currentColor' fill-opacity='${color === "blue" ? 0.85 : 0.3}' stroke='currentColor' stroke-width='1.4'/>`)
    .join("");
  return {
    kind: "lesson",
    svg: svg(scene(`${badge(18, 14, `blue ${blue}`)}${badge(108, 14, `red ${red}`)}${nodes}`)),
    altText: `Bag with ${blue} blue and ${red} red marbles`
  };
}

function regionVisual(left: number, right: number): VisualAssetSpec {
  const widthA = left * 10;
  const widthB = right * 10;
  return {
    kind: "region_compare",
    svg: svg(scene(`<rect x='34' y='40' width='${widthA}' height='34' fill='currentColor' fill-opacity='0.14' stroke='currentColor' stroke-width='2'/><rect x='132' y='40' width='${widthB}' height='34' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2'/><text x='${34 + widthA / 2}' y='61' text-anchor='middle' font-size='11' font-weight='700' fill='currentColor'>A</text><text x='${132 + widthB / 2}' y='61' text-anchor='middle' font-size='11' font-weight='700' fill='currentColor'>B</text>`)),
    altText: `Region A width ${left} units and region B width ${right} units`
  };
}

const TOPICS: GuidedTopic[] = [
  {
    id: "counting_patterns",
    title: "Counting + Patterns",
    summary: "Count in order, follow one jump rule, and read positions correctly.",
    skills: ["counting_ordering", "ordinal_numbers", "patterns"],
    grades: [1, 2],
    initialValues: { start: 4, step: 2, count: 5, ordinal: 3 },
    stages: [
      {
        id: "rule",
        title: "Grow One Rule",
        body: (v) => `Move the start and the jump. The pattern must keep one rule from beginning to end.`,
        derivation: (v) => {
          const start = asNumber(v, "start");
          const step = asNumber(v, "step");
          return `${start}, ${start + step}, ${start + step * 2}, ${start + step * 3}, ${start + step * 4}`;
        },
        visual: (v) => sequenceVisual(asNumber(v, "start"), asNumber(v, "step"), asNumber(v, "count")),
        controls: [
          { kind: "range", key: "start", label: "start", min: 1, max: 12 },
          { kind: "range", key: "step", label: "jump", min: 1, max: 4 },
          { kind: "range", key: "count", label: "terms", min: 4, max: 5 }
        ],
        speak: (v) => `Start at ${asNumber(v, "start")} and jump by ${asNumber(v, "step")}. Keep the same rule every time.`
      },
      {
        id: "next",
        title: "Check The Next Number",
        body: (v) => `Now use the same jump rule without recounting from the start.`,
        derivation: (v) => `The next number is the last number plus the jump.`,
        visual: (v) => sequenceVisual(asNumber(v, "start"), asNumber(v, "step"), asNumber(v, "count")),
        controls: [
          { kind: "range", key: "start", label: "start", min: 1, max: 12 },
          { kind: "range", key: "step", label: "jump", min: 1, max: 4 }
        ],
        prompt: (v) => {
          const start = asNumber(v, "start");
          const step = asNumber(v, "step");
          return `What number comes after ${start + step * 3}?`;
        },
        options: (v) => {
          const start = asNumber(v, "start");
          const step = asNumber(v, "step");
          return numberChoice(start + step * 4, [-1, 0, 2]).options;
        },
        correctIndex: (v) => numberChoice(asNumber(v, "start") + asNumber(v, "step") * 4, [-1, 0, 2]).correctIndex,
        success: (v) => `Correct. Add the same jump again: ${asNumber(v, "step")}.`,
        retry: (v) => `Keep one rule. Add ${asNumber(v, "step")} to the last number.`,
        speak: (v) => `Use the same jump again. Do not restart the whole count.`
      },
      {
        id: "ordinal",
        title: "Read Position Words",
        body: (v) => `Ordinal words tell place: first, second, third. Count from the side named in the clue.`,
        derivation: (v) => `${ordinalLabel(asNumber(v, "ordinal"))} from the left is highlighted.`,
        visual: (v) => sequenceVisual(1, 1, 5, asNumber(v, "ordinal") - 1),
        controls: [{ kind: "range", key: "ordinal", label: "place", min: 1, max: 5 }],
        prompt: (v) => `Which position is highlighted?`,
        options: (v) => {
          const correct = ordinalLabel(asNumber(v, "ordinal"));
          const prev = ordinalLabel(Math.max(1, asNumber(v, "ordinal") - 1));
          const next = ordinalLabel(Math.min(5, asNumber(v, "ordinal") + 1));
          return [prev, correct, next];
        },
        correctIndex: () => 1,
        success: (v) => `Correct. ${ordinalLabel(asNumber(v, "ordinal"))} tells the position.`,
        retry: (v) => `Count the places from the left: first, second, third...`,
        speak: (v) => `${ordinalLabel(asNumber(v, "ordinal"))} is a position word.`
      }
    ]
  },
  {
    id: "compare_place_value",
    title: "Compare + Place Value",
    summary: "Compare tens before ones and read what each digit is worth.",
    skills: ["compare_number_region", "place_value"],
    grades: [1, 2],
    initialValues: { aTens: 3, aOnes: 4, bTens: 2, bOnes: 8 },
    stages: [
      {
        id: "compare",
        title: "Tens First",
        body: () => `When both numbers have tens, compare tens before ones. Only use ones if the tens are tied.`,
        derivation: (v) => {
          const a = asNumber(v, "aTens") * 10 + asNumber(v, "aOnes");
          const b = asNumber(v, "bTens") * 10 + asNumber(v, "bOnes");
          const verdict = a === b ? "same" : a > b ? "A is greater" : "B is greater";
          return `A = ${a}, B = ${b}. ${verdict}.`;
        },
        visual: (v) => placeValueVisual(asNumber(v, "aTens"), asNumber(v, "aOnes"), asNumber(v, "bTens"), asNumber(v, "bOnes")),
        controls: [
          { kind: "range", key: "aTens", label: "A tens", min: 1, max: 7 },
          { kind: "range", key: "aOnes", label: "A ones", min: 0, max: 9 },
          { kind: "range", key: "bTens", label: "B tens", min: 1, max: 7 },
          { kind: "range", key: "bOnes", label: "B ones", min: 0, max: 9 }
        ]
      },
      {
        id: "which",
        title: "Which Is Greater?",
        body: () => `Use tens first. If the tens match, then use the ones.`,
        derivation: (v) => `Ask: which number has more tens?`,
        visual: (v) => placeValueVisual(asNumber(v, "aTens"), asNumber(v, "aOnes"), asNumber(v, "bTens"), asNumber(v, "bOnes")),
        controls: [
          { kind: "range", key: "aTens", label: "A tens", min: 1, max: 7 },
          { kind: "range", key: "bTens", label: "B tens", min: 1, max: 7 }
        ],
        prompt: (v) => `Which is greater?`,
        options: (v) => {
          const a = asNumber(v, "aTens") * 10 + asNumber(v, "aOnes");
          const b = asNumber(v, "bTens") * 10 + asNumber(v, "bOnes");
          if (a === b) return [`A (${a})`, "Same", `B (${b})`];
          if (a > b) return [`B (${b})`, `A (${a})`, "Same"];
          return [`A (${a})`, `B (${b})`, "Same"];
        },
        correctIndex: (v) => {
          const a = asNumber(v, "aTens") * 10 + asNumber(v, "aOnes");
          const b = asNumber(v, "bTens") * 10 + asNumber(v, "bOnes");
          return a === b ? 1 : a > b ? 1 : 1;
        },
        success: (v) => {
          const a = asNumber(v, "aTens") * 10 + asNumber(v, "aOnes");
          const b = asNumber(v, "bTens") * 10 + asNumber(v, "bOnes");
          return a === b ? `Correct. Both numbers are equal.` : `Correct. Compare tens before ones.`;
        },
        retry: () => `Check the tens digit first. Use the ones only if the tens are equal.`
      },
      {
        id: "digit-value",
        title: "Read The Digit Job",
        body: (v) => `The same digit can mean different amounts depending on its place.`,
        derivation: (v) => `${asNumber(v, "aTens")} in the tens place means ${asNumber(v, "aTens") * 10}.`,
        visual: (v) => placeValueVisual(asNumber(v, "aTens"), asNumber(v, "aOnes"), asNumber(v, "bTens"), asNumber(v, "bOnes")),
        controls: [{ kind: "range", key: "aTens", label: "tens digit", min: 1, max: 7 }],
        prompt: (v) => `What is the value of the tens digit?`,
        options: (v) => {
          const correct = asNumber(v, "aTens") * 10;
          return numberChoice(correct, [-10, 0, 10]).options;
        },
        correctIndex: (v) => numberChoice(asNumber(v, "aTens") * 10, [-10, 0, 10]).correctIndex,
        success: (v) => `Correct. ${asNumber(v, "aTens")} tens means ${asNumber(v, "aTens") * 10}.`,
        retry: (v) => `A digit in the tens place means groups of 10.`
      }
    ]
  },
  {
    id: "add_sub_balance",
    title: "Add, Subtract + Balance",
    summary: "See the parts, the whole, and the missing amount before you calculate.",
    skills: ["single_digit_add_sub", "prealgebra_balance"],
    grades: [1, 2],
    initialValues: { partA: 4, partB: 3, boxValue: 2, extra: 1 },
    stages: [
      {
        id: "parts",
        title: "Parts Make A Whole",
        body: () => `Build the whole from two parts. If one part is missing, subtract from the whole.`,
        derivation: (v) => `${asNumber(v, "partA")} + ${asNumber(v, "partB")} = ${asNumber(v, "partA") + asNumber(v, "partB")}`,
        visual: (v) => partWholeVisual(asNumber(v, "partA"), asNumber(v, "partB")),
        controls: [
          { kind: "range", key: "partA", label: "part A", min: 1, max: 8 },
          { kind: "range", key: "partB", label: "part B", min: 1, max: 8 }
        ]
      },
      {
        id: "missing",
        title: "Find The Missing Part",
        body: () => `For a missing part, take the whole and subtract the part you know.`,
        derivation: (v) => `${asNumber(v, "partA") + asNumber(v, "partB")} - ${asNumber(v, "partA")} = ${asNumber(v, "partB")}`,
        visual: (v) => partWholeVisual(asNumber(v, "partA"), asNumber(v, "partB")),
        controls: [{ kind: "range", key: "partA", label: "known part", min: 1, max: 8 }],
        prompt: (v) => {
          const whole = asNumber(v, "partA") + asNumber(v, "partB");
          return `${whole} = ${asNumber(v, "partA")} + __`;
        },
        options: (v) => numberChoice(asNumber(v, "partB"), [-1, 0, 2]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "partB"), [-1, 0, 2]).correctIndex,
        success: (v) => `Correct. The missing part is ${asNumber(v, "partB")}.`,
        retry: () => `Use whole minus known part.`
      },
      {
        id: "balance",
        title: "Keep Both Sides Equal",
        body: () => `Balance puzzles work by replacing the hidden box with what it equals.`,
        derivation: (v) => `If one box is ${asNumber(v, "boxValue")}, then one box and ${asNumber(v, "extra")} more make ${asNumber(v, "boxValue") + asNumber(v, "extra")}.`,
        visual: (v) => balanceVisual(asNumber(v, "boxValue"), asNumber(v, "extra")),
        controls: [
          { kind: "range", key: "boxValue", label: "box value", min: 1, max: 5 },
          { kind: "range", key: "extra", label: "extra", min: 0, max: 4 }
        ],
        prompt: (v) => `One box and ${asNumber(v, "extra")} more counters equal...`,
        options: (v) => numberChoice(asNumber(v, "boxValue") + asNumber(v, "extra"), [-1, 0, 2]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "boxValue") + asNumber(v, "extra"), [-1, 0, 2]).correctIndex,
        success: (v) => `Correct. Replace the box first, then add the extras.`,
        retry: () => `Treat the box like the number it stands for.`
      }
    ]
  },
  {
    id: "number_line_positions",
    title: "Number Line + Position",
    summary: "Jumps show add or subtract, and direction words tell where to count from.",
    skills: ["number_line", "relative_position"],
    grades: [1, 2],
    initialValues: { lineStart: 5, jump: 3, direction: "right", rowPlace: 2 },
    stages: [
      {
        id: "jumps",
        title: "Read A Jump",
        body: (v) => `Right means add. Left means subtract.`,
        derivation: (v) => `${asNumber(v, "lineStart")} ${asString(v, "direction") === "left" ? "-" : "+"} ${asNumber(v, "jump")}`,
        visual: (v) => numberLineVisual(asNumber(v, "lineStart"), asNumber(v, "jump"), asString(v, "direction")),
        controls: [
          { kind: "range", key: "lineStart", label: "start", min: 1, max: 10 },
          { kind: "range", key: "jump", label: "jump", min: 1, max: 4 },
          {
            kind: "toggle",
            key: "direction",
            label: "way",
            options: [
              { label: "RIGHT", value: "right" },
              { label: "LEFT", value: "left" }
            ]
          }
        ]
      },
      {
        id: "land",
        title: "Where Do You Land?",
        body: () => `Use the arrow direction before you move.`,
        derivation: (v) => `Count ${asNumber(v, "jump")} spaces ${asString(v, "direction")}.`,
        visual: (v) => numberLineVisual(asNumber(v, "lineStart"), asNumber(v, "jump"), asString(v, "direction")),
        controls: [
          { kind: "range", key: "jump", label: "jump", min: 1, max: 4 },
          { kind: "toggle", key: "direction", label: "way", options: [{ label: "RIGHT", value: "right" }, { label: "LEFT", value: "left" }] }
        ],
        prompt: (v) => `Where do you land?`,
        options: (v) => {
          const end = asNumber(v, "lineStart") + (asString(v, "direction") === "left" ? -asNumber(v, "jump") : asNumber(v, "jump"));
          return numberChoice(end, [-1, 0, 1]).options;
        },
        correctIndex: (v) => {
          const end = asNumber(v, "lineStart") + (asString(v, "direction") === "left" ? -asNumber(v, "jump") : asNumber(v, "jump"));
          return numberChoice(end, [-1, 0, 1]).correctIndex;
        },
        success: () => `Correct. Follow the arrow and count spaces, not labels.`,
        retry: () => `Follow the direction first, then count the spaces.`
      },
      {
        id: "row-position",
        title: "Use Position Words",
        body: (v) => `Count from the named side. The highlighted shape changes place when you move the slider.`,
        derivation: (v) => `${ordinalLabel(asNumber(v, "rowPlace"))} from the left is marked.`,
        visual: (v) => sequenceVisual(1, 1, 5, asNumber(v, "rowPlace") - 1),
        controls: [{ kind: "range", key: "rowPlace", label: "place", min: 1, max: 5 }],
        prompt: (v) => `Which position is marked?`,
        options: (v) => [ordinalLabel(Math.max(1, asNumber(v, "rowPlace") - 1)), ordinalLabel(asNumber(v, "rowPlace")), ordinalLabel(Math.min(5, asNumber(v, "rowPlace") + 1))],
        correctIndex: () => 1,
        success: (v) => `Correct. ${ordinalLabel(asNumber(v, "rowPlace"))} tells the place.`,
        retry: () => `Count places from the side named in the clue.`
      }
    ]
  },
  {
    id: "fractions_groups",
    title: "Fractions + Equal Groups",
    summary: "Fraction words only work with equal parts, and equal shares repeat one group size.",
    skills: ["fractions_words"],
    grades: [1, 2],
    initialValues: { parts: 4, shaded: 1, groups: 3, each: 2 },
    stages: [
      {
        id: "fraction-bar",
        title: "Name Equal Parts",
        body: () => `A half, third, or quarter only works when the parts are equal.`,
        derivation: (v) => `${asNumber(v, "shaded")} of ${asNumber(v, "parts")} equal parts are shaded.`,
        visual: (v) => fractionVisual(asNumber(v, "parts"), asNumber(v, "shaded")),
        controls: [
          { kind: "range", key: "parts", label: "parts", min: 2, max: 4 },
          { kind: "range", key: "shaded", label: "shaded", min: 1, max: 2 }
        ]
      },
      {
        id: "fraction-word",
        title: "Choose The Fraction Word",
        body: () => `Match the denominator to the number of equal parts.`,
        derivation: (v) => `Four equal parts means quarter. Three equal parts means third.`,
        visual: (v) => fractionVisual(asNumber(v, "parts"), 1),
        controls: [{ kind: "range", key: "parts", label: "parts", min: 2, max: 4 }],
        prompt: (v) => `One part of ${asNumber(v, "parts")} equal pieces is called...`,
        options: (v) => {
          const parts = asNumber(v, "parts");
          if (parts === 2) return ["one third", "one half", "one quarter"];
          if (parts === 3) return ["one half", "one third", "one quarter"];
          return ["one half", "one quarter", "one third"];
        },
        correctIndex: (v) => (asNumber(v, "parts") === 2 ? 1 : asNumber(v, "parts") === 3 ? 1 : 1),
        success: (v) => `Correct. The denominator tells how many equal parts make the whole.`,
        retry: () => `Read the number of equal parts first.`
      },
      {
        id: "equal-groups",
        title: "Build The Whole From One Group",
        body: () => `If you know one equal group, repeat it to rebuild the whole.`,
        derivation: (v) => `${asNumber(v, "groups")} groups of ${asNumber(v, "each")} make ${asNumber(v, "groups") * asNumber(v, "each")}.`,
        visual: (v) => groupingVisual(asNumber(v, "groups"), asNumber(v, "each")),
        controls: [
          { kind: "range", key: "groups", label: "groups", min: 2, max: 4 },
          { kind: "range", key: "each", label: "each", min: 1, max: 4 }
        ],
        prompt: (v) => `How many objects are there in all?`,
        options: (v) => numberChoice(asNumber(v, "groups") * asNumber(v, "each"), [-1, 0, 2]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "groups") * asNumber(v, "each"), [-1, 0, 2]).correctIndex,
        success: () => `Correct. Repeat the equal group size each time.`,
        retry: () => `Count by groups, not one by one.`
      }
    ]
  },
  {
    id: "sorting_sets_logic",
    title: "Sorting + Sets + Logic",
    summary: "Use one rule at a time and keep set parts separate.",
    skills: ["sorting_classifying", "venn_diagrams_easy", "likelihood_vocabulary"],
    grades: [1, 2],
    initialValues: { aOnly: 3, both: 2, bOnly: 1, blue: 5, red: 2 },
    stages: [
      {
        id: "set-parts",
        title: "Read Set Parts",
        body: () => `A only, both, and B only mean different parts. Do not mix them.`,
        derivation: (v) => `Exactly one set = A only + B only = ${asNumber(v, "aOnly") + asNumber(v, "bOnly")}.`,
        visual: (v) => renderVenn(asNumber(v, "aOnly"), asNumber(v, "both"), asNumber(v, "bOnly")),
        controls: [
          { kind: "range", key: "aOnly", label: "A only", min: 1, max: 5 },
          { kind: "range", key: "both", label: "both", min: 0, max: 4 },
          { kind: "range", key: "bOnly", label: "B only", min: 1, max: 5 }
        ]
      },
      {
        id: "exactly-one",
        title: "Exactly One Set",
        body: () => `Exactly one means items in A only or B only, but not the overlap.`,
        derivation: (v) => `Leave out the overlap in the middle.`,
        visual: (v) => renderVenn(asNumber(v, "aOnly"), asNumber(v, "both"), asNumber(v, "bOnly")),
        prompt: (v) => `How many items are in exactly one set?`,
        options: (v) => numberChoice(asNumber(v, "aOnly") + asNumber(v, "bOnly"), [-1, 0, 2]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "aOnly") + asNumber(v, "bOnly"), [-1, 0, 2]).correctIndex,
        success: () => `Correct. Use the two outside parts only.`,
        retry: () => `Ignore the overlap when the question says exactly one.`
      },
      {
        id: "likely",
        title: "More Means More Likely",
        body: () => `Likelihood compares counts. More blue than red means blue is more likely.`,
        derivation: (v) => `${asNumber(v, "blue")} blue and ${asNumber(v, "red")} red means blue is more likely.`,
        visual: (v) => likelihoodVisual(asNumber(v, "blue"), asNumber(v, "red")),
        controls: [
          { kind: "range", key: "blue", label: "blue", min: 1, max: 6 },
          { kind: "range", key: "red", label: "red", min: 1, max: 6 }
        ],
        prompt: (v) => `Which color is more likely to be picked?`,
        options: () => ["red", "blue", "same chance"],
        correctIndex: (v) => (asNumber(v, "blue") === asNumber(v, "red") ? 2 : asNumber(v, "blue") > asNumber(v, "red") ? 1 : 0),
        success: () => `Correct. Compare how many of each color there are.`,
        retry: () => `The color with more marbles is more likely.`
      }
    ]
  },
  {
    id: "measure_money_time",
    title: "Measure + Money + Time",
    summary: "Use the right unit, total coin values, and move time or days carefully.",
    skills: ["measurement_small", "money_small", "clock_full_half", "calendar"],
    grades: [1, 2],
    initialValues: { length: 6, pennies: 1, nickels: 1, dimes: 1, hour: 3, halfTurn: "half", day: 6, move: 2 },
    stages: [
      {
        id: "measure",
        title: "Measure Length In Units",
        body: () => `Use a length unit for objects like pencils and paths.`,
        derivation: (v) => `${asNumber(v, "length")} centimeters is a length measure.`,
        visual: (v) => rulerVisual(asNumber(v, "length")),
        controls: [{ kind: "range", key: "length", label: "length", min: 2, max: 9 }],
        prompt: (v) => `Which unit fits a pencil best?`,
        options: () => ["liters", "centimeters", "kilograms"],
        correctIndex: () => 1,
        success: () => `Correct. A pencil is measured by length.`,
        retry: () => `Pick a length unit for a pencil.`
      },
      {
        id: "money",
        title: "Count Coin Value",
        body: () => `Count coin value, not the number of coins.`,
        derivation: (v) => `${asNumber(v, "dimes")} dimes + ${asNumber(v, "nickels")} nickels + ${asNumber(v, "pennies")} pennies = ${formatMoney(asNumber(v, "dimes") * 10 + asNumber(v, "nickels") * 5 + asNumber(v, "pennies"))}`,
        visual: (v) => moneyVisual(asNumber(v, "pennies"), asNumber(v, "nickels"), asNumber(v, "dimes")),
        controls: [
          { kind: "range", key: "pennies", label: "pennies", min: 0, max: 4 },
          { kind: "range", key: "nickels", label: "nickels", min: 0, max: 3 },
          { kind: "range", key: "dimes", label: "dimes", min: 0, max: 3 }
        ],
        prompt: (v) => `What is the total value?`,
        options: (v) => numberChoice(asNumber(v, "dimes") * 10 + asNumber(v, "nickels") * 5 + asNumber(v, "pennies"), [-1, 0, 5]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "dimes") * 10 + asNumber(v, "nickels") * 5 + asNumber(v, "pennies"), [-1, 0, 5]).correctIndex,
        success: () => `Correct. Use coin values, not coin count.`,
        retry: () => `A dime is 10, a nickel is 5, and a penny is 1.`
      },
      {
        id: "time",
        title: "Move The Clock Carefully",
        body: () => `A full hour keeps the minutes the same. A half hour changes :00 to :30 or :30 to :00.`,
        derivation: (v) => `The clock shows ${asNumber(v, "hour")}:${asString(v, "halfTurn") === "half" ? "30" : "00"}.`,
        visual: (v) => clockVisual(asNumber(v, "hour"), asString(v, "halfTurn")),
        controls: [
          { kind: "range", key: "hour", label: "hour", min: 1, max: 11 },
          { kind: "toggle", key: "halfTurn", label: "minutes", options: [{ label: ":00", value: "full" }, { label: ":30", value: "half" }] }
        ],
        prompt: (v) => `What time is 30 minutes later?`,
        options: (v) => {
          const hour = asNumber(v, "hour");
          const half = asString(v, "halfTurn") === "half";
          const correct = half ? `${(hour % 12) + 1}:00` : `${hour}:30`;
          return [`${hour}:00`, correct, `${(hour % 12) + 1}:30`] as [string, string, string];
        },
        correctIndex: () => 1,
        success: () => `Correct. Half an hour later moves you to the next half or full hour.`,
        retry: () => `From :00 go to :30. From :30 go to the next full hour.`
      },
      {
        id: "calendar",
        title: "Move Forward By Days",
        body: () => `On a calendar, move one day at a time and keep your starting day.`,
        derivation: (v) => `${asNumber(v, "day")} plus ${asNumber(v, "move")} days lands on ${asNumber(v, "day") + asNumber(v, "move")}.`,
        visual: (v) => calendarVisual(asNumber(v, "day"), asNumber(v, "move")),
        controls: [
          { kind: "range", key: "day", label: "day", min: 1, max: 10 },
          { kind: "range", key: "move", label: "move", min: 1, max: 4 }
        ],
        prompt: (v) => `What day do you land on?`,
        options: (v) => numberChoice(asNumber(v, "day") + asNumber(v, "move"), [-1, 0, 1]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "day") + asNumber(v, "move"), [-1, 0, 1]).correctIndex,
        success: () => `Correct. Move forward one day at a time.`,
        retry: () => `Keep the starting day and count forward.`
      }
    ]
  },
  {
    id: "shapes_space",
    title: "Shapes + Space",
    summary: "Notice side counts, symmetry, cube faces, and picture-based shape moves.",
    skills: ["shape_properties", "maze_shape_puzzles", "cube_cuboid_visualization", "symmetry_rotation"],
    grades: [1, 2],
    initialValues: { sides: 4, filledFaces: 3, symmetryMarks: 3 },
    stages: [
      {
        id: "sides",
        title: "Count The Shape Property",
        body: () => `A shape property like side count or corners is more important than the picture style.`,
        derivation: (v) => `This shape has ${asNumber(v, "sides")} sides.`,
        visual: (v) => shapeVisual(asNumber(v, "sides")),
        controls: [{ kind: "range", key: "sides", label: "sides", min: 3, max: 6 }],
        prompt: (v) => `How many sides does the shape have?`,
        options: (v) => numberChoice(asNumber(v, "sides"), [-1, 0, 1]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "sides"), [-1, 0, 1]).correctIndex,
        success: () => `Correct. Count each side once.`,
        retry: () => `Trace around the shape and count the sides.`
      },
      {
        id: "symmetry",
        title: "Mirror Across The Line",
        body: () => `A symmetry line means the other side must match like a mirror.`,
        derivation: (v) => `If one side has ${asNumber(v, "symmetryMarks")} marks, the mirror side must match.`,
        visual: (v) => renderSymmetry([0, 1, 1, 2].slice(0, Math.max(1, asNumber(v, "symmetryMarks")))),
        controls: [{ kind: "range", key: "symmetryMarks", label: "marks", min: 1, max: 4 }],
        prompt: () => `What must the other side do?`,
        options: () => ["change size", "match the mirror", "add a new shape"],
        correctIndex: () => 1,
        success: () => `Correct. Symmetry means both sides match across the line.`,
        retry: () => `Think mirror image.`
      },
      {
        id: "cube",
        title: "Use Total Faces",
        body: () => `A cube always has 6 faces, even when some are hidden.`,
        derivation: (v) => `If ${asNumber(v, "filledFaces")} faces are marked, the others are still there even if you cannot see them all.`,
        visual: (v) => renderCube(asNumber(v, "filledFaces")),
        controls: [{ kind: "range", key: "filledFaces", label: "marked", min: 1, max: 5 }],
        prompt: (v) => `How many faces does a cube have in all?`,
        options: () => ["4", "6", "8"],
        correctIndex: () => 1,
        success: () => `Correct. A cube has 6 faces total.`,
        retry: () => `Memorize the solid: a cube has 6 faces.`
      }
    ]
  },
  {
    id: "data_likelihood",
    title: "Data + Likelihood",
    summary: "Read legends before counting and compare data totals carefully.",
    skills: ["pictographs_bar_graphs", "likelihood_vocabulary"],
    grades: [1, 2],
    initialValues: { rowA: 3, rowB: 5, rowC: 2, iconValue: 2, blueBag: 4, redBag: 2 },
    stages: [
      {
        id: "legend",
        title: "Read The Legend First",
        body: () => `A picture may stand for more than one item. Always read the legend before counting.`,
        derivation: (v) => `If one picture is worth ${asNumber(v, "iconValue")}, then row B with ${asNumber(v, "rowB")} pictures is worth ${asNumber(v, "rowB") * asNumber(v, "iconValue")}.`,
        visual: (v) => renderPictograph([asNumber(v, "rowA"), asNumber(v, "rowB"), asNumber(v, "rowC")], { labels: ["A", "B", "C"], valuePerIcon: asNumber(v, "iconValue") }),
        controls: [
          { kind: "range", key: "rowB", label: "row B", min: 2, max: 6 },
          { kind: "range", key: "iconValue", label: "each", min: 1, max: 4 }
        ]
      },
      {
        id: "row-total",
        title: "Find A Row Total",
        body: () => `Multiply picture count by the legend value.`,
        derivation: (v) => `${asNumber(v, "rowB")} x ${asNumber(v, "iconValue")} = ${asNumber(v, "rowB") * asNumber(v, "iconValue")}`,
        visual: (v) => renderPictograph([asNumber(v, "rowA"), asNumber(v, "rowB"), asNumber(v, "rowC")], { labels: ["A", "B", "C"], valuePerIcon: asNumber(v, "iconValue") }),
        prompt: (v) => `What is the total for row B?`,
        options: (v) => numberChoice(asNumber(v, "rowB") * asNumber(v, "iconValue"), [-2, 0, 2]).options,
        correctIndex: (v) => numberChoice(asNumber(v, "rowB") * asNumber(v, "iconValue"), [-2, 0, 2]).correctIndex,
        success: () => `Correct. Legend value times picture count gives the total.`,
        retry: () => `Use the legend like multiplication.`
      },
      {
        id: "more-likely",
        title: "More Data Means More Likely",
        body: () => `If there are more blue outcomes than red, blue is more likely.`,
        derivation: (v) => `${asNumber(v, "blueBag")} blue vs ${asNumber(v, "redBag")} red.`,
        visual: (v) => likelihoodVisual(asNumber(v, "blueBag"), asNumber(v, "redBag")),
        controls: [
          { kind: "range", key: "blueBag", label: "blue", min: 1, max: 6 },
          { kind: "range", key: "redBag", label: "red", min: 1, max: 6 }
        ],
        prompt: (v) => `Which outcome is more likely?`,
        options: () => ["red", "blue", "same chance"],
        correctIndex: (v) => (asNumber(v, "blueBag") === asNumber(v, "redBag") ? 2 : asNumber(v, "blueBag") > asNumber(v, "redBag") ? 1 : 0),
        success: () => `Correct. Compare the counts.`,
        retry: () => `More outcomes means more likely.`
      }
    ]
  },
  {
    id: "perimeter_regions",
    title: "Perimeter + Regions",
    summary: "Trace every edge once and compare equal units, not just shapes that look bigger.",
    skills: ["perimeter_broken_lines"],
    grades: [1, 2],
    initialValues: { sideA: 3, sideB: 4, regionA: 4, regionB: 6 },
    stages: [
      {
        id: "broken-line",
        title: "Add Every Segment Once",
        body: () => `Perimeter and broken-line questions work by tracing every segment one time.`,
        derivation: (v) => `${asNumber(v, "sideA")} + ${asNumber(v, "sideB")} + ${asNumber(v, "sideA")} + ${asNumber(v, "sideB")} = ${(asNumber(v, "sideA") + asNumber(v, "sideB")) * 2}`,
        visual: (v) => renderBrokenLine([asNumber(v, "sideA"), asNumber(v, "sideB"), asNumber(v, "sideA"), asNumber(v, "sideB")]),
        controls: [
          { kind: "range", key: "sideA", label: "width", min: 2, max: 6 },
          { kind: "range", key: "sideB", label: "height", min: 2, max: 6 }
        ]
      },
      {
        id: "perimeter-check",
        title: "Find The Total Length",
        body: () => `Do not count the same side twice unless it appears twice in the path.`,
        derivation: (v) => `Perimeter is the full walk around the edge.`,
        visual: (v) => renderBrokenLine([asNumber(v, "sideA"), asNumber(v, "sideB"), asNumber(v, "sideA"), asNumber(v, "sideB")]),
        prompt: (v) => `What is the total edge length?`,
        options: (v) => numberChoice((asNumber(v, "sideA") + asNumber(v, "sideB")) * 2, [-2, 0, 2]).options,
        correctIndex: (v) => numberChoice((asNumber(v, "sideA") + asNumber(v, "sideB")) * 2, [-2, 0, 2]).correctIndex,
        success: () => `Correct. Walk the whole boundary once.`,
        retry: () => `Add every side you would trace around the shape.`
      },
      {
        id: "regions",
        title: "Compare Equal Units",
        body: () => `Region size is decided by equal units, not by which picture looks wider.`,
        derivation: (v) => `Region B is wider here because it has more equal units.`,
        visual: (v) => regionVisual(asNumber(v, "regionA"), asNumber(v, "regionB")),
        controls: [
          { kind: "range", key: "regionA", label: "A units", min: 3, max: 7 },
          { kind: "range", key: "regionB", label: "B units", min: 3, max: 7 }
        ],
        prompt: (v) => `Which region has more equal units?`,
        options: () => ["A", "Same", "B"],
        correctIndex: (v) => (asNumber(v, "regionA") === asNumber(v, "regionB") ? 1 : asNumber(v, "regionA") > asNumber(v, "regionB") ? 0 : 2),
        success: () => `Correct. Count equal units, not the outline look.`,
        retry: () => `Count the equal units in each region.`
      }
    ]
  }
];

export function listGuidedTopics(grade: Grade): GuidedTopic[] {
  return TOPICS.filter((topic) => topic.grades.includes(grade));
}

export function getGuidedTopic(grade: Grade, topicId: GuidedTopicId): GuidedTopic | null {
  return listGuidedTopics(grade).find((topic) => topic.id === topicId) || null;
}

export function guidedSkillCoverage(grade: Grade): SkillId[] {
  return Array.from(new Set(listGuidedTopics(grade).flatMap((topic) => topic.skills)));
}
