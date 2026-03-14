import type { VisualAssetSpec } from "../../domain/types";
import { escapeXml, estimateTextWidth, fitSingleLineText, fitTextBlock, svgSingleLineText, svgTextBlock } from "../../render/svgText";

const SVG_HEAD =
  "xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120' preserveAspectRatio='xMidYMid meet' shape-rendering='geometricPrecision' text-rendering='geometricPrecision'";

function svg(inner: string): string {
  return `<svg ${SVG_HEAD} role='img'>${inner}</svg>`;
}

function frame(inner: string): string {
  return `
    <rect x='8' y='8' width='224' height='104' rx='14' fill='currentColor' fill-opacity='0.045' stroke='currentColor' stroke-width='2'/>
    <g stroke='currentColor' stroke-opacity='0.12' stroke-width='1'>
      <line x1='18' y1='36' x2='222' y2='36'/>
      <line x1='18' y1='64' x2='222' y2='64'/>
      <line x1='18' y1='92' x2='222' y2='92'/>
    </g>
    ${inner}
  `;
}

function badge(x: number, y: number, text: string): string {
  const fitted = fitSingleLineText(text, 96, 9, 6.5);
  const width = Math.max(38, Math.min(108, Math.ceil(estimateTextWidth(fitted.text, fitted.fontSize) + 14)));
  return `
    <g transform='translate(${x} ${y})'>
      <rect width='${width}' height='16' rx='8' fill='currentColor' fill-opacity='0.14' stroke='currentColor' stroke-width='1.5'/>
      ${svgSingleLineText(width / 2, 11, fitted.text, { size: fitted.fontSize, minSize: 6.5, maxWidth: width - 10 })}
    </g>
  `;
}

function label(x: number, y: number, text: string, size = 11, weight = 600, anchor: "start" | "middle" | "end" = "middle", maxWidth?: number): string {
  return svgSingleLineText(x, y, text, {
    size,
    weight,
    anchor,
    maxWidth: maxWidth ?? (anchor === "middle" ? 176 : 132)
  });
}

function gridLines(x: number, y: number, cols: number, rows: number, cell: number): string {
  let out = "";
  for (let c = 0; c <= cols; c += 1) {
    out += `<line x1='${x + c * cell}' y1='${y}' x2='${x + c * cell}' y2='${y + rows * cell}' stroke='currentColor' stroke-opacity='0.18' stroke-width='1'/>`;
  }
  for (let r = 0; r <= rows; r += 1) {
    out += `<line x1='${x}' y1='${y + r * cell}' x2='${x + cols * cell}' y2='${y + r * cell}' stroke='currentColor' stroke-opacity='0.18' stroke-width='1'/>`;
  }
  return out;
}

function point(x: number, y: number, r = 3.5, opacity = 0.9): string {
  return `<circle cx='${x}' cy='${y}' r='${r}' fill='currentColor' fill-opacity='${opacity}'/>`;
}

export function lessonCard(title: string, subtitle: string, accent = "move"): VisualAssetSpec {
  return {
    kind: "lesson",
    svg: svg(
      frame(
        `${badge(20, 16, accent)}${svgTextBlock(120, 56, title, { size: 17, minSize: 10, maxWidth: 182, maxLines: 2, weight: 800 })}${svgTextBlock(120, 82, subtitle, { size: 12, minSize: 8, maxWidth: 188, maxLines: 2, weight: 500 })}`
      )
    ),
    altText: `${title}. ${subtitle}`
  };
}

