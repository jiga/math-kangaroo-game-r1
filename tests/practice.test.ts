import test from "node:test";
import assert from "node:assert/strict";
import type { Grade, PracticeProfile } from "../src/domain/types";
import { allBandSkills, createPracticeProviderForGrade, questionCountForGrade } from "../src/content/bands/index";
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
    families: {},
    recentQuestionHashes: []
  };
}

function wireProvider(grade: Grade): void {
  const provider = createPracticeProviderForGrade(grade);
  setPracticeQuestionProvider({
    pickAny: (g, avoid, tier) => provider.pickAny(avoid, tier),
    pickBySkill: (g, skill, avoid, tier) => provider.pickBySkill(skill, avoid, tier),
    pickByFamily: (g, skill, family, avoid, tier) => provider.pickByFamily(skill, family, avoid, tier),
    allSkills: (g) => allBandSkills(g),
    allFamilies: (g, skill) => provider.allFamilies(skill)
  });
}

test("practice stage starts diagnostic for new learner", () => {
  const profile = emptyProfile();
  wireProvider(3);
  const session = startPracticeSession(profile, 3);
  assert.equal(session.stage, "diagnostic");
  assert.equal(session.total, 24);
});

test("practice stage uses official 30-question mock for grades 5-12", () => {
  const profile = emptyProfile();
  profile.gradeStats["7"] = { sessions: 3, totalAttempts: 0, totalCorrect: 0 };
  wireProvider(7);
  const session = startPracticeSession(profile, 7);
  assert.equal(session.stage, "mock");
  assert.equal(session.total, 30);
});

test("diagnostic practice rotates across skills in an upper band", () => {
  const profile = emptyProfile();
  wireProvider(9);
  const session = startPracticeSession(profile, 9);
  const seenSkills = new Set<string>();
  for (let i = 0; i < 18; i += 1) {
    const q = nextQuestion(session, profile);
    seenSkills.add(q.skillId);
    recordAttempt(session, profile, q, i % 2 === 0, 1800);
  }
  assert.ok(seenSkills.size >= 9);
});

test("practice session increments grade session stats", () => {
  const profile = emptyProfile();
  wireProvider(12);
  const session = startPracticeSession(profile, 12);
  for (let i = 0; i < 8; i += 1) {
    const q = nextQuestion(session, profile);
    recordAttempt(session, profile, q, false, 2200);
  }
  finalizePracticeSession(session, profile);
  assert.equal(profile.gradeStats["12"].sessions, 1);
  assert.equal(profile.gradeStats["12"].totalAttempts, 8);
  assert.equal(profile.gradeStats["12"].totalCorrect, 0);
  assert.ok(profile.skills[session.answered[0].skillId]);
  assert.ok(profile.families[session.answered[0].familyKey]);
});

test("mastery practice revisits weak families", () => {
  const profile = emptyProfile();
  profile.gradeStats["5"] = { sessions: 2, totalAttempts: 10, totalCorrect: 5 };
  wireProvider(5);
  const session = startPracticeSession(profile, 5);
  const first = nextQuestion(session, profile);
  recordAttempt(session, profile, first, false, 1500);
  const second = nextQuestion(session, profile);
  assert.equal(second.skillId, first.skillId);
});

test("question counts stay official by grade", () => {
  assert.equal(questionCountForGrade(3), 24);
  assert.equal(questionCountForGrade(4), 24);
  assert.equal(questionCountForGrade(5), 30);
  assert.equal(questionCountForGrade(12), 30);
});
