import test from "node:test";
import assert from "node:assert/strict";
import type { QuestionInstance } from "../src/domain/types";
import { getDeterministicCoach } from "../src/coach/deterministicCoach";
import { enrichCoachText } from "../src/coach/llmAdapter";

const question: QuestionInstance = {
  id: "q1",
  grade: 1,
  pointTier: 3,
  skillId: "single_digit_add_sub",
  familyId: "fact_fluency",
  format: "text",
  prompt: "3 + 4 = ?",
  options: ["6", "7", "8", "9", "10"],
  answerIndex: 1,
  explanation: "3 + 4 = 7",
  coachPackId: "single_digit_add_sub",
  strategyTags: ["use a known fact", "check the plus sign"],
  trapWarning: "Do not subtract when the sign is plus.",
  variantKey: "vk"
};

test("deterministic coach returns stable pack", () => {
  const coach = getDeterministicCoach(question, false);
  assert.ok(coach.hint.length > 0);
  assert.ok(coach.errorDiagnosis.length > 0);
  assert.ok(coach.speedTactic.length > 0);
  assert.ok(coach.miniExample.length > 0);
});

test("llm adapter falls back when plugin unavailable", async () => {
  const base = getDeterministicCoach(question, false);
  const result = await enrichCoachText(base, {
    grade: 1,
    prompt: question.prompt,
    answer: question.options[question.answerIndex]
  });
  assert.deepEqual(result, base);
});