export function fractionBarVisual(parts: number, shaded: number, labelText: string): VisualAssetSpec {
  const safeShaded = Math.max(0, Math.min(parts, shaded));
  const cells = Array.from({ length: parts })
    .map((_, index) =>
      `<rect x='${24 + index * (180 / parts)}' y='44' width='${180 / parts - 2}' height='24' rx='4' fill='currentColor' fill-opacity='${index < safeShaded ? 0.78 : 0.08}' stroke='currentColor' stroke-width='1.2'/>`
    )
    .join("");
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, labelText)}${cells}${svgTextBlock(120, 94, `${safeShaded} of ${parts} equal parts`, { size: 13, minSize: 8.5, maxWidth: 184, maxLines: 2, weight: 500 })}`)),
    altText: `${safeShaded} of ${parts} equal parts shaded`
  };
}

export function coordinateVisual(points: Array<{ x: number; y: number; label?: string }>, highlight?: number, segments: number[] = []): VisualAssetSpec {
  const plotLeft = 44;
  const plotBottom = 88;
  const plotWidth = 156;
  const plotHeight = 60;
  const maxX = Math.max(4, ...points.map((pt) => pt.x));
  const maxY = Math.max(4, ...points.map((pt) => pt.y));
  const xStep = plotWidth / maxX;
  const yStep = plotHeight / maxY;
  const toX = (x: number) => plotLeft + x * xStep;
  const toY = (y: number) => plotBottom - y * yStep;
  const pointSvg = points
    .map((pt, index) => {
      const px = toX(pt.x);
      const py = toY(pt.y);
      const labelY = py < 30 ? py + 14 : py - 7;
      const labelAnchor = px > 178 ? "end" : "start";
      const labelX = labelAnchor === "end" ? px - 7 : px + 7;
      return `
        ${point(px, py, index === highlight ? 5 : 4, index === highlight ? 0.95 : 0.72)}
        ${pt.label ? label(labelX, labelY, pt.label, 10, 600, labelAnchor, 28) : ""}
      `;
    })
    .join("");
  const pathSvg = segments.length
    ? segments
        .map((segmentIndex, idx) => {
          const a = points[segmentIndex];
          const b = points[segmentIndex + 1];
          if (!a || !b) return "";
          const dash = idx === segments.length - 1 ? "" : "stroke-dasharray='4 3'";
          return `<line x1='${toX(a.x)}' y1='${toY(a.y)}' x2='${toX(b.x)}' y2='${toY(b.y)}' stroke='currentColor' stroke-width='2' ${dash}/>`;
        })
        .join("")
    : "";
  return {
    kind: "graph",
    svg: svg(
      frame(`
        <line x1='30' y1='92' x2='206' y2='92' stroke='currentColor' stroke-width='2'/>
        <line x1='42' y1='20' x2='42' y2='102' stroke='currentColor' stroke-width='2'/>
        ${Array.from({ length: maxX + 1 }).map((_, i) => `<line x1='${toX(i)}' y1='88' x2='${toX(i)}' y2='96' stroke='currentColor' stroke-width='1.2'/>`).join("")}
        ${Array.from({ length: maxY + 1 }).map((_, i) => `<line x1='38' y1='${toY(i)}' x2='46' y2='${toY(i)}' stroke='currentColor' stroke-width='1.2'/>`).join("")}
        ${pathSvg}
        ${pointSvg}
      `)
    ),
    altText: `Coordinate grid with ${points.length} plotted points`
  };
}

export function angleVisual(a: number, b: number, c: number, caption: string): VisualAssetSpec {
  return {
    kind: "geometry",
    svg: svg(
      frame(`
        <polygon points='52,84 116,30 188,84' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2.3'/>
        ${label(58, 96, `${a}°`, 12, 600)}
        ${label(116, 24, `${b}°`, 12, 600)}
        ${label(184, 96, `${c}°`, 12, 600)}
        ${badge(72, 14, caption)}
      `)
    ),
    altText: `Triangle angle visual labelled ${a}, ${b}, and ${c} degrees`
  };
}

export function netVisual(faceCount: number, caption: string): VisualAssetSpec {
  const faces = Array.from({ length: faceCount })
    .map((_, index) => {
      const x = 54 + (index % 3) * 26;
      const y = 36 + Math.floor(index / 3) * 26;
      return `<rect x='${x}' y='${y}' width='24' height='24' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='1.8'/>`;
    })
    .join("");
  return {
    kind: "cube",
    svg: svg(frame(`${faces}${badge(20, 16, caption)}`)),
    altText: `${caption} net visual`
  };
}

export function formulaVisual(lines: string[], badgeText = "rule"): VisualAssetSpec {
  let currentTop = 38;
  const top = lines
    .slice(0, 3)
    .map((line, index) => {
      const preferredSize = index === 0 ? 14 : 12;
      const fitted = fitTextBlock(line, 186, preferredSize, {
        minSize: index === 0 ? 8.5 : 8,
        maxLines: 2
      });
      const lineHeight = Math.round(fitted.fontSize * 1.2 * 10) / 10;
      const block = `<text x='120' y='${currentTop}' dominant-baseline='hanging' text-anchor='middle' font-size='${fitted.fontSize}' font-weight='${index === 0 ? 700 : 500}' fill='currentColor'>${fitted.lines
        .map((fitLine, lineIndex) => `<tspan x='120' y='${currentTop + lineIndex * lineHeight}'>${escapeXml(fitLine)}</tspan>`)
        .join("")}</text>`;
      currentTop += Math.max(fitted.fontSize, (fitted.lines.length - 1) * lineHeight + fitted.fontSize) + 4;
      return block;
    })
    .join("");
  return {
    kind: "formula",
    svg: svg(frame(`${badge(20, 16, badgeText)}${top}`)),
    altText: lines.join(". ")
  };
}

export function balanceVisual(left: string, right: string, caption: string): VisualAssetSpec {
  return {
    kind: "balance",
    svg: svg(
      frame(`
        <line x1='120' y1='24' x2='120' y2='46' stroke='currentColor' stroke-width='3'/>
        <line x1='72' y1='46' x2='168' y2='46' stroke='currentColor' stroke-width='3'/>
        <line x1='88' y1='46' x2='80' y2='82' stroke='currentColor' stroke-width='2'/>
        <line x1='152' y1='46' x2='160' y2='82' stroke='currentColor' stroke-width='2'/>
        <rect x='60' y='82' width='36' height='8' rx='4' fill='currentColor' fill-opacity='0.2'/>
        <rect x='144' y='82' width='36' height='8' rx='4' fill='currentColor' fill-opacity='0.2'/>
        ${label(78, 74, left, 15, 700)}
        ${label(156, 74, right, 15, 700)}
        ${badge(18, 16, caption)}
      `)
    ),
    altText: `Balance model showing ${left} equals ${right}`
  };
}

export function placeValueVisual(number: number, caption: string): VisualAssetSpec {
  const hundreds = Math.floor(number / 100);
  const tens = Math.floor((number % 100) / 10);
  const ones = number % 10;
  const hundredBlocks = Array.from({ length: Math.min(4, hundreds) })
    .map((_, index) => `<rect x='${28 + index * 18}' y='40' width='14' height='14' fill='currentColor' fill-opacity='0.16' stroke='currentColor' stroke-width='1.2'/>`)
    .join("");
  const tenRods = Array.from({ length: Math.min(6, tens) })
    .map((_, index) => `<rect x='${120 + index * 10}' y='38' width='8' height='30' rx='3' fill='currentColor' fill-opacity='0.22'/>`)
    .join("");
  const oneDots = Array.from({ length: Math.min(9, ones) })
    .map((_, index) => point(58 + (index % 3) * 12, 86 + Math.floor(index / 3) * 10, 3.2, 0.82))
    .join("");
  return {
    kind: "lesson",
    svg: svg(
      frame(`
        ${badge(20, 16, caption)}
        ${hundredBlocks}
        ${tenRods}
        ${oneDots}
        ${label(58, 34, `${hundreds} hundreds`, 10, 700)}
        ${label(148, 34, `${tens} tens`, 10, 700)}
        ${label(74, 80, `${ones} ones`, 10, 700)}
        ${label(188, 82, `${number}`, 18, 800)}
      `)
    ),
    altText: `Place value model for ${number}`
  };
}

export function arrayGroupsVisual(rows: number, cols: number, extra: number, caption: string): VisualAssetSpec {
  const circles: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      circles.push(point(46 + c * 18, 44 + r * 18, 5, 0.82));
    }
  }
  for (let i = 0; i < extra; i += 1) {
    circles.push(point(170 + (i % 3) * 16, 44 + Math.floor(i / 3) * 18, 5, 0.5));
  }
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, caption)}${circles.join("")}${label(84, 98, `${rows} groups of ${cols}`, 12, 700)}${extra ? label(184, 98, `${extra} extra`, 12, 700) : ""}`)),
    altText: `${rows} rows of ${cols} with ${extra} extra objects`
  };
}

