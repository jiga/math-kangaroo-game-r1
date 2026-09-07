import type { SkillId, VisualAssetSpec } from "../domain/types";
import { estimateTextWidth, fitSingleLineText, svgSingleLineText, svgTextBlock } from "./svgText";

const SVG_HEAD =
  "xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120' preserveAspectRatio='xMidYMid meet' shape-rendering='geometricPrecision' text-rendering='geometricPrecision'";

function wrap(inner: string): string {
  return `<svg ${SVG_HEAD} role='img'>${inner.replaceAll("currentColor", "#f2f7ff")}</svg>`;
}

function frame(inner: string): string {
  return `
    <rect x='8' y='8' width='224' height='104' rx='12' fill='currentColor' fill-opacity='0.045' stroke='currentColor' stroke-width='2'/>
    <g stroke='currentColor' stroke-opacity='0.12' stroke-width='1'>
      <line x1='20' y1='34' x2='220' y2='34'/>
      <line x1='20' y1='60' x2='220' y2='60'/>
      <line x1='20' y1='86' x2='220' y2='86'/>
    </g>
    ${inner}
  `;
}

function badge(x: number, y: number, text: string): string {
  const fitted = fitSingleLineText(text, 96, 9, 6.5);
  const width = Math.max(22, Math.min(108, Math.ceil(estimateTextWidth(fitted.text, fitted.fontSize) + 12)));
  return `
    <g transform='translate(${x} ${y})'>
      <rect x='0' y='0' width='${width}' height='16' rx='8' fill='currentColor' fill-opacity='0.14' stroke='currentColor' stroke-width='1.5'/>
      ${svgSingleLineText(width / 2, 11, fitted.text, { size: fitted.fontSize, minSize: 6.5, maxWidth: width - 10 })}
    </g>
  `;
}

function starIcon(cx: number, cy: number, size: number): string {
  const points = [
    [0, -1],
    [0.23, -0.3],
    [0.95, -0.3],
    [0.38, 0.1],
    [0.6, 0.82],
    [0, 0.38],
    [-0.6, 0.82],
    [-0.38, 0.1],
    [-0.95, -0.3],
    [-0.23, -0.3]
  ]
    .map(([x, y]) => `${cx + x * size},${cy + y * size}`)
    .join(" ");
  return `<polygon points='${points}' fill='currentColor' fill-opacity='0.92' stroke='currentColor' stroke-width='1'/>`;
}

function outlinedText(x: number, y: number, text: string, fontSize: number, anchor = "middle"): string {
  return svgSingleLineText(x, y, text, {
    size: fontSize,
    minSize: Math.max(7, fontSize - 4),
    anchor: anchor as "start" | "middle" | "end",
    maxWidth: anchor === "middle" ? 180 : 130,
    stroke: "currentColor",
    strokeOpacity: 0.16,
    strokeWidth: 2,
    paintOrder: "stroke",
    weight: 700
  });
}

function lessonScene(inner: string, altText: string): VisualAssetSpec {
  return {
    kind: "lesson",
    svg: wrap(frame(inner)),
    altText
  };
}

export function renderCountingSequence(start: number, step: number): VisualAssetSpec {
  const values = [start, start + step, start + 2 * step];
  const cards = values.map((value, index) => {
    const x = 24 + index * 72;
    return `<rect data-number-card='${value}' x='${x}' y='38' width='48' height='44' rx='10' fill='currentColor' fill-opacity='0.12' stroke='currentColor' stroke-width='2'/>${svgSingleLineText(x + 24, 68, String(value), { size: 24, maxWidth: 40 })}`;
  }).join("");
  const arrows = [78, 150].map((x) => `<line x1='${x}' y1='60' x2='${x + 12}' y2='60' stroke='currentColor' stroke-width='2'/><polygon data-sequence-arrow='right' points='${x + 12},60 ${x + 7},56 ${x + 7},64' fill='currentColor'/>`).join("");
  return {
    kind: "lesson",
    svg: wrap(frame(`${cards}${arrows}`)),
    altText: `Number cards ${values.join(", ")} in order, with arrows pointing from left to right`
  };
}

