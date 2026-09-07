# Optional Tutor: Evidence and SDK Contract

Research checked and integrated source reviewed 2026-09-07. This final review updates documentation only; no code changes, build, deployment, or commit.

## Teaching Evidence

- **Systematic instruction and representations:** The IES/What Works Clearinghouse elementary mathematics intervention guide (2021) gives strong evidence ratings to systematic instruction, clear mathematical language, and well-chosen concrete/semi-concrete representations. Product implication: offer one manageable step and connect a sketch or objects to the question; do not just restate a solution. These are intervention findings, not evidence that this app or AI selection improves contest scores. [IES practice guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/26/Published)
- **Worked examples:** The IES learning-and-memory guide (2007) rates alternating worked solutions with independent problem solving as moderate evidence, as it does combining graphics with verbal descriptions. Product implication: use a separate, vetted example, then have the child try a fresh problem. Do not disguise the current question's answer as a pre-response mini-example. This helper deliberately supplies process scaffolds, not worked solutions. [IES recommendations 2-4](https://ies.ed.gov/ncee/wwc/practiceguide/1)
- **Retrieval and explanation:** The same guide rates re-exposure through quizzes and deep explanatory questions as strong evidence, spacing as moderate, and pre-questions as minimal evidence. Product implication: invite an attempt before feedback, ask how the child decided, and later revisit the concept without help. Reading a hint is not retrieval; an assisted or repeated success is not proof of independent mastery. [IES recommendations 1, 5, and 7](https://ies.ed.gov/ncee/wwc/practiceguide/1)
- **Math Kangaroo USA format:** The individual competition is a 75-minute multiple-choice test: 24 questions for grades 1-4 and 30 for grades 5-12; equal thirds are worth 3, 4, and 5 points. Grades 1-2 therefore share the 24-question format, not a special shorter exam. [Official test FAQ](https://mathkangaroo.org/mks/faqs/about-the-test/)
- **Practice is not the contest:** Official exam instructions prohibit calculators, smartphones, and other aids. Keep this helper in supported practice, not an official exam or a purported unaided assessment. No rank, medal, mastery, or learning-gain guarantees are supported by the above sources. [Official competition-day instructions](https://mathkangaroo.org/mks/resources/math-kangaroo-day-instructions-for-students-and-parents/)

## Verified Rabbit Contract

GitHub `rabbit-hmi-oss/creations-sdk` main resolved to commit `62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0`, committed 2025-09-08. The repository presents documentation and an executable plugin demo, not a versioned LLM client package. The following is based on that current official source, not a guessed callback name or assumed model API. [Repository](https://github.com/rabbit-hmi-oss/creations-sdk)

The official reference and executable Speak demo send serialized JSON through `PluginMessageHandler.postMessage`:

```ts
PluginMessageHandler.postMessage(JSON.stringify({
  message: "Application instruction and data",
  useLLM: true,
  wantsR1Response: false,
  wantsJournalEntry: false
}));
```

`wantsR1Response` controls speaking the LLM response on r1; `wantsJournalEntry` controls the journal entry. Both default to false in the reference, and the tutor explicitly supplies false. This is the built-in Rabbit service: no additional provider, API key, paid-provider integration, or direct network client is added. It is not a claim of offline inference, unlimited service, or zero provider retention. [SDK channel reference](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/reference/creation-triggers.md#1-pluginmessagehandler), [executable Speak demo](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/js/speak.js#L20-L38)

The actual global callback **is** `window.onPluginMessage(envelope)`. The reference specifies JSON in `envelope.data`; the executable Data demo accepts a JSON string or object there and also tries JSON in `envelope.message`. No `onLLMResponse`, event-bus subscription, or transport-level `requestId` echo is documented. The tutor puts its correlation ID inside the instruction and requires the model's JSON to echo it. Missing/incorrect IDs must never be assigned to the only pending request. [Receiving messages](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/reference/creation-triggers.md#receiving-messages-from-server), [app callback](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/js/app.js#L104-L114), [Data response parser](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/js/data.js#L55-L105)

Hardware events are window listeners named `sideClick`, `longPressStart`, `longPressEnd`, `scrollUp`, and `scrollDown`. The reference warns that a double click generates two side clicks roughly 50 ms apart. The reference viewport is 240x282. The helper itself installs no hardware, camera, microphone, sensor, or speech handlers; main owns the explicit side-button actions. [Hardware reference](https://github.com/rabbit-hmi-oss/creations-sdk/blob/62ef8b37de9c8ec74499987eeed1f07b9cfaaaf0/plugin-demo/reference/creation-triggers.md#hardware-button-events)

## Application API

```ts
requestTutorTurn({
  question,                 // QuestionInstance
  intent: "start",          // "start" | "picture" | "check"
  enabled: true,            // omitted/false means deterministic local help
  hasResponded: false,      // check is local until explicitly true
  signal: controller.signal,
  isCurrent: () => isStillTheSameHelpContext(),
  timeoutMs: 2000           // optional; finite values bounded to 1..8000 ms
}): Promise<TutorTurn>

isAITutorAvailable(): boolean
cancelTutorTurn(): void
```

`TutorTurn` includes `text`, `source: "ai" | "local"`, `questionId`, `variantKey`, `requestId`, `intent`, `scaffoldId`, `status`, and `displayable`. Status is `ready`, `disabled`, `unavailable`, `awaiting-response`, `timeout`, `malformed`, `error`, `cancelled`, or `stale`. Only `ready` has an AI-selected scaffold. Every returned string is app-authored, including when `source` is `ai`. `isAITutorAvailable()` only detects a callable bridge; it neither probes the service nor guarantees network, permission, or model availability.

## Integrated Behavior

- Main calls `requestTutorTurn` only from the explicit **Ask the AI tutor** button. Without a bridge the button reads **Give me a thinking prompt** and selects local help. Opening Help or loading a question does not call the model or speak. The introductory copy correctly says the tutor *chooses* a thinking prompt; the result distinguishes a tutor suggestion from a saved prompt.
- HINT maps to `start`; STEPS maps to `picture`. WHY stays deterministic, with its explanation and Listen action locked until the child responds; its AI button is hidden. The API also supports `check`, but the current UI does not invoke that intent.
- Main uses `tutorRequestGeneration`, `isCurrent` (question identity and Help visibility), and `displayable` before replacing Help text via `textContent`. Help-mode changes/closing and question rendering cancel pending tutor delivery; a new request supersedes the old one. The current caller uses the singleton cancellation hook, not an `AbortSignal`.
- Help **Listen** speaks the displayed text only after a separate press (or explicit side-button action). **Listen to the question** passes only the question prompt to TTS and is hidden in mock-exam mode or when audio is unavailable. Unresolved guided checks speak a prediction cue and the question rather than the worked solution. These paths do not autoplay.
- Opening Help before an answer marks the attempt assisted. Help is blocked in mock-exam mode; mock results are described as practice evidence, not a predicted competition rank. Answer feedback is implemented and shown after the child's response.

## Safety and Coexistence

- The model chooses exactly `{requestId, scaffoldId}` from the short, intent-specific candidate list. Exact IDs, field count, string types, and candidate membership are checked. Extra prose, extra JSON fields, mismatched IDs, and conflicting `data`/`message` selections never become displayed text. IDs are correlation markers, not authentication credentials.
- Only the question prompt (bounded to 1,200 characters), grade, intent, responded flag, candidate strings, and correlation ID are sent. Options, answer index, explanation, trap warning, strategy tags, SVG, alt text, child history, and personal data are not sent. Model instructions are defense in depth; the closed text catalogue is the actual output boundary. Even post-response `check` only asks the child to verify reasoning; grading remains deterministic elsewhere.
- The local fallback is always the first vetted scaffold for that context. Correlated malformed replies and send/install errors fall back immediately. Unparseable, oversized (over 4,096 characters), or uncorrelated replies are ignored for tutor completion and eventually time out. Default wait is 2 seconds, capped at 8 seconds; no retries or background polling.
- The callback wrapper is installed lazily and deliberately retained to consume identifiable late tutor replies. Unrelated events retain the previous callback's arguments, receiver, and return value. Tutor-owned replies are not forwarded: `llmAdapter.ts` otherwise accepts ID-less replies when one request is pending. If another owner completely replaces the callback without chaining it, the current tutor request times out; the next explicit request wraps the new owner. A legacy handler installed outside our wrapper can still process events after calling us, so do not initialize legacy enrichment during a tutor turn. This module cannot guarantee safety for other modules' uncorrelated requests.
- Legacy `llmAdapter.ts` rewrites arbitrary coaching text, sends the correct answer, accepts ID-less replies, and detaches the bridge method from its receiver. It has no active call site in `src`; the integrated Help path uses `aiTutor.ts` instead. Keep it out of pre-response Help.
- `audio/ttsQueue.ts` now cancels browser `speechSynthesis` in `cancelAll()` and preserves the mathematical word `function` during normalization; both have regression coverage. The backward-compatible `speak(): number` duration remains an estimate. Rabbit speech still uses an LLM prompt with `wantsR1Response: true`, not a documented exact-text speech API. The inspected contract documents no remote speech/LLM cancellation, verbatim speech guarantee, or completion-duration callback.

## Small Review Findings

- **P2 - Speech instruction conflicts with mathematical vocabulary:** `src/audio/ttsQueue.ts:47` still instructs Rabbit not to mention "functions". Preserving `function` in the input no longer strips the term locally, but does not remove this contradictory instruction. A separate code change should remove the mathematical term from that prohibition.
- **P3 - Deduplication is reported as unavailable audio:** `src/app/main.ts:1159` treats any zero return from `speak()` as unavailable audio, but `src/audio/ttsQueue.ts:34` also returns zero for a repeated utterance within 1,200 ms. A quick second Listen press can therefore show a false availability warning while the first utterance is playing.
- **Residual boundary:** No raw model text or answer metadata enters the validated tutor output path. However, r1 Listen sends text to a speaking LLM without validating the spoken output; prompt instructions alone cannot guarantee it will never solve a question, paraphrase, or speak after navigation. These limits apply even though invocation is explicit and browser cancellation is fixed. This source review is not a live-device guarantee or a complete audit of every local curriculum hint.

## Verification

The final review reran `npm test`: all 227 tests passed, including tutor, TTS, and storage-merge regressions. Full-repo `tsc --noEmit` also passed; the earlier feedback-symbol and storage-test warnings are resolved.

Tutor tests cover official callback shapes, silent transport, excluded answer metadata, opt-in/response gating, fixed candidates, malformed/uncorrelated/late replies, timeouts, bridge failures, callback coexistence, cancellation, and stale context. They use a mocked bridge and fake timers, not a live model. Integrated behavior above was checked in source, not a rebuilt or deployed UI. Physical r1 validation remains necessary for speech behavior, latency, silent tutor responses, and firmware callbacks.