export function clockVisual(hour: number, minute: number, caption: string): VisualAssetSpec {
  const cx = 74;
  const cy = 64;
  const radius = 28;
  const hourAngle = ((hour % 12) + minute / 60) * 30 - 90;
  const minuteAngle = minute * 6 - 90;
  const hand = (angle: number, length: number, width: number) => {
    const x = cx + Math.cos((angle * Math.PI) / 180) * length;
    const y = cy + Math.sin((angle * Math.PI) / 180) * length;
    return `<line x1='${cx}' y1='${cy}' x2='${x}' y2='${y}' stroke='currentColor' stroke-width='${width}' stroke-linecap='round'/>`;
  };
  return {
    kind: "lesson",
    svg: svg(
      frame(`
        ${badge(20, 16, caption)}
        <circle cx='${cx}' cy='${cy}' r='${radius}' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2'/>
        ${Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * Math.PI / 180;
          const x1 = cx + Math.cos(angle) * 22;
          const y1 = cy + Math.sin(angle) * 22;
          const x2 = cx + Math.cos(angle) * 26;
          const y2 = cy + Math.sin(angle) * 26;
          return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='currentColor' stroke-width='1.3'/>`;
        }).join("")}
        ${hand(hourAngle, 14, 3)}
        ${hand(minuteAngle, 21, 2)}
        <circle cx='${cx}' cy='${cy}' r='3' fill='currentColor'/>
        ${label(168, 52, `Time`, 12, 700)}
        ${label(168, 72, `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`, 18, 800)}
      `)
    ),
    altText: `Clock showing ${hour}:${minute.toString().padStart(2, "0")}`
  };
}

export function barChartVisual(values: number[], labelsText: string[], caption: string): VisualAssetSpec {
  const maxValue = Math.max(...values, 1);
  const bars = values
    .map((value, index) => {
      const height = (value / maxValue) * 42;
      const x = 48 + index * 42;
      const y = 88 - height;
      return `
        <rect x='${x}' y='${y}' width='24' height='${height}' rx='4' fill='currentColor' fill-opacity='${0.22 + index * 0.14}'/>
        ${label(x + 12, 102, labelsText[index] || `${index + 1}`, 10, 700)}
        ${label(x + 12, y - 4, String(value), 10, 700)}
      `;
    })
    .join("");
  return {
    kind: "graph",
    svg: svg(frame(`${badge(20, 16, caption)}<line x1='34' y1='88' x2='208' y2='88' stroke='currentColor' stroke-width='2'/>${bars}`)),
    altText: `${caption} bar chart`
  };
}

export function sequenceTableVisual(values: number[], caption: string): VisualAssetSpec {
  const cols = values.length;
  const x = 32;
  const y = 42;
  const cell = Math.min(30, 168 / cols);
  const cells = values
    .map((value, index) => `
      <rect x='${x + index * cell}' y='${y}' width='${cell}' height='28' fill='currentColor' fill-opacity='${index === cols - 1 ? 0.18 : 0.08}' stroke='currentColor' stroke-width='1.4'/>
      ${label(x + index * cell + cell / 2, y + 18, String(value), 12, 700)}
      ${label(x + index * cell + cell / 2, y - 6, `#${index + 1}`, 9, 700)}
    `)
    .join("");
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, caption)}${cells}`)),
    altText: `${caption} sequence ${values.join(", ")}`
  };
}

