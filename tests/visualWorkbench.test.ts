import test from "node:test";
import assert from "node:assert/strict";
import type { Grade, VisualAssetSpec } from "../src/domain/types";
import {
  availableWorkbenchTools,
  createWorkbench,
  renderWorkbench,
  updateWorkbench,
  type WorkbenchAction,
  type WorkbenchContext,
  type WorkbenchParameter,
  type WorkbenchState,
  type WorkbenchTool
} from "../src/learn/visualWorkbench";

function context(grade: Grade = 1, skillId = "single_digit_add_sub"): WorkbenchContext {
  return { id: "current-question", grade, skillId, prompt: "There are 8 birds. 3 fly away. How many remain?" };
}

function set(state: WorkbenchState, parameter: WorkbenchParameter, value: number): WorkbenchState {
  return updateWorkbench(state, { type: "set", parameter, value });
}

function tool(state: WorkbenchState, selected: WorkbenchTool): WorkbenchState {
  return updateWorkbench(state, { type: "tool", tool: selected });
}

function elements(svg: string, attribute: string): Record<string, string>[] {
  return [...svg.matchAll(new RegExp(`<[^>]+ ${attribute}='[^']*'[^>]*>`, "g"))].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)='([^']*)'/g)].map(([, name, value]) => [name, value]))
  );
}

test("grades 1-12 start with empty construction, never numbers extracted from the question", () => {
  for (let grade = 1; grade <= 12; grade++) {
    const input = context(grade as Grade);
    const state = createWorkbench(input);
    assert.deepEqual(state.context, input);
    assert.notEqual(state.context, input);
    assert.deepEqual([state.counters, state.left, state.right, state.slope, state.intercept], [0, 0, 0, 0, 0]);
    assert.equal(state.parts, 2);
    assert.deepEqual(state.crossed, []);
    assert.deepEqual(state.shaded, []);
    assert.deepEqual(state, createWorkbench(input));
    assert.equal(elements(renderWorkbench(state).svg, "data-aid-counter").length, 0);
    assert.equal(availableWorkbenchTools(input).includes("graph"), grade >= 3);
    assert.ok(availableWorkbenchTools(input).includes(state.tool));
  }
});

test("defaults follow relevant skills, unknown skills stay blank, and exact pictures take priority", () => {
  const cases: [Grade, string, WorkbenchTool][] = [
    [1, "counting_ordering", "counters"], [2, "fractions_words", "fractions"],
    [2, "prealgebra_balance", "balance"], [3, "coordinates_paths", "graph"],
    [4, "patterns_equations", "balance"], [6, "fractions_operations", "fractions"],
    [7, "linear_equations", "graph"], [9, "functions_graphs", "graph"],
    [11, "analytic_geometry", "graph"], [12, "functions_transformations", "graph"],
    [1, "pictographs_bar_graphs", "picture"], [12, "unknown", "picture"]
  ];
  const visual: VisualAssetSpec = {
    kind: "lesson",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'><rect x='12' y='20' width='19' height='17' fill='#ffd479'/></svg>",
    altText: "The current question's rectangle <not an answer>"
  };
  for (const [grade, skill, expected] of cases) {
    assert.equal(createWorkbench(context(grade, skill)).tool, expected);
    const state = createWorkbench({ ...context(grade, skill), visual });
    assert.equal(state.tool, "picture");
    assert.notEqual(state.context.visual, visual);
    const rendered = renderWorkbench(state);
    assert.ok(rendered.svg.includes(visual.svg), "do not rewrite or replace the supplied SVG");
    assert.equal(rendered.caption, `Question picture: ${visual.altText}`);
    assert.equal(rendered.altText, visual.altText);
    assert.ok(rendered.svg.includes("&apos;s rectangle &lt;not an answer&gt;"));
  }
});

