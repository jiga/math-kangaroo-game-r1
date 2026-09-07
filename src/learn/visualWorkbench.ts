import type { Grade, VisualAssetSpec } from "../domain/types";

export type WorkbenchTool = "picture" | "counters" | "fractions" | "balance" | "graph";
export type WorkbenchContext = {
  id: string;
  grade: Grade;
  prompt: string;
  skillId: string;
  visual?: VisualAssetSpec;
};

export type WorkbenchState = {
  context: WorkbenchContext;
  tool: WorkbenchTool;
  counters: number;
  crossed: number[];
  parts: number;
  shaded: number[];
  left: number;
  right: number;
  slope: number;
  intercept: number;
};

export type WorkbenchParameter = "counters" | "parts" | "left" | "right" | "slope" | "intercept";
export type WorkbenchAction =
  | { type: "tool"; tool: WorkbenchTool }
  | { type: "set"; parameter: WorkbenchParameter; value: number }
  | { type: "adjust"; parameter: WorkbenchParameter; delta: number }
  | { type: "counter"; index: number }
  | { type: "shade"; index: number }
  | { type: "reset" };

const INK = "#f2f7ff";
const MINT = "#7ee7c1";
const GOLD = "#ffd479";

export function availableWorkbenchTools(context: WorkbenchContext): WorkbenchTool[] {
  const tools: WorkbenchTool[] = ["picture", "counters", "fractions", "balance"];
  if (context.grade >= 3) tools.push("graph");
  return tools;
}

function defaultTool(context: WorkbenchContext): WorkbenchTool {
  if (context.visual?.svg.trim()) return "picture";
  const skill = context.skillId.toLowerCase();
  if (/fraction|ratio|percent|decimal/.test(skill)) return "fractions";
  if (context.grade >= 3 && /coordinate|analytic_geometry|function|linear/.test(skill)) return "graph";
  if (/balance|equation|algebra|inequal|compare_number/.test(skill)) return "balance";
  if (/count|add_sub|arithmetic|multiplication|division|place_value|ordinal|number_line|money/.test(skill)) return "counters";
  return "picture";
}

export function createWorkbench(context: WorkbenchContext): WorkbenchState {
  return {
    context: { ...context, ...(context.visual ? { visual: { ...context.visual } } : {}) },
    tool: defaultTool(context),
    counters: 0,
    crossed: [],
    parts: 2,
    shaded: [],
    left: 0,
    right: 0,
    slope: 0,
    intercept: 0
  };
}

function toggle(indices: number[], index: number, count: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= count) return indices;
  return indices.includes(index)
    ? indices.filter((value) => value !== index)
    : [...indices, index].sort((a, b) => a - b);
}

function setParameter(state: WorkbenchState, parameter: WorkbenchParameter, input: number): WorkbenchState {
  if (!Number.isFinite(input)) return state;
  const minimum = parameter === "parts" ? 2 : parameter === "slope" || parameter === "intercept" ? -5 : 0;
  const maximum = parameter === "parts" ? (state.context.grade <= 2 ? 4 : 12)
    : parameter === "counters" ? 30 : parameter === "slope" || parameter === "intercept" ? 5 : 20;
  const value = Math.max(minimum, Math.min(maximum, Math.trunc(input)));
  if (state[parameter] === value) return state;
  const next = { ...state, [parameter]: value };
  if (parameter === "counters") next.crossed = state.crossed.filter((index) => index < value);
  // A new partition changes every cell's meaning; don't carry over old shading.
  if (parameter === "parts") next.shaded = [];
  return next;
}

/** Pure reducer. Invalid taps/non-finite values are ignored; reset clears only the active tool. */
export function updateWorkbench(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "tool":
      return availableWorkbenchTools(state.context).includes(action.tool) ? { ...state, tool: action.tool } : state;
    case "set":
      return setParameter(state, action.parameter, action.value);
    case "adjust":
      return Number.isFinite(action.delta)
        ? setParameter(state, action.parameter, state[action.parameter] + Math.trunc(action.delta)) : state;
    case "counter":
      return { ...state, crossed: toggle(state.crossed, action.index, state.counters) };
    case "shade":
      return { ...state, shaded: toggle(state.shaded, action.index, state.parts) };
    case "reset":
      switch (state.tool) {
        case "picture": return { ...state };
        case "counters": return { ...state, counters: 0, crossed: [] };
        case "fractions": return { ...state, parts: 2, shaded: [] };
        case "balance": return { ...state, left: 0, right: 0 };
        case "graph": return { ...state, slope: 0, intercept: 0 };
      }
  }
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function text(x: number, y: number, value: string, size = 12, anchor = "middle"): string {
  return `<text x='${x}' y='${y}' text-anchor='${anchor}' font-size='${size}' fill='${INK}'>${escapeXml(value)}</text>`;
}