export function doubleNumberLineVisual(leftLabel: string, rightLabel: string, leftValues: number[], rightValues: number[], caption: string): VisualAssetSpec {
  const step = 42;
  const start = 44;
  const ticks = leftValues
    .map((value, index) => `
      <line x1='${start + index * step}' y1='42' x2='${start + index * step}' y2='82' stroke='currentColor' stroke-opacity='0.25' stroke-width='1.2'/>
      ${label(start + index * step, 34, String(value), 11, 700)}
      ${label(start + index * step, 96, String(rightValues[index]), 11, 700)}
    `)
    .join("");
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, caption)}<line x1='36' y1='48' x2='204' y2='48' stroke='currentColor' stroke-width='2'/><line x1='36' y1='76' x2='204' y2='76' stroke='currentColor' stroke-width='2'/>${label(26, 52, leftLabel, 10, 700, "start")}${label(26, 80, rightLabel, 10, 700, "start")}${ticks}`)),
    altText: `${caption} double number line`
  };
}

export function functionMachineVisual(input: number, output: number, rule: string, caption: string): VisualAssetSpec {
  return {
    kind: "formula",
    svg: svg(
      frame(`
        ${badge(20, 16, caption)}
        <rect x='86' y='40' width='68' height='34' rx='12' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2'/>
        <line x1='42' y1='57' x2='86' y2='57' stroke='currentColor' stroke-width='2'/>
        <line x1='154' y1='57' x2='198' y2='57' stroke='currentColor' stroke-width='2'/>
        <polygon points='192,52 200,57 192,62' fill='currentColor'/>
        ${label(64, 52, `in ${input}`, 12, 700)}
        ${label(120, 60, rule, 13, 800)}
        ${label(176, 52, `out ${output}`, 12, 700)}
      `)
    ),
    altText: `Function machine showing ${rule} from ${input} to ${output}`
  };
}

export function areaGridVisual(width: number, height: number, caption: string): VisualAssetSpec {
  const cell = Math.min(16, Math.floor(84 / Math.max(width, height)));
  const startX = 58;
  const startY = 34;
  return {
    kind: "geometry",
    svg: svg(frame(`${badge(20, 16, caption)}${gridLines(startX, startY, width, height, cell)}<rect x='${startX}' y='${startY}' width='${width * cell}' height='${height * cell}' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2'/>${label(startX + (width * cell) / 2, startY + height * cell + 16, `${width} units`, 11, 700)}${label(startX + width * cell + 18, startY + (height * cell) / 2 + 4, `${height}`, 11, 700)}`)),
    altText: `Area grid ${width} by ${height}`
  };
}