export function renderArithmeticCounters(left: number, right: number, operation: "+" | "-"): VisualAssetSpec {
  const counter = (x: number, y: number, removed: boolean, group: string) => `
    <circle data-counter-group='${group}' data-removed='${removed}' cx='${x}' cy='${y}' r='6' fill='currentColor' fill-opacity='${removed ? 0.12 : 0.7}' stroke='currentColor' stroke-width='1.5'/>
    ${removed ? `<path data-take-away='true' d='M ${x - 5} ${y - 5} L ${x + 5} ${y + 5} M ${x + 5} ${y - 5} L ${x - 5} ${y + 5}' fill='none' stroke='currentColor' stroke-width='2'/>` : ""}
  `;
  const expression = svgSingleLineText(120, 29, `${left} ${operation} ${right} = ?`, { size: 18, maxWidth: 190 });
  let counters: string;
  if (operation === "+") {
    const group = (count: number, x: number, name: string) =>
      `<rect x='${x - 15}' y='38' width='70' height='63' rx='10' fill='none' stroke='currentColor' stroke-opacity='0.3'/>`
      + Array.from({ length: count }, (_, i) => counter(x + (i % 3) * 20, 50 + Math.floor(i / 3) * 19, false, name)).join("");
    counters = `${group(left, 38, "left")}${svgSingleLineText(120, 76, "+", { size: 26, maxWidth: 30 })}${group(right, 162, "right")}`;
  } else {
    // Cross out part of the original set, not a second unrelated set of objects.
    counters = `<rect x='23' y='38' width='194' height='63' rx='10' fill='none' stroke='currentColor' stroke-opacity='0.3'/>`
      + Array.from({ length: left }, (_, i) => counter(56 + (i % 5) * 32, 55 + Math.floor(i / 5) * 28, i >= left - right, "start")).join("");
  }
  return {
    kind: "lesson",
    svg: wrap(frame(`${expression}${counters}`)),
    altText: operation === "+"
      ? `Two groups of counters: ${left} on the left and ${right} on the right, with a plus sign`
      : `Start with ${left} counters. ${right} of those counters are crossed out to show taking them away`
  };
}

export function renderSideCountShape(name: string, sides: number): VisualAssetSpec {
  const angleOffset = sides === 4 ? -Math.PI / 4 : -Math.PI / 2;
  const vertices = Array.from({ length: sides }, (_, i) => {
    const angle = angleOffset + i * 2 * Math.PI / sides;
    return `${120 + 38 * Math.cos(angle)},${66 + 38 * Math.sin(angle)}`;
  }).join(" ");
  return {
    kind: "lesson",
    svg: wrap(frame(`<polygon data-shape-outline='true' points='${vertices}' fill='currentColor' fill-opacity='0.1' stroke='currentColor' stroke-width='3' stroke-linejoin='round'/>`)),
    altText: `Outline of a ${name}. Follow its edge to count the sides`
  };
}

