import type { Grade, PracticeSession, QuestionInstance } from "../domain/types";
import { toTimeLabel } from "../content/g1g2/helpers";
import { buildContestQuestions, createPracticeProvider, allGrade12Skills } from "../content/g1g2/bank";
import { buildLegacyContestQuestions, totalQuestionsForGrade } from "../legacy/grade3plus";
import { getDeterministicCoach } from "../coach/deterministicCoach";
import { TTSQueue } from "../audio/ttsQueue";
import { loadProfile, loadProfileAsync, saveProfileAsync } from "../storage/profileStore";
import { buildConceptLab, type ConceptLabFlow } from "../learn/conceptLab";
import {
  getGuidedTopic,
  listGuidedTopics,
  type GuidedStage,
  type GuidedTopic,
  type GuidedTopicId
} from "../learn/guidedLessons";
import { renderLessonScene } from "../render/visualQuestionRenderer";
import {
  finalizePracticeSession,
  nextQuestion,
  recordAttempt,
  setPracticeQuestionProvider,
  startPracticeSession
} from "../engine/practiceEngine";

type GameMode = "contest" | "learn" | "practice";
type HelpMode = "hint" | "steps" | "explain";
type ScreenId = "home" | "game" | "result";
type AnswerLayoutMode = "inline" | "grid" | "stack";
type ScrollRailState = {
  visible: boolean;
  thumbTop: number;
  thumbHeight: number;
  pulse: boolean;
};

const tts = new TTSQueue();
const ACTION_HINT_KEY = "mk_icon_hint_seen_v1";
const SCROLL_STEP = 56;
const defaultScrollSelectors: Record<ScreenId, string> = {
  home: "#home-screen .screen-scroll",
  game: "#game-screen .question-card",
  result: "#result-screen .result-card"
};

let preferredScrollTarget: HTMLElement | null = null;
let touchScrollState: {
  target: HTMLElement | null;
  startY: number;
  startScrollTop: number;
} = {
  target: null,
  startY: 0,
  startScrollTop: 0
};
let actionHintTimerId: number | null = null;
let scrollRailPulseArmed = false;
let scrollRailDragState: {
  active: boolean;
  pointerId: number | null;
  startY: number;
  startScrollTop: number;
} = {
  active: false,
  pointerId: null,
  startY: 0,
  startScrollTop: 0
};

const state: {
  theme: "neon" | "gameboy";
  grade: Grade;
  mode: GameMode;
  questions: QuestionInstance[];
  index: number;
  score: number;
  correct: number;
  timerId: number | null;
  timeLeft: number;
  locked: boolean;
  startedAtMs: number;
  questionStartedAtMs: number;
  questionPauseMs: number;
  questionPausedAtMs: number | null;
  questionPauseDepth: number;
  practiceSession: PracticeSession | null;
  profile: ReturnType<typeof loadProfile>;
  stageLabel: string;
  helpMode: HelpMode;
  answeredCurrent: boolean;
  lastAnswerCorrect: boolean | null;
  learnActive: boolean;
  learnStepIndex: number;
  learnFlow: ConceptLabFlow | null;
  learnStepResolved: boolean;
  learnStepAttempts: number;
  learnFeedback: string;
  learnFeedbackTone: "good" | "retry" | "";
  learnSelectedIndex: number | null;
  guidedTopicId: GuidedTopicId | null;
  guidedStepIndex: number;
  guidedValues: Record<string, number | string>;
  guidedStepResolved: boolean;
  guidedStepAttempts: number;
  guidedFeedback: string;
  guidedFeedbackTone: "good" | "retry" | "";
  guidedSelectedIndex: number | null;
  answerLayoutMode: AnswerLayoutMode;
  learnAnswerLayoutMode: AnswerLayoutMode;
  scrollRailState: ScrollRailState;
} = {
  theme: "neon",
  grade: 1,
  mode: "contest",
  questions: [],
  index: 0,
  score: 0,
  correct: 0,
  timerId: null,
  timeLeft: 75 * 60,
  locked: false,
  startedAtMs: 0,
  questionStartedAtMs: 0,
  questionPauseMs: 0,
  questionPausedAtMs: null,
  questionPauseDepth: 0,
  practiceSession: null,
  profile: loadProfile(),
  stageLabel: "",
  helpMode: "hint",
  answeredCurrent: false,
  lastAnswerCorrect: null,
  learnActive: false,
  learnStepIndex: 0,
  learnFlow: null,
  learnStepResolved: true,
  learnStepAttempts: 0,
  learnFeedback: "",
  learnFeedbackTone: "",
  learnSelectedIndex: null,
  guidedTopicId: null,
  guidedStepIndex: 0,
  guidedValues: {},
  guidedStepResolved: true,
  guidedStepAttempts: 0,
  guidedFeedback: "",
  guidedFeedbackTone: "",
  guidedSelectedIndex: null,
  answerLayoutMode: "grid",
  learnAnswerLayoutMode: "grid",
  scrollRailState: {
    visible: false,
    thumbTop: 0,
    thumbHeight: 18,
    pulse: false
  }
};

