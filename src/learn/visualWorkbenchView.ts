import { availableWorkbenchTools, createWorkbench, renderWorkbench, updateWorkbench, type WorkbenchAction, type WorkbenchContext, type WorkbenchState, type WorkbenchTool } from "./visualWorkbench";

type Point = { x: number; y: number };
type Stroke = Point[];
type Snapshot = { model: WorkbenchState; ink: Stroke[] };
const TOOL_NAMES: Record<WorkbenchTool, string> = { picture: "Picture", counters: "Count", fractions: "Parts", balance: "Balance", graph: "Graph" };
const SVG_NS = "http://www.w3.org/2000/svg";

function node<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** UI state belongs to one active question; nothing here can submit or grade an answer. */
export class VisualWorkbenchView {
  private model: WorkbenchState | null = null;
  private ink = this.emptyTools<Stroke[]>();
  private history = this.emptyTools<Snapshot[]>();
  private pen = false;
  private parameter = "";
  private pointer: { id: number; points: Stroke; element: SVGSVGElement } | null = null;
  private trigger: HTMLElement | null = null;

  constructor(private hooks: { onOpen(): void; onClose(): void; speak(text: string): void }) {
    node("workbench-close").onclick = () => this.close();
    node("workbench-mark").onclick = () => { this.cancelStroke(); this.pen = false; this.render(); };
    node("workbench-pen").onclick = () => { this.pen = true; this.render(); };
    node("workbench-reset").onclick = () => { if (!this.model) return; this.remember(); this.model = updateWorkbench(this.model, { type: "reset" }); this.ink[this.model.tool] = []; this.render(); };
    node("workbench-undo").onclick = () => this.undo();
    const surface = node("workbench-surface");
    surface.addEventListener("click", (event) => this.tap(event));
    surface.addEventListener("pointerdown", (event) => this.startStroke(event));
    surface.addEventListener("pointermove", (event) => this.moveStroke(event));
    surface.addEventListener("pointerup", (event) => this.finishStroke(event));
    surface.addEventListener("pointercancel", () => { this.cancelStroke(); this.paintInk(); });
    surface.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as Element;
      if (this.toggleCell(target)) event.preventDefault();
    });
    node("workbench-overlay").addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); this.close(); }
      if (event.key !== "Tab") return;
      const focusable = [...node("workbench-overlay").querySelectorAll<HTMLElement>('button:not(:disabled),summary,[tabindex="0"]')].filter((item) => item.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

  private emptyTools<T extends unknown[]>(): Record<WorkbenchTool, T> {
    return { picture: [], counters: [], fractions: [], balance: [], graph: [] } as unknown as Record<WorkbenchTool, T>;
  }

  get isOpen(): boolean { return !node("workbench-overlay").hidden; }
  get scrollTarget(): HTMLElement { return node("workbench-scroll"); }

  open(context: WorkbenchContext): void {
    if (context.id !== this.model?.context.id || context.grade !== this.model?.context.grade) {
      this.model = createWorkbench(context);
      this.ink = this.emptyTools<Stroke[]>();
      this.history = this.emptyTools<Snapshot[]>();
      this.pen = false;
      this.parameter = "";
    } else if (this.model) {
      if (context.visual?.svg !== this.model.context.visual?.svg) {
        this.ink.picture = [];
        this.history.picture = [];
      }
      this.model = { ...this.model, context: createWorkbench(context).context };
    }
    if (!this.isOpen) {
      this.trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node("workbench-overlay").hidden = false;
      node("workbench-overlay").classList.add("active");
      this.hooks.onOpen();
    }
    for (const screen of document.querySelectorAll<HTMLElement>(".screen")) screen.inert = true;
    node("workbench-question").textContent = context.prompt;
    node("workbench-question-preview").textContent = context.prompt;
    node<HTMLDetailsElement>("workbench-context").open = window.innerWidth >= 500;
    this.render();
    node("workbench-scroll").scrollTop = 0;
    node("workbench-close").focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.cancelStroke();
    node("workbench-overlay").hidden = true;
    node("workbench-overlay").classList.remove("active");
    for (const screen of document.querySelectorAll<HTMLElement>(".screen")) screen.inert = false;
    this.hooks.onClose();
    if (this.trigger?.isConnected && this.trigger.getClientRects().length) this.trigger.focus({ preventScroll: true });
  }

  speak(): void {
    if (!this.model) return;
    const view = renderWorkbench(this.model);
    this.hooks.speak(view.instruction + " " + view.shortCaption);
  }

  stateForTesting() {
    return this.model && { open: this.isOpen, tool: this.model.tool, counters: this.model.counters, crossed: this.model.crossed, parts: this.model.parts, shaded: this.model.shaded, left: this.model.left, right: this.model.right, slope: this.model.slope, intercept: this.model.intercept, strokes: this.ink[this.model.tool].length, drawing: this.pen };
  }

  private remember(): void {
    if (!this.model) return;
    this.cancelStroke();
    const tool = this.model.tool;
    this.history[tool].push({ model: this.model, ink: this.ink[tool] });
    if (this.history[tool].length > 40) this.history[tool].shift();
  }

  private undo(): void {
    if (!this.model) return;
    const tool = this.model.tool, previous = this.history[tool].pop();
    if (!previous) return;
    this.cancelStroke();
    const old = previous.model;
    const fields = tool === "counters" ? { counters: old.counters, crossed: old.crossed }
      : tool === "fractions" ? { parts: old.parts, shaded: old.shaded }
      : tool === "balance" ? { left: old.left, right: old.right }
      : tool === "graph" ? { slope: old.slope, intercept: old.intercept } : {};
    this.model = { ...this.model, ...fields };
    this.ink[tool] = previous.ink;
    this.render();
  }

  private act(action: WorkbenchAction, clearInk = false): void {
    if (!this.model) return;
    this.remember();
    this.model = updateWorkbench(this.model, action);
    if (clearInk) this.ink[this.model.tool] = [];
    this.render();
  }

  private render(): void {
    if (!this.model) return;
    const focus = (document.activeElement as HTMLElement | null)?.dataset.aidControl;
    const scrollTop = this.scrollTarget.scrollTop;
    const state = this.model, view = renderWorkbench(state);
    const titles: Record<WorkbenchTool, string> = {
      picture: state.context.visual ? state.context.id.startsWith("lesson:") ? "Lesson picture" : "Question picture" : "Your sketch",
      counters: "Your counters", fractions: "Your equal parts", balance: "Your balance", graph: "Your line graph"
    };
    node("workbench-title").textContent = titles[state.tool];
    const tabs = node("workbench-tools");
    tabs.replaceChildren();
    for (const tool of availableWorkbenchTools(state.context)) {
      const button = this.button(TOOL_NAMES[tool], "tool-" + tool, () => {
        this.cancelStroke(); this.model = updateWorkbench(this.model!, { type: "tool", tool }); this.pen = false; this.parameter = ""; this.render();
      });
      button.dataset.aidTool = tool;
      button.setAttribute("aria-pressed", String(state.tool === tool));
      tabs.append(button);
    }
    node("workbench-instruction").textContent = view.instruction;
    node("workbench-caption").textContent = view.shortCaption;
    node("workbench-surface").innerHTML = view.svg;
    node("workbench-surface").dataset.drawing = String(this.pen);
    const svg = node("workbench-surface").querySelector("svg");
    if (svg) {
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", view.altText);
      for (const cell of svg.querySelectorAll("[data-aid-counter],[data-aid-cell]")) {
        cell.setAttribute("role", "button"); cell.setAttribute("tabindex", "0");
        const isCounter = cell.hasAttribute("data-aid-counter");
        const index = Number(cell.getAttribute(isCounter ? "data-aid-counter" : "data-aid-cell"));
        cell.setAttribute("data-aid-control", (isCounter ? "counter-" : "part-") + index);
        const active = (isCounter ? state.crossed : state.shaded).includes(index);
        cell.setAttribute("aria-pressed", String(active));
        cell.setAttribute("aria-label", (isCounter ? "Counter " : "Part ") + (index + 1) + (active ? ", selected" : ""));
      }
    }
    this.paintInk();
    const controls = node("workbench-controls"); controls.replaceChildren();
    const keys = state.tool === "counters" ? ["counters"] : state.tool === "fractions" ? ["parts"] : state.tool === "balance" ? ["left", "right"] : state.tool === "graph" ? ["slope", "intercept"] : [];
    if (!keys.includes(this.parameter)) this.parameter = keys[0] || "";
    const labels: Record<string, string> = { counters: "Counters", parts: "Equal parts", left: "Left", right: "Right", slope: "Slope", intercept: "Height" };
    if (keys.length > 1) {
      const strip = document.createElement("div"); strip.className = "workbench-parameters";
      for (const key of keys) {
        const value = state[key as "left" | "right" | "slope" | "intercept"];
        const chip = this.button(labels[key] + " " + value, "param-" + key, () => { this.parameter = key; this.render(); });
        chip.setAttribute("aria-pressed", String(this.parameter === key));
        strip.append(chip);
      }
      controls.append(strip);
    }
    if (this.parameter) {
      const key = this.parameter as "counters" | "parts" | "left" | "right" | "slope" | "intercept";
      const row = document.createElement("div"); row.className = "workbench-stepper";
      const minus = this.button("−", "decrease", () => this.act({ type: "adjust", parameter: key, delta: -1 }, true));
      const plus = this.button("+", "increase", () => this.act({ type: "adjust", parameter: key, delta: 1 }, true));
      minus.setAttribute("aria-label", "Decrease " + labels[key]); plus.setAttribute("aria-label", "Increase " + labels[key]);
      const min = key === "parts" ? 2 : key === "slope" || key === "intercept" ? -5 : 0;
      const max = key === "counters" ? 30 : key === "parts" ? state.context.grade <= 2 ? 4 : 12 : key === "slope" || key === "intercept" ? 5 : 20;
      minus.disabled = state[key] <= min; plus.disabled = state[key] >= max;
      const output = document.createElement("output"); output.textContent = labels[key] + ": " + state[key];
      row.append(minus, output, plus); controls.append(row);
    }
    node("workbench-mark").setAttribute("aria-pressed", String(!this.pen));
    node("workbench-pen").setAttribute("aria-pressed", String(this.pen));
    node<HTMLButtonElement>("workbench-undo").disabled = !this.history[state.tool].length;
    this.scrollTarget.scrollTop = scrollTop;
    if (focus) {
      const control = node("workbench-overlay").querySelector<HTMLButtonElement>('[data-aid-control="' + focus + '"]');
      const alternative = focus === "increase" ? "decrease" : "increase";
      const fallback = node("workbench-overlay").querySelector<HTMLButtonElement>('[data-aid-control="' + alternative + '"]');
      (control && !control.disabled ? control : fallback && !fallback.disabled ? fallback : node("workbench-close")).focus({ preventScroll: true });
    }
  }

  private button(text: string, key: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button"; button.className = "btn"; button.textContent = text; button.dataset.aidControl = key; button.onclick = action;
    return button;
  }

  private toggleCell(target: Element): boolean {
    if (this.pen || !this.model) return false;
    const counter = target.closest("[data-aid-counter]"), cell = target.closest("[data-aid-cell]");
    if (counter) { this.act({ type: "counter", index: Number(counter.getAttribute("data-aid-counter")) }); return true; }
    if (cell) { this.act({ type: "shade", index: Number(cell.getAttribute("data-aid-cell")) }); return true; }
    return false;
  }

  private tap(event: MouseEvent): void {
    if (this.pen || !this.model) return;
    if (this.toggleCell(event.target as Element)) return;
    const point = this.point(event.clientX, event.clientY);
    if (!point || this.ink[this.model.tool].length >= 80) return;
    this.remember(); this.ink[this.model.tool] = [...this.ink[this.model.tool], [point]]; this.render();
  }

  private point(clientX: number, clientY: number): Point | null {
    const svg = node("workbench-surface").querySelector("svg");
    const transform = svg?.getScreenCTM();
    if (!svg || !transform) return null;
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    const local = point.matrixTransform(transform.inverse());
    if (local.x < 0 || local.y < 0 || local.x > 240 || local.y > 140) return null;
    return { x: Math.round(local.x * 10) / 10, y: Math.round(local.y * 10) / 10 };
  }

  private startStroke(event: PointerEvent): void {
    if (!this.pen || !this.model || this.ink[this.model.tool].length >= 80 || event.button !== 0) return;
    const point = this.point(event.clientX, event.clientY), svg = node("workbench-surface").querySelector("svg");
    if (!point || !svg) return;
    this.cancelStroke();
    this.pointer = { id: event.pointerId, points: [point], element: svg };
    svg.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
    this.paintInk();
  }

  private moveStroke(event: PointerEvent): void {
    if (!this.pointer || this.pointer.id !== event.pointerId || this.pointer.points.length >= 160) return;
    const point = this.point(event.clientX, event.clientY);
    if (!point) return;
    this.pointer.points.push(point); this.paintInk(); event.preventDefault();
  }

  private finishStroke(event: PointerEvent): void {
    if (!this.pointer || this.pointer.id !== event.pointerId || !this.model) return;
    const points = this.pointer.points;
    this.cancelStroke();
    this.remember();
    this.ink[this.model.tool] = [...this.ink[this.model.tool], points]; this.render(); event.preventDefault();
  }

  private cancelStroke(): void {
    if (this.pointer?.element.hasPointerCapture(this.pointer.id)) this.pointer.element.releasePointerCapture(this.pointer.id);
    this.pointer = null;
  }

  private paintInk(): void {
    if (!this.model) return;
    const svg = node("workbench-surface").querySelector("svg");
    if (!svg) return;
    svg.querySelector("[data-aid-ink]")?.remove();
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("data-aid-ink", "true"); group.setAttribute("pointer-events", "none");
    for (const stroke of [...this.ink[this.model.tool], ...(this.pointer ? [this.pointer.points] : [])]) {
      if (stroke.length === 1) {
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(stroke[0].x)); dot.setAttribute("cy", String(stroke[0].y)); dot.setAttribute("r", "4");
        dot.setAttribute("fill", "#f3c774"); dot.setAttribute("stroke", "#06160f"); group.append(dot);
      } else {
        const line = document.createElementNS(SVG_NS, "polyline");
        line.setAttribute("points", stroke.map((point) => point.x + "," + point.y).join(" "));
        line.setAttribute("stroke", "#f3c774"); line.setAttribute("stroke-width", "2.5");
        line.setAttribute("fill", "none"); line.setAttribute("stroke-linecap", "round"); line.setAttribute("stroke-linejoin", "round");
        group.append(line);
      }
    }
    svg.append(group);
  }
}