export function renderMaze(seed: number, turns?: { leftTurns?: number; rightTurns?: number }): VisualAssetSpec {
  const leftTurns = turns?.leftTurns ?? 1 + (seed % 4);
  const rightTurns = turns?.rightTurns ?? 1 + ((seed >> 1) % 3);
  const turnOrder: number[] = [];
  let left = leftTurns;
  let right = rightTurns;
  while (left > 0 || right > 0) {
    if (left > 0) { turnOrder.push(-1); left--; }
    if (right > 0) { turnOrder.push(1); right--; }
  }
  // Shortening each leg keeps consecutive same-way turns in an open spiral.
  const raw: Array<[number, number]> = [[0, 0]];
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let heading = 0;
  for (let i = 0; i <= turnOrder.length; i++) {
    if (i > 0) heading = (heading + turnOrder[i - 1] + 4) % 4;
    const [dx, dy] = directions[heading];
    const length = turnOrder.length + 2 - i;
    const [x, y] = raw[raw.length - 1];
    raw.push([x + dx * length, y + dy * length]);
  }
  // Space the grid coordinates evenly: turns stay exact and short legs stay readable.
  const xs = [...new Set(raw.map(([x]) => x))].sort((a, b) => a - b);
  const ys = [...new Set(raw.map(([, y]) => y))].sort((a, b) => a - b);
  const routePoints = raw.map(([x, y]) => [
    xs.length === 1 ? 120 : 32 + xs.indexOf(x) * 176 / (xs.length - 1),
    ys.length === 1 ? 70 : 42 + ys.indexOf(y) * 56 / (ys.length - 1)
  ]);
  const path = routePoints.map(([x, y]) => `${x},${y}`).join(" ");
  const arrows = routePoints.slice(1).map(([x, y], i) => {
    const [px, py] = routePoints[i];
    const dx = Math.sign(x - px), dy = Math.sign(y - py);
    const cx = (x + px) / 2, cy = (y + py) / 2;
    return `<polygon points='${cx + dx * 4},${cy + dy * 4} ${cx - dx * 3 - dy * 3},${cy - dy * 3 + dx * 3} ${cx - dx * 3 + dy * 3},${cy - dy * 3 - dx * 3}' fill='currentColor'/>`;
  }).join("");
  const endpoint = (point: number[], text: string) => `<circle cx='${point[0]}' cy='${point[1]}' r='6' fill='currentColor'/>${svgSingleLineText(point[0], point[1] + 3, text, { size: 8, fill: "#15202b" })}`;
  const inner = `
    ${badge(18, 14, "S = START")}
    ${badge(130, 14, "F = FINISH")}
    <polyline points='${path}' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>
    ${arrows}
    ${endpoint(routePoints[0], "S")}
    ${endpoint(routePoints[routePoints.length - 1], "F")}
  `;

  return {
    kind: "maze",
    svg: wrap(frame(inner)),
    altText: `Path puzzle with ${leftTurns} left turns and ${rightTurns} right turns`
  };
}

export function renderVenn(aOnly: number, both: number, bOnly: number): VisualAssetSpec {
  const inner = `
    <circle cx='98' cy='66' r='36' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2.5'/>
    <circle cx='142' cy='66' r='36' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2.5'/>
    ${badge(70, 20, "A")}
    ${badge(150, 20, "B")}
    ${outlinedText(83, 70, String(aOnly), 15)}
    ${outlinedText(120, 70, String(both), 15)}
    ${outlinedText(157, 70, String(bOnly), 15)}
  `;

  return {
    kind: "venn",
    svg: wrap(frame(inner)),
    altText: `Venn diagram with A only ${aOnly}, both ${both}, and B only ${bOnly}`
  };
}

export function renderPictograph(
  groups: number[],
  options?: { labels?: string[]; valuePerIcon?: number }
): VisualAssetSpec {
  const labels = options?.labels ?? groups.map((_, idx) => String.fromCharCode(65 + idx));
  const legendText = options?.valuePerIcon ? `1 star = ${options.valuePerIcon}` : "1 star = 1";

  const rows = groups
    .map((count, idx) => {
      const y = 42 + idx * 24;
      const icons = Array.from({ length: count })
        .map((_, iconIndex) => starIcon(76 + iconIndex * Math.min(22, 128 / Math.max(1, count - 1)), y - 4, 6.5))
        .join("");
      return `
        ${badge(18, y - 12, labels[idx] ?? String.fromCharCode(65 + idx))}
        <line x1='60' y1='${y}' x2='212' y2='${y}' stroke='currentColor' stroke-opacity='0.18' stroke-width='1.5'/>
        ${icons}
      `;
    })
    .join("");

  return {
    kind: "pictograph",
    svg: wrap(
      frame(`
        ${badge(146, 14, legendText)}
        ${rows}
      `)
    ),
    altText: `Pictograph with row counts ${groups.join(",")}. ${legendText}.`
  };
}