function qs<T extends Element>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing selector: ${selector}`);
  return node as T;
}

function readLocalFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore storage errors inside constrained webviews
  }
}

function setPreferredScrollTarget(target: HTMLElement | null): void {
  preferredScrollTarget = target;
  if (target) target.focus({ preventScroll: true });
}

function defaultScrollTargetForScreen(screenId: ScreenId): HTMLElement | null {
  return document.querySelector<HTMLElement>(defaultScrollSelectors[screenId]);
}

function syncViewportMetrics(): void {
  const viewport = window.visualViewport;
  const width = Math.max(180, Math.floor(Math.min(240, viewport?.width ?? window.innerWidth ?? 240)));
  const height = Math.max(220, Math.floor(Math.min(282, viewport?.height ?? window.innerHeight ?? 282)));
  document.documentElement.style.setProperty("--viewport-width", `${width}px`);
  document.documentElement.style.setProperty("--viewport-height", `${height}px`);
  document.body.dataset.compactHeight = height < 270 ? "true" : "false";
}

function hideActionHint(): void {
  if (actionHintTimerId !== null) {
    window.clearTimeout(actionHintTimerId);
    actionHintTimerId = null;
  }
  qs<HTMLElement>("#action-hint").hidden = true;
}

function maybeShowActionHint(): void {
  if (readLocalFlag(ACTION_HINT_KEY)) return;
  const hint = qs<HTMLElement>("#action-hint");
  hint.hidden = false;
  writeLocalFlag(ACTION_HINT_KEY);
  actionHintTimerId = window.setTimeout(() => {
    hideActionHint();
  }, 2800);
}

function clearScrollRailPulse(): void {
  scrollRailPulseArmed = false;
  qs<HTMLElement>("#scroll-rail").classList.remove("pulse");
}

function armScrollRailPulse(): void {
  scrollRailPulseArmed = true;
}

function measureButtonLines(button: HTMLElement): number {
  const lineHeight = Number.parseFloat(window.getComputedStyle(button).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return button.scrollHeight > button.clientHeight + 1 ? 2 : 1;
  }
  return Math.max(1, Math.round(button.scrollHeight / lineHeight));
}

function setOptionLayout(container: HTMLElement, layout: AnswerLayoutMode, learn = false): void {
  container.dataset.layout = layout;
  if (learn) {
    state.learnAnswerLayoutMode = layout;
    return;
  }
  state.answerLayoutMode = layout;
}

function evaluateLayout(container: HTMLElement, buttons: HTMLElement[], layout: AnswerLayoutMode, learn = false): {
  wrappedCount: number;
  overflowCount: number;
} {
  setOptionLayout(container, layout, learn);
  void container.offsetWidth;
  let wrappedCount = 0;
  let overflowCount = 0;
  for (const button of buttons) {
    if (measureButtonLines(button) > 1) wrappedCount += 1;
    if (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 2) {
      overflowCount += 1;
    }
  }
  return { wrappedCount, overflowCount };
}

function chooseOptionLayout(
  container: HTMLElement,
  buttons: HTMLElement[],
  hasVisual: boolean,
  learn = false
): AnswerLayoutMode {
  if (!buttons.length) {
    setOptionLayout(container, "grid", learn);
    return "grid";
  }

  const labels = buttons.map((button) => (button.textContent || "").trim());
  const inlineEligible = labels.every((label) => /^\S+$/.test(label) && label.length <= (learn ? 6 : 5));
  if (inlineEligible) {
    const inline = evaluateLayout(container, buttons, "inline", learn);
    if (inline.wrappedCount === 0 && inline.overflowCount === 0) {
      return "inline";
    }
  }

  const grid = evaluateLayout(container, buttons, "grid", learn);
  const gridTooTight = hasVisual
    ? grid.wrappedCount >= 1 || grid.overflowCount > 0
    : grid.wrappedCount >= 2 || grid.overflowCount > 0;
  if (!gridTooTight) {
    return "grid";
  }

  evaluateLayout(container, buttons, "stack", learn);
  return "stack";
}

function updateScrollRail(): void {
  const rail = qs<HTMLElement>("#scroll-rail");
  const track = qs<HTMLElement>("#scroll-rail-track");
  const thumb = qs<HTMLElement>("#scroll-rail-thumb");
  const questionCard = qs<HTMLElement>("#game-screen .question-card");
  const overlayOpen = qs<HTMLElement>("#coach-overlay").classList.contains("active");
  const isGameScreen = document.querySelector<HTMLElement>(".screen.active")?.id === "game-screen";

  if (!isGameScreen || overlayOpen) {
    rail.hidden = true;
    questionCard.dataset.overflowing = "false";
    state.scrollRailState = { visible: false, thumbTop: 0, thumbHeight: 18, pulse: false };
    return;
  }

  const maxScroll = Math.max(0, questionCard.scrollHeight - questionCard.clientHeight);
  const visible = maxScroll > 2;
  rail.hidden = !visible;
  questionCard.dataset.overflowing = visible ? "true" : "false";

  if (!visible) {
    state.scrollRailState = { visible: false, thumbTop: 0, thumbHeight: 18, pulse: false };
    rail.classList.remove("pulse");
    return;
  }

  const trackHeight = Math.max(1, track.clientHeight);
  const thumbHeight = Math.max(18, Math.round((questionCard.clientHeight / questionCard.scrollHeight) * trackHeight));
  const travel = Math.max(0, trackHeight - thumbHeight);
  const thumbTop = maxScroll <= 0 ? 0 : Math.round((questionCard.scrollTop / maxScroll) * travel);
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.top = `${thumbTop}px`;

  const pulse = scrollRailPulseArmed && questionCard.scrollTop < 2;
  rail.classList.toggle("pulse", pulse);
  state.scrollRailState = {
    visible: true,
    thumbTop,
    thumbHeight,
    pulse
  };
}

function scheduleRailRefresh(beforeUpdate?: () => void): void {
  window.requestAnimationFrame(() => {
    beforeUpdate?.();
    window.requestAnimationFrame(() => {
      updateScrollRail();
      window.setTimeout(() => updateScrollRail(), 120);
      window.setTimeout(() => updateScrollRail(), 260);
    });
  });
}

function setScreen(screenId: ScreenId): void {
  const map: Record<string, string> = {
    home: "home-screen",
    game: "game-screen",
    result: "result-screen"
  };
  const target = map[screenId];
  for (const node of document.querySelectorAll<HTMLElement>(".screen")) {
    node.classList.toggle("active", node.id === target);
    if (node.id === target) {
      node.scrollTop = 0;
      for (const scrollable of node.querySelectorAll<HTMLElement>('[data-scrollable="true"]')) {
        scrollable.scrollTop = 0;
      }
    }
  }
  setPreferredScrollTarget(defaultScrollTargetForScreen(screenId));
  if (screenId !== "game") hideActionHint();
  scheduleRailRefresh();
}

function theme(themeName: "neon" | "gameboy"): void {
  state.theme = themeName;
  document.body.setAttribute("data-theme", themeName);
  for (const button of document.querySelectorAll<HTMLButtonElement>(".btn-theme")) {
    button.classList.toggle("active", button.dataset.theme === themeName);
  }
}

function buildGradeButtons(): void {
  const grid = qs<HTMLDivElement>("#grade-grid");
  grid.innerHTML = "";
  for (let g = 1; g <= 12; g += 1) {
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = String(g);
    button.dataset.grade = String(g);
    if (g === state.grade) button.classList.add("active");
    button.addEventListener("click", () => {
      state.grade = g as Grade;
      for (const n of grid.querySelectorAll(".btn")) n.classList.remove("active");
      button.classList.add("active");
      updateModeInfo();
    });
    grid.appendChild(button);
  }
}

function setMode(mode: GameMode): void {
  state.mode = mode;
  for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-mode]")) {
    button.classList.toggle("active", button.dataset.mode === mode);
  }
  updateModeInfo();
}

function updateModeInfo(): void {
  const total = totalQuestionsForGrade(state.grade);
  let info = "";
  if (state.mode === "contest") {
    info = `Contest · ${state.grade <= 4 ? 24 : 30} Q · 75 min · 3/4/5 points`;
  } else if (state.mode === "learn") {
    info = state.grade <= 2 ? "Learn · Topic lessons · Interactive visuals + checks" : `Learn · ${total} Q · Concept lab + checks + transfer`;
  } else {
    info = `Practice · ${total} Q · Adaptive + fix-the-miss drills`;
  }
  qs<HTMLParagraphElement>("#mode-info").textContent = info;
}

function clearTimer(): void {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearLearnTimer(): void {}

function setOptionsEnabled(enabled: boolean): void {
  for (const opt of document.querySelectorAll<HTMLButtonElement>(".option")) {
    opt.disabled = !enabled;
  }
}

function setQuestionSolveView(hidden: boolean): void {
  qs<HTMLElement>("#question-text").style.display = hidden ? "none" : "block";
  const visual = qs<HTMLElement>("#question-visual");
  visual.style.display = hidden ? "none" : visual.dataset.hasVisual === "true" ? "block" : "none";
  qs<HTMLElement>("#options").style.display = hidden ? "none" : "grid";
  scheduleRailRefresh();
}

function hideLearnPanel(): void {
  clearLearnTimer();
  state.learnActive = false;
  state.learnStepIndex = 0;
  state.learnFlow = null;
  state.learnStepResolved = true;
  state.learnStepAttempts = 0;
  state.learnFeedback = "";
  state.learnFeedbackTone = "";
  state.learnSelectedIndex = null;
  const panel = qs<HTMLElement>("#learn-panel");
  panel.hidden = true;
  qs<HTMLElement>("#learn-visual").innerHTML = "";
  qs<HTMLElement>("#learn-step-prompt").hidden = true;
  qs<HTMLElement>("#learn-options").hidden = true;
  qs<HTMLElement>("#learn-options").removeAttribute("data-layout");
  qs<HTMLElement>("#learn-feedback").hidden = true;
  state.learnAnswerLayoutMode = "grid";
  setQuestionSolveView(false);
  scheduleRailRefresh();
}

function isGuidedLearnMode(): boolean {
  return state.mode === "learn" && state.grade <= 2;
}

function currentGuidedTopic(): GuidedTopic | null {
  if (!isGuidedLearnMode() || !state.guidedTopicId) return null;
  return getGuidedTopic(state.grade, state.guidedTopicId);
}

function currentGuidedStage(): GuidedStage | null {
  const topic = currentGuidedTopic();
  if (!topic) return null;
  return topic.stages[state.guidedStepIndex] || null;
}

function resetGuidedState(): void {
  state.guidedTopicId = null;
  state.guidedStepIndex = 0;
  state.guidedValues = {};
  state.guidedStepResolved = true;
  state.guidedStepAttempts = 0;
  state.guidedFeedback = "";
  state.guidedFeedbackTone = "";
  state.guidedSelectedIndex = null;
}

function hideGuidedLessons(): void {
  resetGuidedState();
  qs<HTMLElement>("#topic-browser").hidden = true;
  qs<HTMLElement>("#guided-panel").hidden = true;
  qs<HTMLElement>("#guided-visual").innerHTML = "";
  const options = qs<HTMLElement>("#guided-choice-options");
  options.innerHTML = "";
  options.hidden = true;
  options.removeAttribute("data-layout");
  qs<HTMLElement>("#guided-choice-prompt").hidden = true;
  qs<HTMLElement>("#guided-choice-feedback").hidden = true;
  qs<HTMLElement>("#question-meta").style.display = "";
}

function setHudText(
  labels: { grade?: string; q?: string; points?: string; time?: string },
  values: { grade?: string; q?: string; points?: string; time?: string }
): void {
  if (labels.grade) qs<HTMLElement>("#hud-grade-label").textContent = labels.grade;
  if (labels.q) qs<HTMLElement>("#hud-q-label").textContent = labels.q;
  if (labels.points) qs<HTMLElement>("#hud-points-label").textContent = labels.points;
  if (labels.time) qs<HTMLElement>("#hud-time-label").textContent = labels.time;
  if (values.grade !== undefined) qs<HTMLElement>("#hud-grade").textContent = values.grade;
  if (values.q !== undefined) qs<HTMLElement>("#hud-q").textContent = values.q;
  if (values.points !== undefined) qs<HTMLElement>("#hud-points").textContent = values.points;
  if (values.time !== undefined) qs<HTMLElement>("#hud-time").textContent = values.time;
}

function updateHudForGuidedLearn(browser = false): void {
  const topic = currentGuidedTopic();
  const topics = listGuidedTopics(state.grade);
  const timerWrap = qs<HTMLElement>("#hud-timer-wrap");
  const coachButton = qs<HTMLButtonElement>("#coach-btn");
  timerWrap.hidden = true;
  timerWrap.style.display = "none";
  coachButton.hidden = true;
  coachButton.disabled = true;

  if (browser || !topic) {
    setHudText(
      { grade: "G", q: "MODE", points: "TOPIC" },
      { grade: String(state.grade), q: "LEARN", points: `${topics.length}` }
    );
    return;
  }

  setHudText(
    { grade: "G", q: "MODE", points: "STEP" },
    {
      grade: String(state.grade),
      q: "LEARN",
      points: `${state.guidedStepIndex + 1}/${topic.stages.length}`
    }
  );
}

function setGuidedValue(key: string, value: number | string): void {
  state.guidedValues = { ...state.guidedValues, [key]: value };

  if ("parts" in state.guidedValues && "shaded" in state.guidedValues) {
    const maxShaded = Math.max(1, Math.min(Number(state.guidedValues.parts), 2));
    state.guidedValues.shaded = Math.max(1, Math.min(Number(state.guidedValues.shaded), maxShaded));
  }

  renderGuidedStage();
}

function applyGuidedChoiceLayout(): void {
  const container = qs<HTMLElement>("#guided-choice-options");
  const buttons = [...container.querySelectorAll<HTMLElement>(".guided-choice-option")];
  chooseOptionLayout(container, buttons, !qs<HTMLElement>("#guided-visual").hidden, true);
}

function renderGuidedTopicBrowser(): void {
  hideCoach();
  hideLearnPanel();
  resetGuidedState();
  setQuestionSolveView(true);
  const card = qs<HTMLElement>(".question-card");
  card.scrollTop = 0;
  setPreferredScrollTarget(card);
  qs<HTMLElement>("#question-meta").style.display = "none";
  qs<HTMLElement>("#guided-panel").hidden = true;
  const browser = qs<HTMLElement>("#topic-browser");
  browser.hidden = false;
  updateHudForGuidedLearn(true);

  const topics = listGuidedTopics(state.grade);
  browser.innerHTML = `
    <div class="topic-browser-intro">
      Pick one concept. Move the sliders, watch the picture change, answer a quick check, then move to the next step.
    </div>
  `;

  topics.forEach((topic) => {
    const button = document.createElement("button");
    button.className = "topic-card";
    button.type = "button";
    button.innerHTML = `
      <div class="topic-card-title">${topic.title}</div>
      <div class="topic-card-summary">${topic.summary}</div>
      <div class="topic-card-skills">${topic.skills.map((skill) => skill.replaceAll("_", " ")).join(" · ")}</div>
    `;
    button.addEventListener("click", () => startGuidedTopic(topic.id));
    browser.appendChild(button);
  });

  armScrollRailPulse();
  scheduleRailRefresh();
}

function renderGuidedStage(): void {
  const topic = currentGuidedTopic();
  const stage = currentGuidedStage();
  if (!topic || !stage) {
    renderGuidedTopicBrowser();
    return;
  }

  hideCoach();
  hideLearnPanel();
  setQuestionSolveView(true);

  const browser = qs<HTMLElement>("#topic-browser");
  const panel = qs<HTMLElement>("#guided-panel");
  const card = qs<HTMLElement>(".question-card");
  browser.hidden = true;
  panel.hidden = false;
  card.scrollTop = 0;
  setPreferredScrollTarget(card);

  updateHudForGuidedLearn(false);
  qs<HTMLElement>("#question-meta").style.display = "none";
  qs<HTMLElement>("#guided-topic-title").textContent = topic.title;
  qs<HTMLElement>("#guided-step-index").textContent = `${state.guidedStepIndex + 1}/${topic.stages.length}`;
  qs<HTMLElement>("#guided-step-title").textContent = stage.title;
  qs<HTMLElement>("#guided-step-body").textContent = stage.body(state.guidedValues);
  qs<HTMLElement>("#guided-derivation").textContent = stage.derivation(state.guidedValues);

  const visual = stage.visual(state.guidedValues);
  const guidedVisual = qs<HTMLElement>("#guided-visual");
  guidedVisual.innerHTML = visual.svg;
  guidedVisual.setAttribute("aria-label", visual.altText);
  guidedVisual.hidden = false;

  const controls = qs<HTMLElement>("#guided-controls");
  controls.innerHTML = "";
  (stage.controls || []).forEach((control) => {
    const wrap = document.createElement("div");
    wrap.className = "guided-control";

    if (control.kind === "range") {
      const current = Number(state.guidedValues[control.key] ?? control.min);
      wrap.innerHTML = `
        <div class="guided-control-top">
          <span class="guided-control-label">${control.label}</span>
          <span class="guided-control-value">${control.formatter ? control.formatter(current) : current}</span>
        </div>
      `;
      const input = document.createElement("input");
      input.className = "guided-control-range";
      input.type = "range";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step || 1);
      input.value = String(current);
      input.addEventListener("input", () => setGuidedValue(control.key, Number(input.value)));
      wrap.appendChild(input);
    } else {
      wrap.innerHTML = `
        <div class="guided-control-top">
          <span class="guided-control-label">${control.label}</span>
        </div>
      `;
      const row = document.createElement("div");
      row.className = "guided-toggle-row";
      control.options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "guided-toggle-btn";
        button.textContent = option.label;
        button.classList.toggle("active", state.guidedValues[control.key] === option.value);
        button.addEventListener("click", () => setGuidedValue(control.key, option.value));
        row.appendChild(button);
      });
      wrap.appendChild(row);
    }

    controls.appendChild(wrap);
  });

  const prompt = qs<HTMLElement>("#guided-choice-prompt");
  const options = qs<HTMLElement>("#guided-choice-options");
  const feedback = qs<HTMLElement>("#guided-choice-feedback");
  const hasCheck = Boolean(stage.prompt && stage.options && stage.correctIndex);

  if (hasCheck) {
    prompt.hidden = false;
    prompt.textContent = stage.prompt!(state.guidedValues);
    options.hidden = false;
    options.innerHTML = "";
    const optionValues = stage.options!(state.guidedValues);
    const correctIndex = stage.correctIndex!(state.guidedValues);
    optionValues.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guided-choice-option";
      button.textContent = option;
      if (state.guidedSelectedIndex === index) {
        if (state.guidedStepResolved && index !== correctIndex) {
          button.classList.add("wrong");
        } else if (!state.guidedStepResolved && state.guidedFeedbackTone === "retry") {
          button.classList.add("wrong");
        }
      }
      if (state.guidedStepResolved && index === correctIndex) button.classList.add("correct");
      button.disabled = state.guidedStepResolved;
      button.addEventListener("click", () => onGuidedChoice(index));
      options.appendChild(button);
    });

    feedback.hidden = !state.guidedFeedback;
    feedback.textContent = state.guidedFeedback;
    feedback.className = `guided-choice-feedback${state.guidedFeedbackTone ? ` ${state.guidedFeedbackTone}` : ""}`;
    scheduleRailRefresh(() => applyGuidedChoiceLayout());
  } else {
    prompt.hidden = true;
    options.hidden = true;
    options.innerHTML = "";
    options.removeAttribute("data-layout");
    feedback.hidden = true;
    feedback.textContent = "";
  }

  const nextButton = qs<HTMLButtonElement>("#guided-next");
  const isLast = state.guidedStepIndex >= topic.stages.length - 1;
  nextButton.textContent = isLast ? "DONE" : "NEXT";
  nextButton.disabled = hasCheck && !state.guidedStepResolved;

  armScrollRailPulse();
  scheduleRailRefresh();
}

function startGuidedTopic(topicId: GuidedTopicId): void {
  const topic = getGuidedTopic(state.grade, topicId);
  if (!topic) return;
  state.guidedTopicId = topicId;
  state.guidedStepIndex = 0;
  state.guidedValues = { ...topic.initialValues };
  state.guidedStepResolved = !(topic.stages[0]?.prompt && topic.stages[0]?.options && topic.stages[0]?.correctIndex);
  state.guidedStepAttempts = 0;
  state.guidedFeedback = "";
  state.guidedFeedbackTone = "";
  state.guidedSelectedIndex = null;
  renderGuidedStage();
}

function onGuidedChoice(index: number): void {
  const stage = currentGuidedStage();
  if (!stage?.prompt || !stage.options || !stage.correctIndex) return;

  const correctIndex = stage.correctIndex(state.guidedValues);
  state.guidedStepAttempts += 1;
  state.guidedSelectedIndex = index;

  if (index === correctIndex) {
    state.guidedStepResolved = true;
    state.guidedFeedback = stage.success?.(state.guidedValues) || "Correct.";
    state.guidedFeedbackTone = "good";
  } else if (state.guidedStepAttempts >= 2) {
    state.guidedStepResolved = true;
    state.guidedFeedback = stage.retry?.(state.guidedValues) || "Use the picture and try again on the next step.";
    state.guidedFeedbackTone = "retry";
  } else {
    state.guidedStepResolved = false;
    state.guidedFeedback = `${stage.retry?.(state.guidedValues) || "Try one more time."} Try once more.`;
    state.guidedFeedbackTone = "retry";
  }

  renderGuidedStage();
}

function advanceGuidedStage(): void {
  const topic = currentGuidedTopic();
  const stage = currentGuidedStage();
  if (!topic || !stage) return;
  if (stage.prompt && stage.options && stage.correctIndex && !state.guidedStepResolved) return;

  if (state.guidedStepIndex >= topic.stages.length - 1) {
    renderGuidedTopicBrowser();
    return;
  }

  state.guidedStepIndex += 1;
  const nextStage = currentGuidedStage();
  state.guidedStepResolved = !(nextStage?.prompt && nextStage?.options && nextStage?.correctIndex);
  state.guidedStepAttempts = 0;
  state.guidedFeedback = "";
  state.guidedFeedbackTone = "";
  state.guidedSelectedIndex = null;
  renderGuidedStage();
}

function speakCurrentGuidedStage(): void {
  const stage = currentGuidedStage();
  const topic = currentGuidedTopic();
  if (!stage || !topic) return;
  const pieces = [
    topic.title,
    stage.title,
    stage.speak ? stage.speak(state.guidedValues) : stage.body(state.guidedValues)
  ];
  if (stage.prompt) pieces.push(stage.prompt(state.guidedValues));
  speakCoach(pieces.join(". "));
}

function totalQuestionsInRun(): number {
  if ((state.mode === "practice" || state.mode === "learn") && state.practiceSession) return state.practiceSession.total;
  return state.questions.length;
}

function startTimer(): void {
  clearTimer();
  state.timeLeft = 75 * 60;
  qs<HTMLElement>("#hud-time").textContent = toTimeLabel(state.timeLeft);
  state.timerId = window.setInterval(() => {
    state.timeLeft -= 1;
    qs<HTMLElement>("#hud-time").textContent = toTimeLabel(Math.max(0, state.timeLeft));
    if (state.timeLeft <= 0) {
      clearTimer();
      endGame();
    }
  }, 1000);
}

function currentQuestion(): QuestionInstance | null {
  if (!state.questions[state.index]) return null;
  return state.questions[state.index];
}

function speakCoach(text: string): number {
  return tts.speak(text);
}

function pauseQuestionClock(): void {
  if (state.questionPauseDepth === 0) {
    state.questionPausedAtMs = Date.now();
  }
  state.questionPauseDepth += 1;
}

function resumeQuestionClock(): void {
  if (state.questionPauseDepth === 0) return;
  state.questionPauseDepth -= 1;
  if (state.questionPauseDepth === 0 && state.questionPausedAtMs !== null) {
    state.questionPauseMs += Date.now() - state.questionPausedAtMs;
    state.questionPausedAtMs = null;
  }
}

function activeQuestionElapsedMs(): number {
  let paused = state.questionPauseMs;
  if (state.questionPausedAtMs !== null) {
    paused += Date.now() - state.questionPausedAtMs;
  }
  return Math.max(0, Date.now() - state.questionStartedAtMs - paused);
}

type HelpView = {
  title: string;
  body: string;
  speakText: string;
  canSpeak: boolean;
};

function buildHelpView(question: QuestionInstance, mode: HelpMode): HelpView {
  const coach = getDeterministicCoach(question, state.lastAnswerCorrect === true);
  const answer = question.options[question.answerIndex];
  if (mode === "hint") {
    const hint = question.strategyTags.length
      ? `${coach.hint} Focus on ${question.strategyTags.slice(0, 2).join(" and ")}.`
      : coach.hint;
    const trap = question.trapWarning || coach.errorDiagnosis;
    return {
      title: "Hint",
      body: `${hint}\n\nWatch for: ${trap}`,
      speakText: `${hint} Watch for this trap. ${trap}`,
      canSpeak: true
    };
  }

  if (mode === "steps") {
    const stepBody = [
      `1. ${coach.hint}`,
      `2. ${coach.speedTactic}`,
      "3. Compare the choices before tapping."
    ].join("\n");
    return {
      title: "Steps",
      body: stepBody,
      speakText: `${coach.hint} Then ${coach.speedTactic} Finally compare the choices before tapping.`,
      canSpeak: true
    };
  }

  if (!state.answeredCurrent) {
    return {
      title: "Why",
      body: "Answer first. Then WHY will explain the result.",
      speakText: "",
      canSpeak: false
    };
  }

  const explainLead = state.lastAnswerCorrect ? "Nice work." : `The correct answer is ${answer}.`;
  return {
    title: "Why",
    body: `${explainLead}\n\n${question.explanation}`,
    speakText: `${explainLead} ${question.explanation}`,
    canSpeak: true
  };
}

function fitQuestionText(node: HTMLElement, text: string, hasVisual: boolean): void {
  const length = text.length;
  if (hasVisual) {
    if (length > 100) {
      node.style.fontSize = "12px";
      return;
    }
    if (length > 60) {
      node.style.fontSize = "13px";
      return;
    }
    node.style.fontSize = "14px";
    return;
  }
  if (length > 150) {
    node.style.fontSize = "15px";
    return;
  }
  if (length > 95) {
    node.style.fontSize = "16px";
    return;
  }
  if (length > 60) {
    node.style.fontSize = "17px";
    return;
  }
  node.style.fontSize = "19px";
}

function fitOptionText(node: HTMLButtonElement, text: string): void {
  const length = text.length;
  if (length > 18) {
    node.style.fontSize = "10px";
    return;
  }
  if (length > 12) {
    node.style.fontSize = "11px";
    return;
  }
  if (length > 8) {
    node.style.fontSize = "13px";
    return;
  }
  node.style.fontSize = "14px";
}

function applyQuestionOptionLayout(): void {
  const question = currentQuestion();
  const container = qs<HTMLElement>("#options");
  const buttons = [...container.querySelectorAll<HTMLElement>(".option")];
  chooseOptionLayout(container, buttons, Boolean(question?.visualAssetSpec), false);
}

function applyLearnOptionLayout(): void {
  const container = qs<HTMLElement>("#learn-options");
  const buttons = [...container.querySelectorAll<HTMLElement>(".learn-option")];
  const hasVisual = !qs<HTMLElement>("#learn-visual").hidden;
  chooseOptionLayout(container, buttons, hasVisual, true);
}

function findScrollableFromNode(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  return node.closest<HTMLElement>('[data-scrollable="true"]');
}

function activeScrollTarget(): HTMLElement | null {
  const overlay = document.querySelector<HTMLElement>("#coach-overlay.active");
  if (overlay) {
    return overlay.querySelector<HTMLElement>('[data-scrollable="true"]') || overlay;
  }

  if (preferredScrollTarget && preferredScrollTarget.isConnected) return preferredScrollTarget;

  const active = document.querySelector<HTMLElement>(".screen.active");
  if (!active) return null;

  if (active.id === "game-screen") return defaultScrollTargetForScreen("game");
  if (active.id === "result-screen") return defaultScrollTargetForScreen("result");
  return defaultScrollTargetForScreen("home");
}

function scrollActiveScreen(deltaY: number): void {
  const target = activeScrollTarget();
  if (!target) return;
  const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
  if (maxScroll <= 0) return;
  const nextTop = Math.max(0, Math.min(maxScroll, target.scrollTop + deltaY));
  if (nextTop === target.scrollTop) return;
  target.scrollTop = nextTop;
  clearScrollRailPulse();
  setPreferredScrollTarget(target);
  if (target.matches("#game-screen .question-card")) updateScrollRail();
}

function bindScrollableFallbacks(): void {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const scrollable = findScrollableFromNode(event.target);
      if (scrollable) setPreferredScrollTarget(scrollable);
    },
    { passive: true }
  );

  document.addEventListener(
    "touchstart",
    (event) => {
      const scrollable = findScrollableFromNode(event.target);
      if (!scrollable || scrollable.scrollHeight <= scrollable.clientHeight + 2) {
        touchScrollState.target = null;
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      setPreferredScrollTarget(scrollable);
      touchScrollState = {
        target: scrollable,
        startY: touch.clientY,
        startScrollTop: scrollable.scrollTop
      };
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      const target = touchScrollState.target;
      if (!touch || !target) return;
      const delta = touch.clientY - touchScrollState.startY;
      if (Math.abs(delta) < 3) return;
      target.scrollTop = touchScrollState.startScrollTop - delta;
      if (target.matches("#game-screen .question-card")) {
        clearScrollRailPulse();
        updateScrollRail();
      }
      event.preventDefault();
    },
    { passive: false }
  );

  const resetTouchScroll = (): void => {
    touchScrollState.target = null;
  };

  document.addEventListener("touchend", resetTouchScroll, { passive: true });
  document.addEventListener("touchcancel", resetTouchScroll, { passive: true });
}

function applyLearnStep(): void {
  if (!state.learnActive || !state.learnFlow?.steps.length) return;
  const card = qs<HTMLElement>(".question-card");
  card.scrollTop = 0;
  setPreferredScrollTarget(card);
  const step = state.learnFlow.steps[state.learnStepIndex];
  qs<HTMLElement>("#learn-step-title").textContent = step.title;
  qs<HTMLElement>("#learn-step-index").textContent = `${state.learnStepIndex + 1}/${state.learnFlow.steps.length}`;
  qs<HTMLElement>("#learn-objective").textContent = step.objective;
  qs<HTMLElement>("#learn-step-body").textContent = step.body;
  const learnVisual = qs<HTMLElement>("#learn-visual");
  learnVisual.innerHTML = step.visualSvg;
  learnVisual.setAttribute("aria-label", step.visualAlt);
  qs<HTMLElement>("#learn-progress-fill").style.width = `${((state.learnStepIndex + 1) / state.learnFlow.steps.length) * 100}%`;

  const prompt = qs<HTMLElement>("#learn-step-prompt");
  const options = qs<HTMLElement>("#learn-options");
  const feedback = qs<HTMLElement>("#learn-feedback");
  feedback.hidden = !state.learnFeedback;
  feedback.textContent = state.learnFeedback;
  feedback.className = `learn-feedback${state.learnFeedbackTone ? ` ${state.learnFeedbackTone}` : ""}`;

  if (step.kind === "check" && step.options && typeof step.correctIndex === "number") {
    prompt.hidden = false;
    prompt.textContent = step.prompt || "";
    options.hidden = false;
    options.innerHTML = "";
    step.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "learn-option";
      if (state.learnSelectedIndex === index && state.learnFeedbackTone === "retry") button.classList.add("wrong");
      if (state.learnStepResolved && index === step.correctIndex) button.classList.add("correct");
      button.textContent = option;
      button.disabled = state.learnStepResolved;
      button.addEventListener("click", () => onLearnChoice(index));
      options.appendChild(button);
    });
    scheduleRailRefresh(() => applyLearnOptionLayout());
  } else {
    prompt.hidden = true;
    options.hidden = true;
    options.innerHTML = "";
    options.removeAttribute("data-layout");
    state.learnAnswerLayoutMode = "grid";
  }

  const nextButton = qs<HTMLButtonElement>("#learn-next");
  const isLast = state.learnStepIndex === state.learnFlow.steps.length - 1;
  nextButton.textContent = isLast
    ? state.learnFlow.mode === "remediation"
      ? "CONTINUE"
      : "START"
    : "NEXT";
  nextButton.disabled = step.kind === "check" && !state.learnStepResolved;
  qs<HTMLButtonElement>("#learn-skip").textContent = state.learnFlow.mode === "remediation" ? "SKIP FIX" : "SKIP LAB";
  armScrollRailPulse();
  scheduleRailRefresh();
}

function currentLearnStep() {
  if (!state.learnActive || !state.learnFlow) return null;
  return state.learnFlow.steps[state.learnStepIndex] || null;
}

function speakCurrentLearnStep(): void {
  const step = currentLearnStep();
  if (!step) return;
  speakCoach(step.speakText);
}

function onLearnChoice(index: number): void {
  const step = currentLearnStep();
  if (!step || step.kind !== "check" || !step.options || typeof step.correctIndex !== "number") return;

  state.learnStepAttempts += 1;
  state.learnSelectedIndex = index;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".learn-option")];
  buttons.forEach((button) => (button.disabled = true));

  if (index === step.correctIndex) {
    buttons[index]?.classList.add("correct");
    state.learnStepResolved = true;
    state.learnFeedback = step.successText || "Correct.";
    state.learnFeedbackTone = "good";
  } else {
    buttons[index]?.classList.add("wrong");
    buttons[step.correctIndex]?.classList.add("correct");
    const maxAttempts = step.maxAttempts || 2;
    state.learnStepResolved = state.learnStepAttempts >= maxAttempts;
    state.learnFeedback = state.learnStepResolved
      ? step.wrongText || "Use the pattern shown and move on."
      : `${step.wrongText || "Try once more."} Try once more.`;
    state.learnFeedbackTone = "retry";
  }

  applyLearnStep();
}

function finishLearnFlow(): void {
  clearLearnTimer();
  const wasRemediation = state.learnFlow?.mode === "remediation";
  state.learnActive = false;
  state.learnFlow = null;
  state.learnStepResolved = true;
  state.learnStepAttempts = 0;
  state.learnFeedback = "";
  state.learnFeedbackTone = "";
  state.learnSelectedIndex = null;
  qs<HTMLElement>("#learn-panel").hidden = true;
  setOptionsEnabled(true);
  resumeQuestionClock();
  armScrollRailPulse();
  scheduleRailRefresh(() => applyQuestionOptionLayout());
  if (wasRemediation) {
    window.setTimeout(next, 180);
  }
}

function advanceLearnStep(): void {
  if (!state.learnActive) return;
  const step = currentLearnStep();
  if (step?.kind === "check" && !state.learnStepResolved) return;
  if (!state.learnFlow || state.learnStepIndex >= state.learnFlow.steps.length - 1) {
    finishLearnFlow();
    return;
  }
  state.learnStepIndex += 1;
  state.learnStepResolved = currentLearnStep()?.kind !== "check";
  state.learnStepAttempts = 0;
  state.learnFeedback = "";
  state.learnFeedbackTone = "";
  state.learnSelectedIndex = null;
  applyLearnStep();
}

function startLabFlow(question: QuestionInstance, mode: "learn" | "remediation"): void {
  clearLearnTimer();
  pauseQuestionClock();
  const coach = getDeterministicCoach(question, false);
  state.learnFlow = buildConceptLab(question, coach, mode);
  state.learnStepIndex = 0;
  state.learnActive = true;
  state.learnStepResolved = state.learnFlow.steps[0]?.kind !== "check";
  state.learnStepAttempts = 0;
  state.learnFeedback = "";
  state.learnFeedbackTone = "";
  state.learnSelectedIndex = null;
  qs<HTMLElement>("#learn-panel").hidden = false;
  setQuestionSolveView(true);
  setOptionsEnabled(false);
  applyLearnStep();
  scheduleRailRefresh();
}

function startLearnFlow(question: QuestionInstance): void {
  startLabFlow(question, "learn");
}

function startRemediationFlow(question: QuestionInstance): void {
  startLabFlow(question, "remediation");
}

function renderQuestion(): void {
  tts.cancelAll();
  hideLearnPanel();
  hideGuidedLessons();
  const q = currentQuestion();
  if (!q) {
    endGame();
    return;
  }

  state.locked = false;
  state.questionStartedAtMs = Date.now();
  state.questionPauseMs = 0;
  state.questionPausedAtMs = null;
  state.questionPauseDepth = 0;
  state.answeredCurrent = false;
  state.lastAnswerCorrect = null;
  const scrollTarget = qs<HTMLElement>(".question-card");
  scrollTarget.scrollTop = 0;
  setPreferredScrollTarget(scrollTarget);

  qs<HTMLElement>("#hud-q").textContent = `${state.index + 1}/${totalQuestionsInRun()}`;
  qs<HTMLElement>("#hud-points").textContent = String(state.score);
  qs<HTMLElement>("#question-meta").textContent = `${q.skillId.replaceAll("_", " ")} · ${q.pointTier} pts`;
  const questionText = qs<HTMLElement>("#question-text");
  questionText.textContent = q.prompt;
  fitQuestionText(questionText, q.prompt, Boolean(q.visualAssetSpec));

  const visual = qs<HTMLElement>("#question-visual");
  if (q.visualAssetSpec) {
    visual.innerHTML = q.visualAssetSpec.svg;
    visual.setAttribute("aria-label", q.visualAssetSpec.altText);
    visual.dataset.kind = q.visualAssetSpec.kind;
    visual.dataset.hasVisual = "true";
    visual.style.display = "block";
  } else {
    visual.innerHTML = "";
    visual.removeAttribute("aria-label");
    delete visual.dataset.kind;
    visual.dataset.hasVisual = "false";
    visual.style.display = "none";
  }

  const options = qs<HTMLElement>("#options");
  options.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const button = document.createElement("button");
    button.className = "option";
    button.textContent = opt;
    fitOptionText(button, opt);
    button.addEventListener("click", () => onAnswer(idx, button));
    options.appendChild(button);
  });

  if (state.mode === "learn") {
    startLearnFlow(q);
  } else {
    armScrollRailPulse();
    qs<HTMLElement>("#learn-panel").hidden = true;
    scheduleRailRefresh(() => applyQuestionOptionLayout());
  }
}

function renderHelpOverlay(question: QuestionInstance): void {
  const title = qs<HTMLElement>("#coach-title");
  const body = qs<HTMLElement>("#coach-body");
  const status = qs<HTMLElement>("#coach-status");
  const sayButton = qs<HTMLButtonElement>("#coach-say");
  const visual = qs<HTMLElement>("#coach-visual");
  const view = buildHelpView(question, state.helpMode);
  const visualSpec =
    state.helpMode === "explain"
      ? question.visualAssetSpec || renderLessonScene(question.skillId, 3)
      : state.helpMode === "steps"
        ? question.visualAssetSpec || renderLessonScene(question.skillId, 2)
        : renderLessonScene(question.skillId, 1);

  title.textContent = view.title;
  body.textContent = view.body;
  body.scrollTop = 0;
  visual.innerHTML = visualSpec.svg;
  visual.setAttribute("aria-label", visualSpec.altText);
  status.textContent = view.canSpeak
    ? "Tap SAY IT or press the side button."
    : "Answer first to unlock WHY.";
  sayButton.disabled = !view.canSpeak;

  for (const button of document.querySelectorAll<HTMLButtonElement>(".coach-mode-btn")) {
    button.classList.toggle("active", button.dataset.helpMode === state.helpMode);
  }
}

function speakActiveHelp(): void {
  const question = currentQuestion();
  if (!question) return;
  const view = buildHelpView(question, state.helpMode);
  if (!view.canSpeak) return;
  speakCoach(view.speakText);
}

function showCoach(question: QuestionInstance, mode: HelpMode): void {
  const overlay = qs<HTMLElement>("#coach-overlay");
  tts.cancelAll();
  state.helpMode = mode;
  pauseQuestionClock();
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  renderHelpOverlay(question);
  setPreferredScrollTarget(qs<HTMLElement>("#coach-body"));
  scheduleRailRefresh();
}

function hideCoach(): void {
  const overlay = qs<HTMLElement>("#coach-overlay");
  tts.cancelAll();
  overlay.classList.remove("active");
  overlay.setAttribute("aria-hidden", "true");
  resumeQuestionClock();
  const screen = document.querySelector<HTMLElement>(".screen.active");
  if (screen?.id === "game-screen") {
    setPreferredScrollTarget(defaultScrollTargetForScreen("game"));
  }
  scheduleRailRefresh();
}

function setHelpMode(mode: HelpMode): void {
  state.helpMode = mode;
  const question = currentQuestion();
  if (!question) return;
  renderHelpOverlay(question);
}

function next(): void {
  hideCoach();
  clearLearnTimer();
  if (
    (state.mode === "practice" || state.mode === "learn") &&
    state.grade <= 2 &&
    state.practiceSession &&
    state.index + 1 < state.practiceSession.total &&
    state.questions.length <= state.index + 1
  ) {
    state.questions.push(nextQuestion(state.practiceSession, state.profile));
  }
  state.index += 1;
  if (state.index >= totalQuestionsInRun()) {
    endGame();
    return;
  }
  renderQuestion();
}

function onAnswer(index: number, button: HTMLButtonElement): void {
  if (state.locked) return;
  state.locked = true;

  const q = currentQuestion();
  if (!q) return;

  const isCorrect = q.answerIndex === index;
  const responseMs = activeQuestionElapsedMs();
  state.answeredCurrent = true;
  state.lastAnswerCorrect = isCorrect;

  for (const opt of document.querySelectorAll<HTMLButtonElement>(".option")) {
    opt.disabled = true;
  }

  if (isCorrect) {
    state.score += q.pointTier;
    state.correct += 1;
    button.classList.add("correct");
  } else {
    button.classList.add("wrong");
    const options = [...document.querySelectorAll<HTMLButtonElement>(".option")];
    if (options[q.answerIndex]) options[q.answerIndex].classList.add("correct");
  }

  if ((state.mode === "practice" || state.mode === "learn") && state.practiceSession) {
    recordAttempt(state.practiceSession, state.profile, q, isCorrect, responseMs);
    void saveProfileAsync(state.profile);
  }

  qs<HTMLElement>("#hud-points").textContent = String(state.score);

  if ((state.mode === "practice" || state.mode === "learn") && !isCorrect) {
    startRemediationFlow(q);
    return;
  }

  setTimeout(next, 600);
}

function prepareQuestions(): void {
  if (state.grade <= 2) {
    if (state.mode === "contest") {
      state.questions = buildContestQuestions(state.grade);
      state.stageLabel = "Contest";
      state.practiceSession = null;
      return;
    }

    if (state.mode === "learn") {
      state.questions = [];
      state.stageLabel = "Learn";
      state.practiceSession = null;
      return;
    }

    const provider = createPracticeProvider(state.grade as 1 | 2);
    setPracticeQuestionProvider({
      pickAny: (grade, avoidHashes, pointTier) => provider.pickAny(avoidHashes, pointTier),
      pickBySkill: (grade, skillId, avoidHashes, pointTier) => provider.pickBySkill(skillId, avoidHashes, pointTier),
      pickByFamily: (grade, skillId, familyId, avoidHashes, pointTier) =>
        provider.pickByFamily(skillId, familyId, avoidHashes, pointTier),
      allSkills: (grade) => allGrade12Skills(grade),
      allFamilies: (grade, skillId) => provider.allFamilies(skillId)
    });

    state.practiceSession = startPracticeSession(state.profile, state.grade as 1 | 2);
    state.stageLabel =
      state.mode === "learn"
        ? `Learn ${state.practiceSession.stage}`
        : `Practice ${state.practiceSession.stage}`;
    state.questions = [nextQuestion(state.practiceSession, state.profile)];
    return;
  }

  state.questions = buildLegacyContestQuestions(state.grade);
  state.stageLabel = state.mode === "contest" ? "Contest" : state.mode === "learn" ? "Learn" : "Practice";
  state.practiceSession = null;
}

function startGame(): void {
  clearTimer();
  clearLearnTimer();
  hideCoach();
  hideLearnPanel();
  hideGuidedLessons();

  state.index = 0;
  state.score = 0;
  state.correct = 0;
  state.locked = false;
  state.startedAtMs = Date.now();
  state.helpMode = "hint";
  state.answeredCurrent = false;
  state.lastAnswerCorrect = null;

  prepareQuestions();

  const timerWrap = qs<HTMLElement>("#hud-timer-wrap");
  const coachButton = qs<HTMLButtonElement>("#coach-btn");
  if (isGuidedLearnMode()) {
    clearTimer();
    timerWrap.hidden = true;
    timerWrap.style.display = "none";
    coachButton.disabled = true;
    coachButton.hidden = true;
    hideActionHint();
    setScreen("game");
    renderGuidedTopicBrowser();
    return;
  }

  setHudText(
    { grade: "G", q: "Q", points: "PTS", time: "T" },
    { grade: String(state.grade), q: `1/${totalQuestionsInRun()}`, points: "0" }
  );
  qs<HTMLElement>("#hud-grade").textContent = String(state.grade);
  qs<HTMLElement>("#hud-points").textContent = "0";
  qs<HTMLElement>("#hud-q").textContent = `1/${totalQuestionsInRun()}`;

  if (state.mode === "contest") {
    timerWrap.hidden = false;
    timerWrap.style.display = "flex";
    coachButton.disabled = true;
    coachButton.hidden = true;
    hideActionHint();
    startTimer();
  } else {
    timerWrap.hidden = true;
    timerWrap.style.display = "none";
    coachButton.disabled = false;
    coachButton.hidden = false;
  }

  setScreen("game");
  if (state.mode !== "contest") maybeShowActionHint();
  renderQuestion();
}

function endGame(): void {
  clearTimer();
  clearLearnTimer();
  hideCoach();
  hideLearnPanel();
  hideGuidedLessons();

  if ((state.mode === "practice" || state.mode === "learn") && state.practiceSession) {
    finalizePracticeSession(state.practiceSession, state.profile);
    void saveProfileAsync(state.profile);
  }

  const total = state.questions.length || 1;
  const runTotal = totalQuestionsInRun() || 1;
  const accuracy = Math.round((state.correct / runTotal) * 100);

  qs<HTMLElement>("#res-score").textContent = `${state.score}`;
  qs<HTMLElement>("#res-correct").textContent = `${state.correct}/${runTotal}`;
  qs<HTMLElement>("#res-accuracy").textContent = `${accuracy}%`;
  qs<HTMLElement>("#res-stage").textContent = `Mode: ${state.stageLabel}`;

  const misses: Record<string, number> = {};
  for (const answer of state.practiceSession?.answered || []) {
    if (!answer.correct) misses[answer.skillId] = (misses[answer.skillId] || 0) + 1;
  }
  const focus = Object.entries(misses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill]) => skill.replaceAll("_", " "));
  qs<HTMLElement>("#res-focus").textContent = focus.length
    ? `Focus next: ${focus.join(", ")}`
    : "Focus next: keep pace and maintain accuracy.";

  setScreen("result");
}

function exitHome(): void {
  clearTimer();
  clearLearnTimer();
  hideCoach();
  hideLearnPanel();
  hideGuidedLessons();
  hideActionHint();
  setScreen("home");
}

function renderAppToText(): string {
  const activeScreen = document.querySelector<HTMLElement>(".screen.active")?.id || "unknown";
  const question = currentQuestion();
  const scrollTarget = activeScrollTarget();
  return JSON.stringify({
    screen: activeScreen,
    mode: state.mode,
    theme: state.theme,
    grade: state.grade,
    index: state.index + 1,
    total: totalQuestionsInRun(),
    question: question?.prompt || "",
    options: question?.options || [],
    learnActive: state.learnActive,
    guidedTopic: currentGuidedTopic()?.title || "",
    guidedStep: currentGuidedStage()?.title || "",
    learnStep: currentLearnStep()?.title || "",
    learnPrompt: currentLearnStep()?.prompt || "",
    answerLayoutMode: state.answerLayoutMode,
    learnAnswerLayoutMode: state.learnAnswerLayoutMode,
    helpOpen: qs<HTMLElement>("#coach-overlay").classList.contains("active"),
    scrollTop: scrollTarget?.scrollTop ?? 0,
    scrollHeight: scrollTarget?.scrollHeight ?? 0,
    clientHeight: scrollTarget?.clientHeight ?? 0,
    railVisible: state.scrollRailState.visible,
    railThumbTop: state.scrollRailState.thumbTop,
    railThumbHeight: state.scrollRailState.thumbHeight
  });
}

function wireUi(): void {
  syncViewportMetrics();
  bindScrollableFallbacks();
  buildGradeButtons();
  updateModeInfo();
  theme("neon");

  const questionCard = qs<HTMLElement>("#game-screen .question-card");
  const railTrack = qs<HTMLElement>("#scroll-rail-track");
  const railThumb = qs<HTMLElement>("#scroll-rail-thumb");

  qs<HTMLButtonElement>("#start-btn").addEventListener("click", startGame);
  qs<HTMLButtonElement>("#retry-btn").addEventListener("click", startGame);
  qs<HTMLButtonElement>("#quit-btn").addEventListener("click", exitHome);
  qs<HTMLButtonElement>("#home-btn").addEventListener("click", exitHome);
  qs<HTMLElement>("#action-hint").addEventListener("click", hideActionHint);

  for (const button of document.querySelectorAll<HTMLButtonElement>(".btn-theme")) {
    button.addEventListener("click", () => theme((button.dataset.theme || "neon") as "neon" | "gameboy"));
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-mode]")) {
    button.addEventListener("click", () => setMode((button.dataset.mode || "contest") as GameMode));
  }

  qs<HTMLButtonElement>("#coach-btn").addEventListener("click", () => {
    const q = currentQuestion();
    if (!q) return;
    void showCoach(q, "hint");
  });

  qs<HTMLButtonElement>("#coach-hint").addEventListener("click", () => setHelpMode("hint"));
  qs<HTMLButtonElement>("#coach-steps").addEventListener("click", () => setHelpMode("steps"));
  qs<HTMLButtonElement>("#coach-explain").addEventListener("click", () => setHelpMode("explain"));
  qs<HTMLButtonElement>("#coach-say").addEventListener("click", () => speakActiveHelp());

  qs<HTMLButtonElement>("#coach-continue").addEventListener("click", () => {
    hideCoach();
  });

  qs<HTMLButtonElement>("#learn-next").addEventListener("click", () => {
    advanceLearnStep();
  });

  qs<HTMLButtonElement>("#learn-skip").addEventListener("click", () => {
    finishLearnFlow();
  });

  qs<HTMLButtonElement>("#guided-next").addEventListener("click", () => {
    advanceGuidedStage();
  });

  qs<HTMLButtonElement>("#guided-back").addEventListener("click", () => {
    renderGuidedTopicBrowser();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      scrollActiveScreen(SCROLL_STEP);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      scrollActiveScreen(-SCROLL_STEP);
    }
  });

  window.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 2) return;
      scrollActiveScreen(event.deltaY > 0 ? SCROLL_STEP : -SCROLL_STEP);
    },
    { passive: true }
  );

  // Rabbit r1 hardware events used in official plugin-demo.
  window.addEventListener("scrollDown", () => scrollActiveScreen(SCROLL_STEP));
  window.addEventListener("scrollUp", () => scrollActiveScreen(-SCROLL_STEP));
  window.addEventListener("sideClick", () => {
    if (isGuidedLearnMode() && document.querySelector<HTMLElement>("#game-screen.active")) {
      if (currentGuidedTopic()) {
        speakCurrentGuidedStage();
      } else {
        speakCoach("Pick a topic. Move a slider, watch the picture change, then solve the quick check.");
      }
      return;
    }
    if (state.learnActive) {
      speakCurrentLearnStep();
      return;
    }
    if (qs<HTMLElement>("#coach-overlay").classList.contains("active")) {
      speakActiveHelp();
      return;
    }
    if (state.mode === "contest") return;
    const q = currentQuestion();
    if (!q) return;
    void showCoach(q, "hint");
  });

  questionCard.addEventListener("scroll", () => {
    if (questionCard.scrollTop > 1) clearScrollRailPulse();
    updateScrollRail();
  });

  qs<HTMLButtonElement>("#scroll-rail-up").addEventListener("click", () => {
    clearScrollRailPulse();
    scrollActiveScreen(-SCROLL_STEP);
  });

  qs<HTMLButtonElement>("#scroll-rail-down").addEventListener("click", () => {
    clearScrollRailPulse();
    scrollActiveScreen(SCROLL_STEP);
  });

  railTrack.addEventListener("click", (event) => {
    if (event.target === railThumb) return;
    const bounds = railTrack.getBoundingClientRect();
    const localY = event.clientY - bounds.top;
    const thumbMid = state.scrollRailState.thumbTop + state.scrollRailState.thumbHeight / 2;
    clearScrollRailPulse();
    scrollActiveScreen(localY < thumbMid ? -SCROLL_STEP : SCROLL_STEP);
  });

  railThumb.addEventListener("pointerdown", (event) => {
    const card = defaultScrollTargetForScreen("game");
    if (!card || state.scrollRailState.visible === false) return;
    clearScrollRailPulse();
    scrollRailDragState = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: card.scrollTop
    };
    railThumb.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!scrollRailDragState.active || scrollRailDragState.pointerId !== event.pointerId) return;
      const card = defaultScrollTargetForScreen("game");
      if (!card) return;
      const maxScroll = Math.max(0, card.scrollHeight - card.clientHeight);
      if (maxScroll <= 0) return;
      const travel = Math.max(1, railTrack.clientHeight - state.scrollRailState.thumbHeight);
      const deltaRatio = (event.clientY - scrollRailDragState.startY) / travel;
      card.scrollTop = Math.max(0, Math.min(maxScroll, scrollRailDragState.startScrollTop + deltaRatio * maxScroll));
      setPreferredScrollTarget(card);
      updateScrollRail();
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("pointerup", (event) => {
    if (scrollRailDragState.pointerId !== null && scrollRailDragState.pointerId !== event.pointerId) return;
    if (scrollRailDragState.pointerId !== null && railThumb.hasPointerCapture(scrollRailDragState.pointerId)) {
      railThumb.releasePointerCapture(scrollRailDragState.pointerId);
    }
    scrollRailDragState.active = false;
    scrollRailDragState.pointerId = null;
  });

  window.addEventListener("pointercancel", (event) => {
    if (scrollRailDragState.pointerId !== null && scrollRailDragState.pointerId !== event.pointerId) return;
    if (scrollRailDragState.pointerId !== null && railThumb.hasPointerCapture(scrollRailDragState.pointerId)) {
      railThumb.releasePointerCapture(scrollRailDragState.pointerId);
    }
    scrollRailDragState.active = false;
    scrollRailDragState.pointerId = null;
  });

  const onViewportResize = (): void => {
    syncViewportMetrics();
    scheduleRailRefresh();
  };

  window.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener("resize", onViewportResize);
  window.render_game_to_text = renderAppToText;
  window.advanceTime = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
}

async function initializeApp(): Promise<void> {
  wireUi();
  try {
    state.profile = await loadProfileAsync();
  } catch {
    state.profile = loadProfile();
  }
}

void initializeApp();