export function prismVisual(length: number, width: number, height: number, caption: string): VisualAssetSpec {
  const frontX = 72;
  const frontY = 48;
  const scale = 8;
  const l = length * scale;
  const h = height * scale;
  const dx = width * 4;
  const dy = width * 3;
  return {
    kind: "geometry",
    svg: svg(frame(`${badge(20, 16, caption)}<rect x='${frontX}' y='${frontY}' width='${l}' height='${h}' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='2'/><polygon points='${frontX},${frontY} ${frontX + dx},${frontY - dy} ${frontX + l + dx},${frontY - dy} ${frontX + l},${frontY}' fill='currentColor' fill-opacity='0.05' stroke='currentColor' stroke-width='2'/><polygon points='${frontX + l},${frontY} ${frontX + l + dx},${frontY - dy} ${frontX + l + dx},${frontY + h - dy} ${frontX + l},${frontY + h}' fill='currentColor' fill-opacity='0.11' stroke='currentColor' stroke-width='2'/>${label(frontX + l / 2, frontY + h + 14, `${length}`, 11, 700)}${label(frontX + l + 18, frontY + h / 2 + 4, `${height}`, 11, 700)}${label(frontX + l + dx / 2, frontY - dy - 4, `${width}`, 11, 700)}`)),
    altText: `Rectangular prism ${length} by ${width} by ${height}`
  };
}

export function integerChipVisual(positives: number, negatives: number, caption: string): VisualAssetSpec {
  const chips: string[] = [];
  for (let i = 0; i < positives; i += 1) {
    const x = 42 + (i % 5) * 20;
    const y = 46 + Math.floor(i / 5) * 20;
    chips.push(`<circle cx='${x}' cy='${y}' r='8' fill='currentColor' fill-opacity='0.18' stroke='currentColor' stroke-width='1.5'/>${label(x, y + 4, "+", 12, 800)}`);
  }
  for (let i = 0; i < negatives; i += 1) {
    const x = 144 + (i % 5) * 20;
    const y = 46 + Math.floor(i / 5) * 20;
    chips.push(`<circle cx='${x}' cy='${y}' r='8' fill='currentColor' fill-opacity='0.08' stroke='currentColor' stroke-width='1.5'/>${label(x, y + 4, "−", 12, 800)}`);
  }
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, caption)}${chips.join("")}${label(72, 94, `+ ${positives}`, 11, 700)}${label(174, 94, `− ${negatives}`, 11, 700)}`)),
    altText: `Integer chips with ${positives} positives and ${negatives} negatives`
  };
}

export function similarityVisual(scale: number, caption: string): VisualAssetSpec {
  const small = `52,86 84,36 112,86`;
  const large = `132,92 ${132 + 36 * scale},${92 - 56 * scale / 2} ${132 + 70 * scale},92`;
  return {
    kind: "geometry",
    svg: svg(frame(`${badge(20, 16, caption)}<polygon points='${small}' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2'/><polygon points='${large}' fill='currentColor' fill-opacity='0.1' stroke='currentColor' stroke-width='2'/>${svgSingleLineText(82, 100, "1x", { size: 11, maxWidth: 36 })}${svgSingleLineText(176, 100, `${scale}x`, { size: 11, maxWidth: 44 })}`)),
    altText: `Similar triangles scaled by ${scale}`
  };
}