export function renderCube(filledFaces: number): VisualAssetSpec {
  const markPositions = [
    [110, 37],
    [88, 70],
    [133, 58],
    [89, 38],
    [147, 73]
  ];
  const marks = markPositions
    .slice(0, Math.max(0, Math.min(filledFaces, markPositions.length)))
    .map(([x, y]) => `<rect x='${x - 5}' y='${y - 5}' width='10' height='10' rx='2' fill='currentColor' fill-opacity='0.88'/>`)
    .join("");
  const inner = `
    <polygon points='62,38 110,22 164,38 116,54' fill='currentColor' fill-opacity='0.05' stroke='currentColor' stroke-width='2.5'/>
    <polygon points='62,38 62,84 116,100 116,54' fill='currentColor' fill-opacity='0.03' stroke='currentColor' stroke-width='2.5'/>
    <polygon points='116,54 116,100 164,84 164,38' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2.5'/>
    ${marks}
  `;
  return {
    kind: "cube",
    svg: wrap(frame(inner)),
    altText: `Cube drawing with ${Math.max(0, Math.min(filledFaces, markPositions.length))} marked squares on three visible faces`
  };
}

export function renderCuboid(markedFaces: number): VisualAssetSpec {
  const faceMarks = [
    [94, 35],
    [126, 38],
    [83, 74],
    [153, 61]
  ];
  const marks = faceMarks
    .slice(0, Math.max(0, Math.min(markedFaces, faceMarks.length)))
    .map(([x, y]) => `<rect x='${x - 6}' y='${y - 6}' width='12' height='12' rx='2' fill='currentColor' fill-opacity='0.86'/>`)
    .join("");
  const inner = `
    <polygon points='54,36 118,20 180,36 116,52' fill='currentColor' fill-opacity='0.05' stroke='currentColor' stroke-width='2.5'/>
    <polygon points='54,36 54,88 116,104 116,52' fill='currentColor' fill-opacity='0.03' stroke='currentColor' stroke-width='2.5'/>
    <polygon points='116,52 116,104 180,88 180,36' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2.5'/>
    ${marks}
  `;
  return {
    kind: "cube",
    svg: wrap(frame(inner)),
    altText: `Cuboid drawing with ${Math.max(0, Math.min(markedFaces, faceMarks.length))} rectangular marks on three visible faces`
  };
}

export function renderSymmetry(pattern: number[]): VisualAssetSpec {
  const left = pattern
    .map((v, row) => `<rect x='${52 + v * 16}' y='${18 + row * 16}' width='12' height='12' fill='currentColor'/>`)
    .join("");
  const axis = `<line x1='120' y1='10' x2='120' y2='110' stroke='currentColor' stroke-width='2' stroke-dasharray='4 4'/>`;
  return {
    kind: "symmetry",
    svg: wrap(`${axis}${left}`),
    altText: "Half pattern with vertical symmetry axis"
  };
}