function wrap(inner: string, caption: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='140' viewBox='0 0 240 140' color='${INK}' fill='${INK}' role='group' aria-label='${escapeXml(caption)}'>${inner}</svg>`;
}

function drawingGrid(): string {
  return Array.from({ length: 11 }, (_, i) => {
    const x = 20 + i * 20;
    return `<line x1='${x}' y1='10' x2='${x}' y2='130'/>`;
  }).join("") + Array.from({ length: 7 }, (_, i) => {
    const y = 10 + i * 20;
    return `<line x1='20' y1='${y}' x2='220' y2='${y}'/>`;
  }).join("");
}

function renderCounters(state: WorkbenchState): string {
  const columns = state.counters <= 20 ? 5 : 6;
  const spacing = state.counters <= 10 ? 42 : state.counters <= 20 ? 22 : 18;
  const hitHeight = state.counters <= 10 ? 36 : spacing;
  return text(120, 20, `${state.counters} counters`) + Array.from({ length: state.counters }, (_, index) => {
    const x = 24 + (index % columns) * (columns === 5 ? 48 : 38);
    const y = 42 + Math.floor(index / columns) * spacing;
    const crossed = state.crossed.includes(index);
    return `<g data-aid-counter='${index}' data-crossed='${crossed}' role='button' tabindex='0' aria-pressed='${crossed}' aria-label='Counter ${index + 1}: ${crossed ? "crossed out" : "remaining"}'>
      <rect x='${x - 17}' y='${y - hitHeight / 2}' width='34' height='${hitHeight}' fill='${INK}' fill-opacity='0'/>
      <circle cx='${x}' cy='${y}' r='8' fill='${crossed ? "none" : MINT}' stroke='${crossed ? GOLD : INK}' stroke-width='1.5'/>
      ${crossed ? `<path d='M ${x - 6} ${y - 6} L ${x + 6} ${y + 6} M ${x + 6} ${y - 6} L ${x - 6} ${y + 6}' stroke='${GOLD}' stroke-width='2.5'/>` : ""}
    </g>`;
  }).join("") + text(120, 130, `${state.crossed.length} crossed; ${state.counters - state.crossed.length} remaining`, 11);
}

function renderFractions(state: WorkbenchState): string {
  // Every cell is an equal-width strip of the same whole, including prime partitions.
  const width = 216 / state.parts;
  return Array.from({ length: state.parts }, (_, index) => {
    const shaded = state.shaded.includes(index);
    return `<rect data-aid-cell='${index}' data-shaded='${shaded}' x='${12 + index * width}' y='35' width='${width}' height='70' fill='${shaded ? MINT : INK}' fill-opacity='${shaded ? 0.9 : 0.06}' stroke='${INK}' stroke-width='1.5' role='button' tabindex='0' aria-pressed='${shaded}' aria-label='Part ${index + 1}: ${shaded ? "shaded" : "not shaded"}'/>`;
  }).join("");
}

function renderBalance(state: WorkbenchState): string {
  const tilt = Math.sign(state.left - state.right) * 14;
  const leftY = 49 + tilt, rightY = 49 - tilt;
  const pan = (x: number, y: number, side: string, value: number) =>
    `<path data-aid-pan='${side}' d='M ${x} ${y} L ${x - 25} ${y + 27} L ${x + 25} ${y + 27} Z' fill='none' stroke='${MINT}' stroke-width='2'/>`
      + text(x, y + 45, `${side === "left" ? "Left" : "Right"}: ${value}`);
  return `<path d='M 120 49 L 120 119 M 98 122 L 142 122' fill='none' stroke='${INK}' stroke-width='3'/>
    <line data-aid-beam='true' x1='54' y1='${leftY}' x2='186' y2='${rightY}' stroke='${GOLD}' stroke-width='4'/>
    ${pan(54, leftY, "left", state.left)}${pan(186, rightY, "right", state.right)}
    ${text(120, 20, `${state.left} ${state.left === state.right ? "=" : state.left > state.right ? ">" : "<"} ${state.right}`)}`;
}

function renderGraph(state: WorkbenchState): string {
  // Equal scales on both axes: x,y in [-5,5], ten SVG pixels per unit.
  const px = (x: number) => 120 + x * 10;
  const py = (y: number) => 68 - y * 10;
  let x1 = -5, x2 = 5;
  if (state.slope !== 0) {
    const atBottom = (-5 - state.intercept) / state.slope;
    const atTop = (5 - state.intercept) / state.slope;
    x1 = Math.max(x1, Math.min(atBottom, atTop));
    x2 = Math.min(x2, Math.max(atBottom, atTop));
  }
  const grid = Array.from({ length: 11 }, (_, i) => {
    const value = i - 5;
    return `<line x1='${px(value)}' y1='18' x2='${px(value)}' y2='118'/><line x1='70' y1='${py(value)}' x2='170' y2='${py(value)}'/>`;
  }).join("");
  return `<g stroke='${INK}' stroke-opacity='0.18'>${grid}</g>
    <path d='M 70 68 H 177 M 173 65 L 177 68 L 173 71 M 120 118 V 12 M 117 16 L 120 12 L 123 16' fill='none' stroke='${INK}' stroke-width='1.5'/>
    <svg x='70' y='18' width='100' height='100' viewBox='70 18 100 100' overflow='hidden'>
      <line data-aid-graph-line='true' data-slope='${state.slope}' data-intercept='${state.intercept}' x1='${px(x1)}' y1='${py(state.slope * x1 + state.intercept)}' x2='${px(x2)}' y2='${py(state.slope * x2 + state.intercept)}' stroke='${MINT}' stroke-width='2.5'/>
    </svg>
    ${text(185, 72, "x")}${text(133, 13, "y")}${text(70, 82, "-5", 9)}${text(170, 82, "5", 9)}
    ${text(110, 21, "5", 9)}${text(109, 120, "-5", 9)}${text(110, 79, "0", 9)}
    ${text(120, 137, "x: -5 to 5; y: -5 to 5", 10)}`;
}

export function renderWorkbench(state: WorkbenchState): { svg: string; caption: string; shortCaption: string; instruction: string; altText: string } {
  let inner: string, caption: string, instruction: string;
  switch (state.tool) {
    case "picture":
      if (state.context.visual?.svg.trim()) {
        // Keep the supplied SVG byte-for-byte inside the fixed-size workbench viewport.
        inner = state.context.visual.svg;
        caption = `Question picture: ${state.context.visual.altText}`;
        instruction = "Mark or draw on your picture.";
      } else {
        inner = `<g stroke='${INK}' stroke-opacity='0.22' fill='none'>${drawingGrid()}</g>`;
        caption = "Blank drawing grid. Build your own model; this is not a question diagram.";
        instruction = "Choose Pen to sketch your thinking.";
      }
      break;
    case "counters":
      inner = renderCounters(state);
      caption = `Your model: ${state.counters} counters; ${state.crossed.length} selected (crossed out); ${state.counters - state.crossed.length} remaining.`;
      instruction = state.counters === 0 ? "Tap + to build your counters." : "Tap a counter to cross it out.";
      break;
    case "fractions": {
      inner = renderFractions(state);
      const names: Record<number, string> = { 2: "half", 3: "third", 4: "quarter" };
      caption = state.context.grade <= 2
        ? `Your model: each of the ${state.parts} equal parts is one ${names[state.parts]}. ${state.shaded.length} shaded; ${state.parts - state.shaded.length} not shaded.`
        : `Your model: ${state.shaded.length}/${state.parts} shaded; ${state.parts} equal parts.`;
      instruction = state.context.grade <= 2 ? `Tap a ${names[state.parts]} to shade it.` : "Tap equal parts to shade or clear.";
      break;
    }
    case "balance":
      inner = renderBalance(state);
      caption = `Your model: left ${state.left}, right ${state.right}. ${state.left === state.right ? "Both sides are equal; the beam is level." : state.left > state.right ? "Left is greater and tilts down." : "Right is greater and tilts down."}`;
      instruction = "More weight goes down.";
      break;
    case "graph":
      inner = renderGraph(state);
      caption = `Your linear model: y = ${state.slope}x ${state.intercept < 0 ? "-" : "+"} ${Math.abs(state.intercept)}. Visible bounds: x and y from -5 to 5; equal unit scales.`;
      instruction = "Change the slope or height.";
      break;
  }
  const altText = state.tool === "picture" && state.context.visual?.svg.trim()
    ? state.context.visual.altText : caption;
  const shortCaption = state.tool === "picture" ? state.context.visual ? "Mark or trace your diagram." : "Your sketch space."
    : state.tool === "counters" ? `${state.counters - state.crossed.length} left · ${state.crossed.length} crossed out`
    : state.tool === "fractions" ? `${state.shaded.length} of ${state.parts} equal parts shaded`
    : state.tool === "balance" ? state.left === state.right ? "Both sides balance." : state.left > state.right ? "Left is heavier." : "Right is heavier."
    : `y = ${state.slope}x ${state.intercept < 0 ? "-" : "+"} ${Math.abs(state.intercept)}`;
  return { svg: wrap(inner, caption), caption, shortCaption, instruction, altText };
}