export function treeVisual(branches: string[][], caption: string): VisualAssetSpec {
  const roots = [44, 120, 196];
  const branchSvg: string[] = [];
  const leafLabels: string[] = [];
  roots.forEach((rootX, column) => {
    branchSvg.push(point(rootX, 34, 4.5, 0.9));
    const options = branches[column] || [];
    options.forEach((entry, idx) => {
      const x = rootX + (idx - (options.length - 1) / 2) * 22;
      const y = 80;
      branchSvg.push(`<line x1='${rootX}' y1='36' x2='${x}' y2='${y - 8}' stroke='currentColor' stroke-width='1.8'/>`);
      branchSvg.push(point(x, y, 4, 0.75));
      leafLabels.push(label(x, y + 15, entry, 9, 700));
    });
  });
  return {
    kind: "graph",
    svg: svg(frame(`${badge(20, 16, caption)}${branchSvg.join("")}${leafLabels.join("")}`)),
    altText: `${caption} tree diagram`
  };
}

export function probabilityGridVisual(rows: number, cols: number, highlighted: Array<[number, number]>, caption: string): VisualAssetSpec {
  const cell = 16;
  const startX = 70;
  const startY = 28;
  const highlightedSet = new Set(highlighted.map(([r, c]) => `${r}:${c}`));
  const cells = Array.from({ length: rows * cols }).map((_, index) => {
    const r = Math.floor(index / cols);
    const c = index % cols;
    const on = highlightedSet.has(`${r}:${c}`);
    return `<rect x='${startX + c * cell}' y='${startY + r * cell}' width='${cell - 2}' height='${cell - 2}' rx='3' fill='currentColor' fill-opacity='${on ? 0.7 : 0.08}' stroke='currentColor' stroke-width='1'/>`;
  }).join("");
  return {
    kind: "graph",
    svg: svg(frame(`${badge(20, 16, caption)}${cells}${label(120, 102, `${highlighted.length} favorable out of ${rows * cols}`, 11, 700)}`)),
    altText: `${caption} grid with ${highlighted.length} favorable outcomes`
  };
}

export function setDiagramVisual(leftOnly: number, both: number, rightOnly: number, caption: string): VisualAssetSpec {
  return {
    kind: "lesson",
    svg: svg(
      frame(`
        ${badge(20, 16, caption)}
        <circle cx='96' cy='62' r='28' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2'/>
        <circle cx='144' cy='62' r='28' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2'/>
        ${label(80, 34, "A", 11, 800)}
        ${label(160, 34, "B", 11, 800)}
        ${label(80, 66, String(leftOnly), 14, 800)}
        ${label(120, 66, String(both), 14, 800)}
        ${label(160, 66, String(rightOnly), 14, 800)}
      `)
    ),
    altText: `Set diagram with ${leftOnly} in A only, ${both} in both, and ${rightOnly} in B only`
  };
}

export function systemGraphVisual(slope1: number, intercept1: number, slope2: number, intercept2: number, caption: string): VisualAssetSpec {
  const toX = (x: number) => 44 + x * 16;
  const toY = (y: number) => 88 - y * 10;
  const line = (m: number, b: number, opacity: number) => {
    const x1 = 0;
    const x2 = 9;
    const y1 = m * x1 + b;
    const y2 = m * x2 + b;
    return `<line x1='${toX(x1)}' y1='${toY(y1)}' x2='${toX(x2)}' y2='${toY(y2)}' stroke='currentColor' stroke-width='2.2' stroke-opacity='${opacity}'/>`;
  };
  const ix = (intercept2 - intercept1) / (slope1 - slope2);
  const iy = slope1 * ix + intercept1;
  return {
    kind: "graph",
    svg: svg(frame(`<line x1='30' y1='88' x2='206' y2='88' stroke='currentColor' stroke-width='2'/><line x1='44' y1='20' x2='44' y2='102' stroke='currentColor' stroke-width='2'/>${line(slope1, intercept1, 0.9)}${line(slope2, intercept2, 0.45)}${point(toX(ix), toY(iy), 5, 0.95)}${badge(20, 16, caption)}`)),
    altText: `System graph with intersection at ${ix.toFixed(1)}, ${iy.toFixed(1)}`
  };
}

