import test from "node:test";
import assert from "node:assert/strict";
import type { PracticeProfile } from "../src/domain/types";
import { allGrade12Skills, createPracticeProvider } from "../src/content/g1g2/bank";
import {
  finalizePracticeSession,
  nextQuestion,
  recordAttempt,
  setPracticeQuestionProvider,
  startPracticeSession
} from "../src/engine/practiceEngine";

function emptyProfile(): PracticeProfile {
  return {
    version: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    gradeStats: {},
    skills: {},
    recentQuestionHashes: []
  };
}

test("practice stage starts diagnostic for new learner", () => {
  const profile = emptyProfile();
  const provider = createPracticeProvider(1);
  setPracticeQuestionProvider({
    pickAny: (grade, avoid, tier) => provider.pickAny(avoid, tier),
    pickBySkill: (grade, skill, avoid, tier) => provider.pickBySkill(skill, avoid, tier),
    allSkills: (grade) => allGrade12Skills(grade)
  });

  const session = startPracticeSession(profile, 1);
  assert.equal(session.stage, "diagnostic");

  const seenSkills = new Set<string>();
  for (let i = 0; i < 15; i += 1) {
    const q = nextQuestion(session, profile);
    seenSkills.add(q.skillId);
    recordAttempt(session, profile, q, i % 2 === 0, 1800);
  }

  assert.ok(seenSkills.size >= 10);
});

test("practice session increments grade session stats", () => {
  const profile = emptyProfile();
  const provider = createPracticeProvider(2);
  setPracticeQuestionProvider({
    pickAny: (grade, avoid, tier) => provider.pickAny(avoid, tier),
    pickBySkill: (grade, skill, avoid, tier) => provider.pickBySkill(skill, avoid, tier),
    allSkills: (grade) => allGrade12Skills(grade)
  });

  const session = startPracticeSession(profile, 2);
  for (let i = 0; i < 8; i += 1) {
    const q = nextQuestion(session, profile);
    recordAttempt(session, profile, q, false, 2200);
  }
  finalizePracticeSession(session, profile);

  assert.equal(profile.gradeStats["2"].sessions, 1);
  assert.equal(profile.gradeStats["2"].totalAttempts, 8);
  assert.equal(profile.gradeStats["2"].totalCorrect, 0);
  assert.ok(profile.skills[session.answered[0].skillId]);
});