export function renderBrokenLine(lengths: number[]): VisualAssetSpec {
  const directions = [[1, 0], [0, -1], [1, 0], [0, 1]];
  const raw: Array<[number, number]> = [[0, 0]];
  lengths.forEach((len, index) => {
    const [dx, dy] = directions[index % directions.length];
    const [x, y] = raw[raw.length - 1];
    raw.push([x + dx * len, y + dy * len]);
  });
  const xs = raw.map(([x]) => x), ys = raw.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  // One scale for both axes preserves lengths, with room for dimension labels.
  const scale = Math.min(150 / Math.max(1, width), 56 / Math.max(1, height));
  const points = raw.map(([x, y]) => [24 + (x - minX) * scale, 40 + (y - minY) * scale]);

  const dimensionLines = lengths
    .map((len, index) => {
      const [x1, y1] = points[index];
      const [x2, y2] = points[index + 1];
      if (y1 === y2) {
        const dimY = y1 - 12;
        return `
          <line x1='${x1}' y1='${dimY}' x2='${x2}' y2='${dimY}' stroke='currentColor' stroke-width='1.5'/>
          <line x1='${x1}' y1='${dimY - 5}' x2='${x1}' y2='${dimY + 5}' stroke='currentColor' stroke-width='1.5'/>
          <line x1='${x2}' y1='${dimY - 5}' x2='${x2}' y2='${dimY + 5}' stroke='currentColor' stroke-width='1.5'/>
          ${outlinedText((x1 + x2) / 2, dimY - 3, String(len), 11)}
        `;
      }
      const dimX = x1 + 14;
      return `
        <line x1='${dimX}' y1='${y1}' x2='${dimX}' y2='${y2}' stroke='currentColor' stroke-width='1.5'/>
        <line x1='${dimX - 5}' y1='${y1}' x2='${dimX + 5}' y2='${y1}' stroke='currentColor' stroke-width='1.5'/>
        <line x1='${dimX - 5}' y1='${y2}' x2='${dimX + 5}' y2='${y2}' stroke='currentColor' stroke-width='1.5'/>
        ${outlinedText(dimX + 12, (y1 + y2) / 2 + 4, String(len), 11, "start")}
      `;
    })
    .join("");

  const lastPoint = points[points.length - 1] as [number, number];
  return {
    kind: "broken_line",
    svg: wrap(
      frame(`
        <polyline points='${points.map(([x, y]) => `${x},${y}`).join(" ")}' fill='none' stroke='currentColor' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>
        <circle cx='${points[0][0]}' cy='${points[0][1]}' r='4' fill='currentColor'/>
        <circle cx='${lastPoint[0]}' cy='${lastPoint[1]}' r='4' fill='currentColor'/>
        ${dimensionLines}
      `)
    ),
    altText: `Broken line with segment lengths ${lengths.join(", ")}`
  };
}

export function renderRegionCompare(leftArea: number, rightArea: number): VisualAssetSpec {
  // Preserve the ratio exactly; rounded column counts can turn unequal areas into a tie.
  const scale = 80 / Math.max(8, leftArea, rightArea);
  const unitGrid = Math.max(leftArea, rightArea) <= 8 && Number.isInteger(leftArea) && Number.isInteger(rightArea);
  const region = (x: number, amount: number, name: string) => {
    const width = amount * scale;
    const height = unitGrid ? 3 * scale : 34;
    const grid = unitGrid
      ? Array.from({ length: Math.max(0, amount - 1) }, (_, i) => `<line x1='${x + (i + 1) * scale}' y1='40' x2='${x + (i + 1) * scale}' y2='${40 + height}' stroke='currentColor' stroke-width='1'/>`).join("")
        + [1, 2].map((row) => `<line x1='${x}' y1='${40 + row * scale}' x2='${x + width}' y2='${40 + row * scale}' stroke='currentColor' stroke-width='1'/>`).join("")
      : "";
    return `<rect data-region='${name}' x='${x}' y='40' width='${width}' height='${height}' fill='currentColor' fill-opacity='0.12' stroke='currentColor' stroke-width='2'/>${grid}${badge(x + width / 2 - 11, 84, name)}`;
  };
  return {
    kind: "region_compare",
    svg: wrap(frame(`${region(28, leftArea, "A")}${region(132, rightArea, "B")}`)),
    altText: unitGrid
      ? `Same-height regions with 3 rows of unit squares: A has ${leftArea} columns, B has ${rightArea} columns`
      : `Same-height regions: A has width ${leftArea} units and B has width ${rightArea} units`
  };
}