export function parabolaVisual(a: number, h: number, k: number, caption: string): VisualAssetSpec {
  const toX = (x: number) => 44 + x * 16;
  const toY = (y: number) => 88 - y * 8;
  const path = Array.from({ length: 121 }).map((_, index) => {
    const x = index / 12;
    const y = a * (x - h) ** 2 + k;
    return `${index === 0 ? "M" : "L"}${toX(x)} ${toY(y)}`;
  }).join(" ");
  return {
    kind: "graph",
    svg: svg(frame(`<line x1='30' y1='88' x2='206' y2='88' stroke='currentColor' stroke-width='2'/><line x1='44' y1='20' x2='44' y2='102' stroke='currentColor' stroke-width='2'/><path d='${path}' fill='none' stroke='currentColor' stroke-width='2.3'/><circle cx='${toX(h)}' cy='${toY(k)}' r='4.5' fill='currentColor'/>${svgSingleLineText(toX(h) + 24, toY(k) - 8, "vertex", { size: 10, anchor: "start", maxWidth: 54 })}${badge(20, 16, caption)}`)),
    altText: `Parabola with vertex at ${h}, ${k}`
  };
}

export function modularClockVisual(modulus: number, value: number, caption: string): VisualAssetSpec {
  const cx = 120;
  const cy = 62;
  const r = 34;
  const nodes = Array.from({ length: modulus }).map((_, index) => {
    const angle = (-90 + (360 / modulus) * index) * Math.PI / 180;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const active = index === ((value % modulus) + modulus) % modulus;
    return `<circle cx='${x}' cy='${y}' r='${active ? 7 : 5}' fill='currentColor' fill-opacity='${active ? 0.82 : 0.12}' stroke='currentColor' stroke-width='1.2'/>${label(x, y + 4, String(index), 9, 700)}`;
  }).join("");
  return {
    kind: "graph",
    svg: svg(frame(`${badge(20, 16, caption)}${nodes}${label(120, 104, `${value} mod ${modulus}`, 12, 700)}`)),
    altText: `Modular clock for ${value} mod ${modulus}`
  };
}

export function polynomialRootsVisual(r1: number, r2: number, caption: string): VisualAssetSpec {
  const toX = (x: number) => 44 + x * 18;
  return {
    kind: "formula",
    svg: svg(frame(`<line x1='30' y1='74' x2='210' y2='74' stroke='currentColor' stroke-width='2'/><line x1='44' y1='28' x2='44' y2='98' stroke='currentColor' stroke-width='2'/><path d='M${toX(1)} 42 Q ${toX((r1 + r2) / 2)} 8 ${toX(9)} 42' fill='none' stroke='currentColor' stroke-width='2.2'/><circle cx='${toX(r1)}' cy='74' r='4.5' fill='currentColor'/><circle cx='${toX(r2)}' cy='74' r='4.5' fill='currentColor'/>${svgSingleLineText(toX(r1), 92, String(r1), { size: 10, maxWidth: 24 })}${svgSingleLineText(toX(r2), 92, String(r2), { size: 10, maxWidth: 24 })}${badge(20, 16, caption)}`)),
    altText: `Quadratic roots at ${r1} and ${r2}`
  };
}

export function transformGraphVisual(shiftX: number, shiftY: number, stretch: number, caption: string): VisualAssetSpec {
  const toX = (x: number) => 44 + x * 18;
  const toY = (y: number) => 86 - y * 9;
  const linePath = (offsetX: number, offsetY: number, factor: number, opacity: number) => {
    const path = Array.from({ length: 61 }).map((_, idx) => {
      const x = idx / 10;
      const y = factor * ((x - offsetX) ** 2) / 4 + offsetY;
      return `${idx === 0 ? "M" : "L"}${toX(x)} ${toY(y)}`;
    }).join(" ");
    return `<path d='${path}' fill='none' stroke='currentColor' stroke-opacity='${opacity}' stroke-width='2.1'/>`;
  };
  return {
    kind: "graph",
    svg: svg(frame(`<line x1='30' y1='86' x2='210' y2='86' stroke='currentColor' stroke-width='2'/><line x1='44' y1='22' x2='44' y2='100' stroke='currentColor' stroke-width='2'/>${linePath(3, 0, 1, 0.35)}${linePath(3 + shiftX, shiftY, stretch, 0.92)}${badge(20, 16, caption)}`)),
    altText: `Function transformation with horizontal shift ${shiftX}, vertical shift ${shiftY}, and stretch ${stretch}`
  };
}

