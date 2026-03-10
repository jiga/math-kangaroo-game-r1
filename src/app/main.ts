import type { Grade, PracticeSession, QuestionInstance } from "../domain/types";
import { toTimeLabel } from "../content/g1g2/helpers";
import { buildContestQuestions, createPracticeProvider, allGrade12Skills } from "../content/g1g2/bank";
import { buildLegacyContestQuestions, totalQuestionsForGrade } from "../legacy/grade3plus";
import { getDeterministicCoach } from "../coach/deterministicCoach";
import { TTSQueue } from "../audio/ttsQueue";
import { loadProfile, loadProfileAsync, saveProfileAsync } from "../storage/profileStore";
import { buildConceptLab, type ConceptLabFlow } from "../learn/conceptLab";
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

const tts = new TTSQueue();
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
  learnSelectedIndex: null
};

function qs<T extends Element>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing selector: ${selector}`);
  return node as T;
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
    info = `Learn · ${total} Q · Concept lab + checks + transfer`;
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
  qs<HTMLElement>("#learn-feedback").hidden = true;
  setQuestionSolveView(false);
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
  setPreferredScrollTarget(target);
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
      if (index === 2) button.classList.add("learn-option-wide");
      if (state.learnSelectedIndex === index && state.learnFeedbackTone === "retry") button.classList.add("wrong");
      if (state.learnStepResolved && index === step.correctIndex) button.classList.add("correct");
      button.textContent = option;
      button.disabled = state.learnStepResolved;
      button.addEventListener("click", () => onLearnChoice(index));
      options.appendChild(button);
    });
  } else {
    prompt.hidden = true;
    options.hidden = true;
    options.innerHTML = "";
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
    if (idx === 4) button.classList.add("option-wide");
    button.textContent = opt;
    fitOptionText(button, opt);
    button.addEventListener("click", () => onAnswer(idx, button));
    options.appendChild(button);
  });

  if (state.mode === "learn") {
    startLearnFlow(q);
  } else {
    qs<HTMLElement>("#learn-panel").hidden = true;
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

  state.index = 0;
  state.score = 0;
  state.correct = 0;
  state.locked = false;
  state.startedAtMs = Date.now();
  state.helpMode = "hint";
  state.answeredCurrent = false;
  state.lastAnswerCorrect = null;

  prepareQuestions();

  qs<HTMLElement>("#hud-grade").textContent = String(state.grade);
  qs<HTMLElement>("#hud-points").textContent = "0";
  qs<HTMLElement>("#hud-q").textContent = `1/${totalQuestionsInRun()}`;

  const timerWrap = qs<HTMLElement>("#hud-timer-wrap");
  const coachButton = qs<HTMLButtonElement>("#coach-btn");
  if (state.mode === "contest") {
    timerWrap.style.display = "flex";
    coachButton.disabled = true;
    startTimer();
  } else {
    timerWrap.style.display = "none";
    coachButton.disabled = false;
  }

  setScreen("game");
  renderQuestion();
}

function endGame(): void {
  clearTimer();
  clearLearnTimer();
  hideCoach();
  hideLearnPanel();

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
    learnStep: currentLearnStep()?.title || "",
    learnPrompt: currentLearnStep()?.prompt || "",
    helpOpen: qs<HTMLElement>("#coach-overlay").classList.contains("active"),
    scrollTop: scrollTarget?.scrollTop ?? 0,
    scrollHeight: scrollTarget?.scrollHeight ?? 0,
    clientHeight: scrollTarget?.clientHeight ?? 0
  });
}

function wireUi(): void {
  syncViewportMetrics();
  bindScrollableFallbacks();
  buildGradeButtons();
  updateModeInfo();
  theme("neon");

  qs<HTMLButtonElement>("#start-btn").addEventListener("click", startGame);
  qs<HTMLButtonElement>("#retry-btn").addEventListener("click", startGame);
  qs<HTMLButtonElement>("#quit-btn").addEventListener("click", exitHome);
  qs<HTMLButtonElement>("#home-btn").addEventListener("click", exitHome);

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

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      scrollActiveScreen(56);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      scrollActiveScreen(-56);
    }
  });

  window.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 2) return;
      scrollActiveScreen(event.deltaY > 0 ? 56 : -56);
    },
    { passive: true }
  );

  // Rabbit r1 hardware events used in official plugin-demo.
  window.addEventListener("scrollDown", () => scrollActiveScreen(56));
  window.addEventListener("scrollUp", () => scrollActiveScreen(-56));
  window.addEventListener("sideClick", () => {
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

  window.addEventListener("resize", syncViewportMetrics);
  window.visualViewport?.addEventListener("resize", syncViewportMetrics);
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