test("no-picture workbench is explicitly a blank drawing grid", () => {
  const state = createWorkbench(context(12, "unknown"));
  const rendered = renderWorkbench(state);
  assert.match(rendered.caption, /Blank drawing grid/);
  assert.match(rendered.caption, /not a question diagram/);
  assert.equal((rendered.svg.match(/<line /g) ?? []).length, 18);
  assert.doesNotMatch(rendered.svg, /<circle|<rect|data-aid-cell|data-aid-counter/);
  const empty = createWorkbench({ ...context(), visual: { kind: "lesson", svg: "  ", altText: "unavailable" } });
  assert.equal(empty.tool, "counters");
  assert.match(renderWorkbench(tool(empty, "picture")).caption, /Blank drawing grid/);
});

test("all parameters clamp to grade-specific integer bounds and ignore non-finite input", () => {
  for (let grade = 1; grade <= 12; grade++) {
    const state = createWorkbench(context(grade as Grade));
    const bounds: [WorkbenchParameter, number, number][] = [
      ["counters", 0, 30], ["parts", 2, grade <= 2 ? 4 : 12],
      ["left", 0, 20], ["right", 0, 20], ["slope", -5, 5], ["intercept", -5, 5]
    ];
    for (const [parameter, low, high] of bounds) {
      for (let value = low; value <= high; value++) assert.equal(set(state, parameter, value)[parameter], value);
      assert.equal(set(state, parameter, -100)[parameter], low);
      assert.equal(set(state, parameter, 100)[parameter], high);
      assert.equal(set(state, parameter, 3.9)[parameter], 3);
      assert.equal(updateWorkbench(state, { type: "adjust", parameter, delta: 100 })[parameter], high);
      assert.equal(updateWorkbench(state, { type: "adjust", parameter, delta: -100 })[parameter], low);
      for (const value of [NaN, Infinity, -Infinity]) {
        assert.deepEqual(set(state, parameter, value), state);
        assert.deepEqual(updateWorkbench(state, { type: "adjust", parameter, delta: value }), state);
      }
    }
  }
});

test("adjust changes only the requested integer parameter and does not round a fractional click down", () => {
  const state = set(createWorkbench(context()), "counters", 4);
  assert.equal(updateWorkbench(state, { type: "adjust", parameter: "counters", delta: 1 }).counters, 5);
  assert.equal(updateWorkbench(state, { type: "adjust", parameter: "counters", delta: -1 }).counters, 3);
  assert.deepEqual(updateWorkbench(state, { type: "adjust", parameter: "counters", delta: -0.5 }), state);
  assert.deepEqual(updateWorkbench(state, { type: "adjust", parameter: "counters", delta: 0 }), state);
});

test("counters render exactly 0-30 actual counters, with distinct selected and remaining captions", () => {
  for (let count = 0; count <= 30; count++) {
    const state = set(createWorkbench(context()), "counters", count);
    const marks = elements(renderWorkbench(state).svg, "data-aid-counter");
    assert.deepEqual(marks.map((mark) => Number(mark["data-aid-counter"])), Array.from({ length: count }, (_, i) => i));
    assert.equal((renderWorkbench(state).svg.match(/<circle /g) ?? []).length, count);
  }
  let state = set(createWorkbench(context()), "counters", 5);
  state = updateWorkbench(state, { type: "counter", index: 4 });
  state = updateWorkbench(state, { type: "counter", index: 1 });
  assert.deepEqual(state.crossed, [1, 4]);
  const rendered = renderWorkbench(state);
  assert.match(rendered.caption, /5 counters; 2 selected \(crossed out\); 3 remaining/);
  assert.equal(elements(rendered.svg, "data-crossed").filter((mark) => mark["data-crossed"] === "true").length, 2);
  assert.equal((rendered.svg.match(/<path /g) ?? []).length, 2, "crosses distinguish selected counters without relying on color");
  assert.match(rendered.svg, /fill='none' stroke='#ffd479'/);
  assert.deepEqual(updateWorkbench(state, { type: "counter", index: 1 }).crossed, [4]);
  state = set(state, "counters", 3);
  assert.deepEqual(state.crossed, [1]);
  assert.deepEqual(set(state, "counters", 5).crossed, [1], "removed counters do not return crossed");
  assert.deepEqual(set(state, "counters", 0).crossed, []);
});