export function trigTriangleVisual(adjacent: number, opposite: number, caption: string): VisualAssetSpec {
  const hypotenuse = Math.sqrt(adjacent * adjacent + opposite * opposite);
  return {
    kind: "geometry",
    svg: svg(frame(`${badge(20, 16, caption)}<polygon points='64,90 64,42 170,90' fill='currentColor' fill-opacity='0.06' stroke='currentColor' stroke-width='2.3'/><rect x='64' y='80' width='10' height='10' fill='none' stroke='currentColor' stroke-width='2'/>${svgSingleLineText(112, 102, `adj ${adjacent}`, { size: 11, maxWidth: 58 })}${svgSingleLineText(46, 68, `opp ${opposite}`, { size: 11, anchor: "start", maxWidth: 44 })}${svgSingleLineText(138, 58, `hyp ${hypotenuse.toFixed(1)}`, { size: 11, maxWidth: 64 })}`)),
    altText: `Right triangle with adjacent ${adjacent}, opposite ${opposite}, hypotenuse ${hypotenuse.toFixed(1)}`
  };
}

export function eliminationBoardVisual(labelsText: string[], eliminated: number[], caption: string): VisualAssetSpec {
  const eliminatedSet = new Set(eliminated);
  const cards = labelsText.slice(0, 4).map((entry, index) => {
    const x = 32 + (index % 2) * 90;
    const y = 38 + Math.floor(index / 2) * 32;
    const crossed = eliminatedSet.has(index);
    return `<rect x='${x}' y='${y}' width='76' height='24' rx='8' fill='currentColor' fill-opacity='${crossed ? 0.06 : 0.14}' stroke='currentColor' stroke-width='1.6'/>${label(x + 38, y + 16, entry, 11, 700)}${crossed ? `<line x1='${x + 10}' y1='${y + 5}' x2='${x + 66}' y2='${y + 19}' stroke='currentColor' stroke-width='2'/><line x1='${x + 66}' y1='${y + 5}' x2='${x + 10}' y2='${y + 19}' stroke='currentColor' stroke-width='2'/>` : ""}`;
  }).join("");
  return {
    kind: "lesson",
    svg: svg(frame(`${badge(20, 16, caption)}${cards}`)),
    altText: `${caption} elimination board`
  };
}

export function circleGeometryVisual(radius: number, angle: number, caption: string): VisualAssetSpec {
  const cx = 120;
  const cy = 64;
  const r = 32;
  const px = cx + Math.cos((angle - 90) * Math.PI / 180) * r;
  const py = cy + Math.sin((angle - 90) * Math.PI / 180) * r;
  return {
    kind: "geometry",
    svg: svg(frame(`${badge(20, 16, caption)}<circle cx='${cx}' cy='${cy}' r='${r}' fill='currentColor' fill-opacity='0.05' stroke='currentColor' stroke-width='2'/><line x1='${cx}' y1='${cy}' x2='${px}' y2='${py}' stroke='currentColor' stroke-width='2'/><line x1='${cx}' y1='${cy}' x2='${cx + r}' y2='${cy}' stroke='currentColor' stroke-width='2' stroke-opacity='0.5'/><path d='M ${cx + 12} ${cy} A 12 12 0 0 1 ${cx + Math.cos((angle - 90) * Math.PI / 180) * 12} ${cy + Math.sin((angle - 90) * Math.PI / 180) * 12}' fill='none' stroke='currentColor' stroke-width='1.5'/>${svgSingleLineText(cx + 22, cy - 6, `${angle}°`, { size: 10, anchor: "start", maxWidth: 32 })}${svgSingleLineText(cx + r + 12, cy + 4, `r=${radius}`, { size: 10, anchor: "start", maxWidth: 40 })}`)),
    altText: `Circle geometry visual radius ${radius} angle ${angle}`
  };
}