export function renderLessonScene(skillId: SkillId, seed: number): VisualAssetSpec {
  switch (skillId) {
    case "counting_ordering":
      return lessonScene(
        `
          ${Array.from({ length: 8 })
            .map((_, index) => `<circle cx='${26 + index * 22}' cy='54' r='8' fill='currentColor' opacity='${0.5 + ((index % 3) * 0.15)}'/>`)
            .join("")}
          ${badge(24, 82, "2 + 2 + 2 + 2")}
          ${outlinedText(168, 93, "Count in groups", 12)}
        `,
        "Counting lesson with grouped dots"
      );
    case "compare_number_region":
      return renderRegionCompare(20, 28);
    case "ordinal_numbers":
      return lessonScene(
        `
          ${Array.from({ length: 5 })
            .map(
              (_, index) => `
                <circle cx='${42 + index * 34}' cy='58' r='12' fill='${index === 2 ? "currentColor" : "none"}' fill-opacity='0.16' stroke='currentColor' stroke-width='2.5'/>
                ${outlinedText(42 + index * 34, 62, String(index + 1), 12)}
              `
            )
            .join("")}
          ${badge(98, 18, "3rd")}
          ${outlinedText(120, 98, "Count from the named side", 11)}
        `,
        "Ordinal lesson with third position highlighted"
      );
    case "place_value":
      return lessonScene(
        `
          <rect x='28' y='24' width='20' height='68' rx='4' fill='currentColor'/>
          <rect x='56' y='24' width='20' height='68' rx='4' fill='currentColor' opacity='0.85'/>
          <circle cx='116' cy='42' r='7' fill='currentColor'/>
          <circle cx='140' cy='42' r='7' fill='currentColor'/>
          <circle cx='164' cy='42' r='7' fill='currentColor'/>
          <circle cx='188' cy='42' r='7' fill='currentColor'/>
          ${svgSingleLineText(120, 104, "2 tens + 4 ones", { size: 14, minSize: 8, maxWidth: 188 })}
        `,
        "Place value lesson with tens rods and ones dots"
      );
    case "single_digit_add_sub":
      return lessonScene(
        `
          <rect x='28' y='32' width='38' height='26' rx='8' fill='none' stroke='currentColor' stroke-width='3'/>
          <rect x='84' y='32' width='38' height='26' rx='8' fill='none' stroke='currentColor' stroke-width='3'/>
          <rect x='154' y='32' width='48' height='26' rx='8' fill='none' stroke='currentColor' stroke-width='3'/>
          <text x='44' y='50' font-size='16' fill='currentColor'>3</text>
          <text x='70' y='50' font-size='16' fill='currentColor'>+</text>
          <text x='100' y='50' font-size='16' fill='currentColor'>4</text>
          <text x='136' y='50' font-size='18' fill='currentColor'>=</text>
          <text x='172' y='50' font-size='16' fill='currentColor'>7</text>
          ${svgSingleLineText(120, 96, "Make one fact", { size: 14, minSize: 8, maxWidth: 184 })}
        `,
        "Addition lesson showing two parts and total"
      );
    case "number_line":
      return lessonScene(
        `
          <line x1='28' y1='62' x2='204' y2='62' stroke='currentColor' stroke-width='3'/>
          ${[0, 1, 2, 3, 4].map((step) => `<line x1='${40 + step * 40}' y1='54' x2='${40 + step * 40}' y2='70' stroke='currentColor' stroke-width='2'/>`).join("")}
          ${[4, 5, 6, 7, 8].map((n, idx) => outlinedText(40 + idx * 40, 84, String(n), 11)).join("")}
          <path d='M80 42 C100 18, 140 18, 160 42' fill='none' stroke='currentColor' stroke-width='3'/>
          <polygon points='160,42 152,38 154,48' fill='currentColor'/>
          ${badge(98, 18, "+2")}
        `,
        "Number line lesson showing a jump of two to the right"
      );
    case "fractions_words":
      return lessonScene(
        `
          <circle cx='84' cy='56' r='28' fill='none' stroke='currentColor' stroke-width='3'/>
          <path d='M84 56 L84 28 A28 28 0 0 1 112 56 Z' fill='currentColor'/>
          <line x1='84' y1='28' x2='84' y2='84' stroke='currentColor' stroke-width='2'/>
          <line x1='56' y1='56' x2='112' y2='56' stroke='currentColor' stroke-width='2'/>
          ${svgTextBlock(164, 56, "equal parts", { size: 15, minSize: 8, maxWidth: 86, maxLines: 2 })}
        `,
        "Fraction lesson with circle split into equal parts"
      );
    case "sorting_classifying":
      return lessonScene(
        `
          <rect x='24' y='30' width='58' height='44' rx='10' fill='none' stroke='currentColor' stroke-width='2'/>
          <rect x='96' y='30' width='58' height='44' rx='10' fill='none' stroke='currentColor' stroke-width='2'/>
          <rect x='168' y='30' width='48' height='44' rx='10' fill='none' stroke='currentColor' stroke-width='2'/>
          <circle cx='40' cy='50' r='8' fill='currentColor'/>
          <circle cx='64' cy='50' r='8' fill='currentColor' opacity='0.75'/>
          <rect x='112' y='42' width='14' height='14' fill='currentColor'/>
          <rect x='132' y='42' width='14' height='14' fill='currentColor' opacity='0.75'/>
          <polygon points='188,58 198,40 208,58' fill='currentColor'/>
          ${outlinedText(122, 95, "Use one rule", 12)}
        `,
        "Sorting lesson with objects grouped by one rule"
      );
    case "measurement_small":
      return lessonScene(
        `
          <rect x='24' y='46' width='110' height='14' rx='7' fill='none' stroke='currentColor' stroke-width='2'/>
          ${Array.from({ length: 6 }).map((_, idx) => `<line x1='${34 + idx * 18}' y1='46' x2='${34 + idx * 18}' y2='62' stroke='currentColor' stroke-width='2'/>`).join("")}
          ${badge(26, 20, "cm")}
          ${badge(74, 20, "m")}
          ${badge(122, 20, "g")}
          ${badge(170, 20, "L")}
          ${outlinedText(176, 96, "Match unit to object", 11)}
        `,
        "Measurement lesson with ruler and unit badges"
      );
    case "patterns":
      return lessonScene(
        `
          <rect x='24' y='40' width='20' height='20' fill='currentColor'/>
          <rect x='58' y='32' width='28' height='28' fill='currentColor' opacity='0.85'/>
          <rect x='102' y='24' width='36' height='36' fill='currentColor' opacity='0.7'/>
          <text x='156' y='52' font-size='18' fill='currentColor'>?</text>
          ${svgSingleLineText(120, 96, "look for the rule", { size: 14, minSize: 8, maxWidth: 184 })}
        `,
        "Pattern lesson with growing blocks"
      );
    case "perimeter_broken_lines":
      return renderBrokenLine([3, 2, 4]);
    case "relative_position":
      return lessonScene(
        `
          <rect x='34' y='40' width='68' height='42' rx='8' fill='none' stroke='currentColor' stroke-width='3'/>
          <circle cx='68' cy='58' r='9' fill='currentColor'/>
          <rect x='136' y='44' width='28' height='28' rx='6' fill='none' stroke='currentColor' stroke-width='3'/>
          <polygon points='182,68 194,44 206,68' fill='currentColor'/>
          ${badge(42, 18, "inside")}
          ${badge(158, 18, "outside")}
          ${outlinedText(122, 98, "Use the clue word", 11)}
        `,
        "Relative position lesson showing one object inside and one outside"
      );
    case "shape_properties":
      return lessonScene(
        `
          <polygon points='38,72 58,38 78,72' fill='none' stroke='currentColor' stroke-width='3'/>
          <rect x='98' y='38' width='34' height='34' fill='none' stroke='currentColor' stroke-width='3'/>
          <circle cx='182' cy='56' r='18' fill='none' stroke='currentColor' stroke-width='3'/>
          ${badge(28, 18, "3 sides")}
          ${badge(96, 18, "4 equal sides")}
          ${badge(166, 18, "0 corners")}
        `,
        "Shape lesson with triangle square and circle properties"
      );
    case "maze_shape_puzzles":
      return renderMaze(seed, { leftTurns: 2, rightTurns: 1 });
    case "cube_cuboid_visualization":
      return renderCube(3);
    case "likelihood_vocabulary":
      return lessonScene(
        `
          <rect x='42' y='24' width='72' height='58' rx='14' fill='none' stroke='currentColor' stroke-width='3'/>
          ${[0, 1, 2, 3].map((idx) => `<circle cx='${62 + idx * 12}' cy='52' r='6' fill='currentColor'/>`).join("")}
          ${[0, 1].map((idx) => `<circle cx='${68 + idx * 16}' cy='68' r='6' fill='currentColor' fill-opacity='0.35'/>`).join("")}
          ${badge(138, 26, "more blue")}
          ${badge(138, 52, "likely")}
          ${badge(138, 78, "not certain")}
        `,
        "Likelihood lesson with a bag showing more blue than red marbles"
      );
    case "pictographs_bar_graphs":
      return renderPictograph([2, 4, 3], { labels: ["A", "B", "C"], valuePerIcon: 2 });
    case "venn_diagrams_easy":
      return renderVenn(2, 1, 3);
    case "calendar":
      return lessonScene(
        `
          ${["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => badge(20 + idx * 28, 22, day)).join("")}
          <rect x='52' y='54' width='22' height='22' rx='6' fill='currentColor' fill-opacity='0.14' stroke='currentColor' stroke-width='2'/>
          ${outlinedText(63, 69, "1", 11)}
          <rect x='108' y='54' width='22' height='22' rx='6' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2'/>
          ${outlinedText(119, 69, "3", 11)}
          <path d='M76 64 C84 46, 96 46, 106 64' fill='none' stroke='currentColor' stroke-width='2.5'/>
          <polygon points='106,64 100,60 101,68' fill='currentColor'/>
          ${badge(78, 84, "+2 days")}
        `,
        "Calendar lesson showing a move two days forward"
      );
    case "money_small":
      return lessonScene(
        `
          <circle cx='54' cy='54' r='18' fill='none' stroke='currentColor' stroke-width='3'/>
          <circle cx='102' cy='54' r='18' fill='none' stroke='currentColor' stroke-width='3'/>
          <circle cx='150' cy='54' r='18' fill='none' stroke='currentColor' stroke-width='3'/>
          <text x='48' y='60' font-size='14' fill='currentColor'>1</text>
          <text x='96' y='60' font-size='14' fill='currentColor'>5</text>
          <text x='141' y='60' font-size='14' fill='currentColor'>10</text>
          ${svgSingleLineText(120, 98, "count cents", { size: 14, minSize: 8, maxWidth: 184 })}
        `,
        "Money lesson with penny nickel dime values"
      );
    case "clock_full_half":
      return lessonScene(
        `
          <circle cx='86' cy='56' r='34' fill='none' stroke='currentColor' stroke-width='3'/>
          <line x1='86' y1='56' x2='86' y2='34' stroke='currentColor' stroke-width='3'/>
          <line x1='86' y1='56' x2='106' y2='56' stroke='currentColor' stroke-width='2'/>
          ${svgTextBlock(164, 48, ":00 full hour", { size: 14, minSize: 8, maxWidth: 86, maxLines: 2 })}
          ${svgTextBlock(164, 72, ":30 half hour", { size: 14, minSize: 8, maxWidth: 86, maxLines: 2 })}
        `,
        "Clock lesson with hands and full or half hour labels"
      );
    case "symmetry_rotation":
      return renderSymmetry([1, 0, 1, 0, 1]);
    case "prealgebra_balance":
      return lessonScene(
        `
          <line x1='120' y1='18' x2='120' y2='82' stroke='currentColor' stroke-width='4'/>
          <line x1='70' y1='34' x2='170' y2='34' stroke='currentColor' stroke-width='4'/>
          <rect x='54' y='40' width='28' height='20' rx='6' fill='none' stroke='currentColor' stroke-width='3'/>
          <circle cx='158' cy='50' r='9' fill='currentColor'/>
          <circle cx='180' cy='50' r='9' fill='currentColor'/>
          <text x='64' y='54' font-size='14' fill='currentColor'>?</text>
          ${svgSingleLineText(120, 100, "keep both sides equal", { size: 14, minSize: 8, maxWidth: 184 })}
        `,
        "Balance lesson with unknown on one side and counters on the other"
      );
    default:
      return lessonScene(
        `
          <rect x='24' y='28' width='192' height='52' rx='14' fill='none' stroke='currentColor' stroke-width='3'/>
          ${outlinedText(120, 50, "Spot the rule", 16)}
          ${outlinedText(120, 70, "then test it", 16)}
        `,
        "General lesson card"
      );
  }
}