test("invalid counter and shading indices are harmless; toggling twice restores the model", () => {
  const state = set(createWorkbench(context()), "counters", 4);
  for (const type of ["counter", "shade"] as const) {
    const count = type === "counter" ? state.counters : state.parts;
    for (const index of [-1, count, 30, 0.5, NaN, Infinity, -Infinity]) {
      assert.deepEqual(updateWorkbench(state, { type, index }), state);
    }
    for (let index = 0; index < count; index++) {
      assert.deepEqual(updateWorkbench(updateWorkbench(state, { type, index }), { type, index }), state);
    }
  }
  assert.deepEqual(updateWorkbench(createWorkbench(context()), { type: "counter", index: 0 }).crossed, []);
});

test("every permitted fraction partition has equal cells with contiguous zero-based tap indices", () => {
  for (let grade = 1; grade <= 12; grade++) {
    const initial = createWorkbench(context(grade as Grade, "fractions_parts"));
    const allowed = grade <= 2 ? [2, 3, 4] : Array.from({ length: 11 }, (_, i) => i + 2);
    for (const parts of allowed) {
      let state = set(initial, "parts", parts);
      const cells = elements(renderWorkbench(state).svg, "data-aid-cell");
      assert.equal(cells.length, parts);
      cells.forEach((cell, index) => {
        assert.equal(Number(cell["data-aid-cell"]), index);
        assert.equal(Number(cell.width), 216 / parts);
        assert.equal(Number(cell.height), 70);
        assert.ok(Math.abs(Number(cell.x) - (12 + index * 216 / parts)) < 1e-10);
        state = updateWorkbench(state, { type: "shade", index });
      });
      assert.equal(state.shaded.length, parts);
      const rendered = renderWorkbench(state);
      assert.ok(elements(rendered.svg, "data-aid-cell").every((cell) => cell["data-shaded"] === "true"));
      if (grade <= 2) {
        const word = { 2: "half", 3: "third", 4: "quarter" }[parts];
        assert.ok(rendered.caption.includes(`one ${word}`));
        assert.doesNotMatch(rendered.caption + rendered.instruction, /\d+\s*\/\s*\d+/);
      } else assert.ok(rendered.caption.includes(`${parts}/${parts} shaded`));
      assert.deepEqual(set(state, "parts", parts).shaded, state.shaded);
      assert.deepEqual(set(state, "parts", parts === 2 ? 3 : 2).shaded, []);
    }
  }
});

test("balance comparison and beam direction agree for all 441 left/right values", () => {
  const initial = tool(createWorkbench(context()), "balance");
  for (let left = 0; left <= 20; left++) {
    for (let right = 0; right <= 20; right++) {
      const rendered = renderWorkbench(set(set(initial, "left", left), "right", right));
      const [beam] = elements(rendered.svg, "data-aid-beam");
      assert.equal(Math.sign(Number(beam.y1) - Number(beam.y2)), Math.sign(left - right));
      assert.ok(rendered.svg.includes(`Left: ${left}</text>`));
      assert.ok(rendered.svg.includes(`Right: ${right}</text>`));
      assert.ok(rendered.caption.includes(left === right ? "beam is level" : left > right ? "Left is greater" : "Right is greater"));
    }
  }
});

test("all 121 graph coefficient pairs give correctly clipped y=mx+b with explicit bounds", () => {
  const initial = tool(createWorkbench(context(12)), "graph");
  for (let slope = -5; slope <= 5; slope++) {
    for (let intercept = -5; intercept <= 5; intercept++) {
      const rendered = renderWorkbench(set(set(initial, "slope", slope), "intercept", intercept));
      const lines = elements(rendered.svg, "data-aid-graph-line");
      assert.equal(lines.length, 1);
      const [line] = lines;
      assert.equal(Number(line["data-slope"]), slope);
      assert.equal(Number(line["data-intercept"]), intercept);
      assert.ok(Number(line.x1) < Number(line.x2));
      for (const end of [1, 2]) {
        const x = (Number(line[`x${end}`]) - 120) / 10;
        const y = (68 - Number(line[`y${end}`])) / 10;
        assert.ok(Math.abs(y - (slope * x + intercept)) < 1e-10);
        assert.ok(x >= -5 - 1e-10 && x <= 5 + 1e-10 && y >= -5 - 1e-10 && y <= 5 + 1e-10);
        assert.ok(Math.abs(Math.abs(x) - 5) < 1e-10 || Math.abs(Math.abs(y) - 5) < 1e-10, "each endpoint reaches the clipping boundary");
      }
      assert.match(rendered.svg, /viewBox='70 18 100 100' overflow='hidden'/);
      assert.match(rendered.svg, />x<\/text>/);
      assert.match(rendered.svg, />y<\/text>/);
      assert.match(rendered.svg, /x: -5 to 5; y: -5 to 5/);
      assert.match(rendered.caption, /equal unit scales/);
      assert.ok(rendered.caption.includes(`y = ${slope}x ${intercept < 0 ? "-" : "+"} ${Math.abs(intercept)}`));
    }
  }
});

test("tool switching retains construction, disallows early-grade graphs, and reset clears only the active model", () => {
  let state = createWorkbench(context(12));
  for (const parameter of ["counters", "parts", "left", "right", "slope", "intercept"] as const) state = set(state, parameter, 4);
  state = updateWorkbench(state, { type: "counter", index: 3 });
  state = updateWorkbench(state, { type: "shade", index: 2 });
  const resetFields: Record<WorkbenchTool, Partial<WorkbenchState>> = {
    picture: {}, counters: { counters: 0, crossed: [] }, fractions: { parts: 2, shaded: [] },
    balance: { left: 0, right: 0 }, graph: { slope: 0, intercept: 0 }
  };
  for (const selected of availableWorkbenchTools(state.context)) {
    const switched = tool(state, selected);
    assert.deepEqual(switched, { ...state, tool: selected });
    const reset = updateWorkbench(switched, { type: "reset" });
    assert.deepEqual(reset, { ...switched, ...resetFields[selected] });
    assert.deepEqual(updateWorkbench(reset, { type: "reset" }), reset);
  }
  const early = createWorkbench(context(2));
  assert.deepEqual(tool(early, "graph"), early);
});

test("reducers and rendering never mutate frozen inputs and render deterministically", () => {
  const state = set(createWorkbench(context(12)), "counters", 6);
  const before = structuredClone(state);
  Object.freeze(state.context);
  Object.freeze(state.crossed);
  Object.freeze(state.shaded);
  Object.freeze(state);
  const actions: WorkbenchAction[] = [
    { type: "tool", tool: "fractions" }, { type: "set", parameter: "counters", value: 2 },
    { type: "set", parameter: "parts", value: 7 }, { type: "adjust", parameter: "left", delta: 3 },
    { type: "counter", index: 3 }, { type: "shade", index: 1 }, { type: "reset" }
  ];
  for (const action of actions) {
    const next = updateWorkbench(state, action);
    assert.notEqual(next, state);
    assert.deepEqual(state, before);
    assert.deepEqual(renderWorkbench(next), renderWorkbench(next));
  }
  assert.deepEqual(renderWorkbench(state), renderWorkbench(state));
  assert.deepEqual(state, before);
});

test("every tool uses the fixed 240x140 viewport and explicit dark-theme-safe ink", () => {
  const initial = createWorkbench(context(12));
  for (const selected of availableWorkbenchTools(initial.context)) {
    const rendered = renderWorkbench(tool(initial, selected));
    assert.match(rendered.svg, /^<svg [^>]*width='240' height='140' viewBox='0 0 240 140'/);
    assert.match(rendered.svg, /color='#f2f7ff' fill='#f2f7ff'/);
    assert.doesNotMatch(rendered.svg, /color-mix|currentColor|var\(|NaN|Infinity/);
    assert.ok(rendered.caption.length > 0);
    assert.ok(rendered.instruction.length > 0);
    assert.equal(rendered.altText, rendered.caption);
  }
});
