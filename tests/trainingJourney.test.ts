import test from "node:test";
import assert from "node:assert/strict";
import type { Grade } from "../src/domain/types";
import { allBandSkills, createPracticeProviderForGrade, skillMetaForGrade } from "../src/content/bands/index";
import { compactQuestionContent } from "../src/engine/questionIdentity";
import {
  TRAINING_STORAGE_KEY,
  createTrainingProfile,
  getTrainingSummary,
  loadTrainingProfile,
  normalizeTrainingProfile,
  planMission,
  recordTrainingAttempt,
  saveTrainingProfile,
  type TrainingAttempt,
  type TrainingProfile,
  type TrainingStorage
} from "../src/engine/trainingJourney";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 7, 12);
const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function attempt(overrides: Partial<TrainingAttempt> = {}): TrainingAttempt {
  return {
    grade: 1, skillId: "counting", familyId: "objects", variantKey: "variant-1",
    correct: true, assisted: false, responseMs: 1500, now: NOW, ...overrides
  };
}

function recordMany(attempts: TrainingAttempt[], profile = createTrainingProfile(NOW)): TrainingProfile {
  return attempts.reduce(recordTrainingAttempt, profile);
}

function progress(profile: TrainingProfile, now = profile.updatedAt) {
  return getTrainingSummary(profile, 1, ["counting"], now).skills[0];
}

function memoryStorage(): TrainingStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

async function withStorageGlobals(sdk: unknown, local: unknown, run: () => Promise<void>): Promise<void> {
  const originalSdk = Object.getOwnPropertyDescriptor(globalThis, "creationStorage");
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "creationStorage", { configurable: true, value: sdk });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: local });
  try {
    await run();
  } finally {
    if (originalSdk) Object.defineProperty(globalThis, "creationStorage", originalSdk);
    else Reflect.deleteProperty(globalThis, "creationStorage");
    if (originalLocal) Object.defineProperty(globalThis, "localStorage", originalLocal);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("factory creates a fresh versioned profile with no invented evidence", () => {
  assert.deepEqual(createTrainingProfile(NOW), {
    version: 1, createdAt: NOW, updatedAt: NOW, aspiration: null, grades: {}
  });
  const first = createTrainingProfile(NOW);
  first.grades[1] = { attempts: [] };
  assert.deepEqual(createTrainingProfile(NOW).grades, {});
  const summary = getTrainingSummary(createTrainingProfile(NOW), 1, ["counting"]);
  assert.equal(summary.skills[0].independentAccuracy, null);
  assert.equal(summary.skills[0].status, "unseen");
  assert.equal(summary.rankEvidence, "not-measured");
  assert.equal(summary.nextReviewAt, null);
});

test("recording is immutable and does not retain the caller's mutable attempt object", () => {
  const original = createTrainingProfile(NOW);
  Object.freeze(original.grades);
  Object.freeze(original);
  const input = attempt();
  const updated = recordTrainingAttempt(original, input);
  input.correct = false;
  assert.notEqual(updated, original);
  assert.deepEqual(original.grades, {});
  assert.equal(updated.grades[1]?.attempts[0].correct, true);
});

test("all 12 grades retain independent evidence even when skill, family, and variant IDs match", () => {
  let profile = createTrainingProfile(NOW);
  for (const grade of GRADES) {
    profile = recordTrainingAttempt(profile, attempt({ grade, assisted: grade % 2 === 0 }));
    for (const other of GRADES.filter((candidate) => candidate > grade)) {
      assert.equal(getTrainingSummary(profile, other, ["counting"]).totals.attempts, 0);
    }
  }
  for (const grade of GRADES) {
    const summary = getTrainingSummary(profile, grade, ["counting"]);
    assert.equal(summary.totals.attempts, 1);
    assert.equal(summary.totals.independentAttempts, grade % 2 === 0 ? 0 : 1);
    assert.equal(summary.totals.assistedAttempts, grade % 2 === 0 ? 1 : 0);
  }
});

test("helped correct answers, even across days and variants, do not become mastery", () => {
  const profile = recordMany(Array.from({ length: 12 }, (_, index) => attempt({
    variantKey: `help-${index}`, assisted: true, now: NOW + index * DAY
  })));
  const summary = getTrainingSummary(profile, 1, ["counting"]);
  assert.equal(summary.totals.assistedCorrect, 12);
  assert.equal(summary.totals.independentCorrect, 0);
  assert.equal(summary.skills[0].distinctIndependentVariants, 0);
  assert.equal(summary.skills[0].successfulReviewDays, 0);
  assert.equal(summary.skills[0].reviewStage, 0);
  assert.equal(summary.masteredSkills, 0);
  assert.equal(summary.diagnostic.coveredSkills, 0);
  assert.equal(summary.diagnostic.encounteredSkills, 1);
  assert.equal(summary.diagnostic.complete, false);
});

test("same-day correct variants never advance spacing or establish mastery", () => {
  const profile = recordMany(Array.from({ length: 10 }, (_, index) => attempt({
    variantKey: `fresh-${index}`, now: NOW + index * 1000
  })));
  assert.equal(progress(profile).independentCorrect, 10);
  assert.equal(progress(profile).reviewStage, 0);
  assert.equal(progress(profile).nextReviewAt, NOW + DAY);
  assert.equal(progress(profile).mastered, false);
});

test("a new UTC day before the 24-hour due time is not successful retrieval", () => {
  const late = Date.UTC(2026, 8, 7, 23, 59);
  const profile = recordMany([
    attempt({ now: late }),
    attempt({ variantKey: "next-day", now: late + 120_000 })
  ]);
  assert.equal(progress(profile).independentSuccessDays, 2);
  assert.equal(progress(profile).successfulReviewDays, 0);
  assert.equal(progress(profile).nextReviewAt, late + DAY);
});

test("review is due at the exact boundary and extends 1, 3, 7, 14, then 30 days", () => {
  let profile = recordMany([attempt()]);
  assert.equal(progress(profile, NOW + DAY - 1).status, "developing");
  assert.equal(progress(profile, NOW + DAY).status, "review-due");
  const retrievalDays = [1, 4, 11, 25, 55];
  const nextDays = [4, 11, 25, 55, 85];
  for (let index = 0; index < retrievalDays.length; index += 1) {
    profile = recordTrainingAttempt(profile, attempt({ variantKey: `review-${index}`, now: NOW + retrievalDays[index] * DAY }));
    const skill = progress(profile);
    assert.equal(skill.nextReviewAt, NOW + nextDays[index] * DAY);
    assert.equal(skill.reviewStage, Math.min(index + 1, 4));
    assert.equal(skill.successfulReviewDays, index + 1);
  }
  assert.equal(progress(profile).mastered, true);
});

test("mastery needs three distinct independent successes and a successful later due review", () => {
  let profile = recordMany([attempt(), attempt({ variantKey: "review", now: NOW + DAY })]);
  assert.equal(progress(profile).mastered, false);
  profile = recordTrainingAttempt(profile, attempt({ variantKey: "transfer", familyId: "groups", now: NOW + DAY + 1000 }));
  assert.equal(progress(profile).mastered, true);
  assert.equal(progress(profile).distinctIndependentVariants, 3);
  assert.equal(progress(profile).distinctIndependentFamilies, 2);
  assert.equal(progress(profile).nextReviewAt, NOW + 4 * DAY);
  assert.equal(planMission(profile, 1, ["counting"]).steps[0].pointTier, 5);
});

test("multi-family metadata requires independent success in a second family for mastery", () => {
  const metadata = [{ skillId: "counting", familyIds: ["objects", "groups"] }];
  let profile = recordMany([
    attempt(),
    attempt({ variantKey: "second", now: NOW + 1000 }),
    attempt({ variantKey: "retrieved", now: NOW + DAY })
  ]);
  const singleFamily = getTrainingSummary(profile, 1, metadata);
  assert.equal(singleFamily.skills[0].distinctIndependentVariants, 3);
  assert.equal(singleFamily.skills[0].successfulReviewDays, 1);
  assert.equal(singleFamily.skills[0].distinctIndependentFamilies, 1);
  assert.equal(singleFamily.skills[0].mastered, false);
  assert.equal(singleFamily.skills[0].status, "developing");
  assert.equal(singleFamily.masteredSkills, 0);
  assert.equal(planMission(profile, 1, ["counting"], { skillMeta: metadata }).steps[0].pointTier, 4);

  profile = recordTrainingAttempt(profile, attempt({
    familyId: "groups", variantKey: "helped-transfer", assisted: true, now: NOW + DAY + 1000
  }));
  assert.equal(getTrainingSummary(profile, 1, metadata).skills[0].distinctIndependentFamilies, 1);
  assert.equal(getTrainingSummary(profile, 1, metadata).skills[0].mastered, false);

  profile = recordTrainingAttempt(profile, attempt({
    familyId: "groups", variantKey: "independent-transfer", now: NOW + DAY + 2000
  }));
  const transferred = getTrainingSummary(profile, 1, metadata);
  assert.equal(transferred.skills[0].distinctIndependentFamilies, 2);
  assert.equal(transferred.skills[0].mastered, true);
  assert.equal(transferred.skills[0].status, "mastered");
  assert.equal(transferred.masteredSkills, 1);
  assert.equal(planMission(profile, 1, metadata).steps[0].pointTier, 5);
  assert.match(transferred.evidenceNote, /2 distinct families/);
});

test("string-only and single distinct family metadata retain the one-family mastery default", () => {
  const profile = recordMany([
    attempt(),
    attempt({ variantKey: "second", now: NOW + 1000 }),
    attempt({ variantKey: "retrieved", now: NOW + DAY })
  ]);
  assert.equal(getTrainingSummary(profile, 1, ["counting"]).skills[0].mastered, true);
  for (const familyIds of [undefined, [], ["objects"], ["objects", "objects"], ["", "objects", " "]]) {
    const summary = getTrainingSummary(profile, 1, [{ skillId: "counting", familyIds }]);
    assert.equal(summary.skills[0].mastered, true);
    assert.equal(summary.skills[0].distinctIndependentFamilies, 1);
  }
});

test("two-family success still requires later-day review and cannot borrow another grade's family", () => {
  const metadata = [{ skillId: "counting", familyIds: ["objects", "groups"] }];
  const sameDay = recordMany([
    attempt(),
    attempt({ familyId: "groups", variantKey: "transfer", now: NOW + 1000 }),
    attempt({ variantKey: "third", now: NOW + 2000 })
  ]);
  assert.equal(getTrainingSummary(sameDay, 1, metadata).skills[0].distinctIndependentFamilies, 2);
  assert.equal(getTrainingSummary(sameDay, 1, metadata).skills[0].mastered, false);

  const isolated = recordMany([
    attempt(),
    attempt({ variantKey: "second", now: NOW + 1000 }),
    attempt({ variantKey: "retrieved", now: NOW + DAY }),
    attempt({ grade: 2, familyId: "groups", variantKey: "other-grade", now: NOW + DAY })
  ]);
  const summary = getTrainingSummary(isolated, 1, metadata);
  assert.equal(summary.skills[0].distinctIndependentFamilies, 1);
  assert.equal(summary.skills[0].mastered, false);
});

test("help at the due time cannot advance or postpone an independent review", () => {
  const profile = recordMany([
    attempt(),
    attempt({ variantKey: "helped-review", assisted: true, now: NOW + DAY })
  ]);
  assert.equal(progress(profile).nextReviewAt, NOW + DAY);
  assert.equal(progress(profile).reviewStage, 0);
  assert.equal(progress(profile).status, "review-due");
});

test("the first independent success after help is learning, not retrieval", () => {
  const profile = recordMany([
    attempt({ assisted: true }),
    attempt({ variantKey: "independent", now: NOW + 5 * DAY })
  ]);
  assert.equal(progress(profile).successfulReviewDays, 0);
  assert.equal(progress(profile).nextReviewAt, NOW + 6 * DAY);
});

test("an independent miss resets earned spacing and mastery, not lifetime evidence", () => {
  let profile = recordMany([
    attempt(), attempt({ variantKey: "second", now: NOW + 1000 }),
    attempt({ variantKey: "retrieved", now: NOW + DAY })
  ]);
  assert.equal(progress(profile).mastered, true);
  profile = recordTrainingAttempt(profile, attempt({ variantKey: "miss", correct: false, now: NOW + 2 * DAY }));
  assert.equal(progress(profile).mastered, false);
  assert.equal(progress(profile).reviewStage, 0);
  assert.equal(progress(profile).nextReviewAt, NOW + 3 * DAY);
  assert.equal(progress(profile).independentCorrect, 3);
  assert.equal(progress(profile).successfulReviewDays, 1);
  assert.equal(progress(profile).status, "needs-help");
});

test("a long absence earns just one retrieval, not credit for missed review days", () => {
  const profile = recordMany([attempt(), attempt({ variantKey: "late-review", now: NOW + 100 * DAY })]);
  assert.equal(progress(profile).successfulReviewDays, 1);
  assert.equal(progress(profile).reviewStage, 1);
  assert.equal(progress(profile).nextReviewAt, NOW + 103 * DAY);
});

test("variant replays cannot inflate totals, upgrade help, repair misses, or satisfy a later review", () => {
  for (const original of [attempt(), attempt({ assisted: true }), attempt({ correct: false })]) {
    const profile = recordMany([original]);
    const replay = recordTrainingAttempt(profile, attempt({ now: NOW + 7 * DAY }));
    assert.equal(replay, profile);
    assert.equal(progress(replay).attempts, 1);
    assert.equal(progress(replay).successfulReviewDays, 0);
  }
});

test("deduplication uses collision-safe skill/family/variant tuples", () => {
  const profile = recordMany([
    attempt({ skillId: "a:b", familyId: "c" }),
    attempt({ skillId: "a", familyId: "b:c" }),
    attempt({ skillId: "__proto__", familyId: "constructor" })
  ]);
  assert.equal(profile.grades[1]?.attempts.length, 3);
  assert.equal(getTrainingSummary(profile, 1, ["__proto__"]).totals.attempts, 1);
});

test("out-of-order recording is chronological and cannot move updatedAt backward", () => {
  const earlier = attempt();
  const later = attempt({ variantKey: "later", now: NOW + DAY });
  const profile = recordMany([later, earlier]);
  assert.deepEqual(profile, recordMany([earlier, later]));
  assert.equal(profile.updatedAt, NOW + DAY);
  assert.equal(progress(profile).successfulReviewDays, 1);
});

test("invalid runtime attempts leave the original profile untouched", () => {
  const profile = createTrainingProfile(NOW);
  const corrupt: unknown[] = [
    null, {}, attempt({ grade: 13 as Grade }), attempt({ skillId: " " }), attempt({ familyId: "" }),
    attempt({ variantKey: "" }), attempt({ responseMs: -1 }), attempt({ responseMs: Infinity }),
    attempt({ now: NaN }), attempt({ now: -1 }), { ...attempt(), assisted: "false" },
    { ...attempt(), correct: 1 }
  ];
  for (const input of corrupt) assert.equal(recordTrainingAttempt(profile, input as TrainingAttempt), profile);
});

test("missions reserve opportunities for unseen, due, and weak skills without repetition", () => {
  const profile = recordMany([
    attempt({ skillId: "due" }),
    attempt({ skillId: "weak", correct: false, now: NOW + DAY - 1000 })
  ]);
  const mission = planMission(profile, 1, ["new", "due", "weak", "four", "five", "six", "seven"], { now: NOW + DAY });
  assert.equal(mission.total, 6);
  assert.equal(mission.steps.length, 6);
  assert.equal(new Set(mission.steps.map((step) => step.skillId)).size, 6);
  assert.ok(mission.steps.some((step) => step.reason === "unseen"));
  assert.ok(mission.steps.some((step) => step.skillId === "due" && step.reason === "due"));
  assert.ok(mission.steps.some((step) => step.skillId === "weak" && step.reason === "weak"));
});

test("a fresh independent miss gets a weak slot even when many developing skills are overdue", () => {
  const developing = Array.from({ length: 8 }, (_, index) => `developing-${index}`);
  const profile = recordMany([
    ...developing.map((skillId) => attempt({ skillId })),
    attempt({ skillId: "struggling", correct: false, now: NOW + DAY - 1 })
  ]);
  const mission = planMission(profile, 1, [...developing, "struggling", "unseen"], { now: NOW + DAY });
  assert.ok(mission.steps.some((step) => step.skillId === "struggling" && step.reason === "weak"));
});

test("diagnostic coverage accumulates over six-question missions instead of restarting", () => {
  const skills = Array.from({ length: 14 }, (_, index) => `skill-${index}`);
  let profile = createTrainingProfile(NOW);
  for (let session = 0; session < 4; session += 1) {
    const mission = planMission(profile, 1, skills);
    assert.equal(mission.total, 6);
    for (const [index, step] of mission.steps.entries()) {
      profile = recordTrainingAttempt(profile, attempt({
        skillId: step.skillId, variantKey: `${session}-${index}`, now: NOW + session * 10_000 + index
      }));
    }
    if (session === 0) assert.equal(getTrainingSummary(profile, 1, skills).diagnostic.coveredSkills, 6);
  }
  const summary = getTrainingSummary(profile, 1, skills);
  assert.equal(summary.diagnostic.coveredSkills, 14);
  assert.equal(summary.diagnostic.complete, true);
  assert.equal(summary.totals.attempts, 24);
  assert.equal(summary.masteredSkills, 0);
});

test("persistent misses cannot trap missions on one skill or starve the wider catalog", () => {
  const skills = Array.from({ length: 10 }, (_, index) => `skill-${index}`);
  let profile = createTrainingProfile(NOW);
  const appearances = new Map<string, number>();
  for (let session = 0; session < 10; session += 1) {
    const mission = planMission(profile, 1, skills);
    assert.equal(new Set(mission.steps.map((step) => step.skillId)).size, 6);
    for (const [index, step] of mission.steps.entries()) {
      appearances.set(step.skillId, (appearances.get(step.skillId) ?? 0) + 1);
      profile = recordTrainingAttempt(profile, attempt({
        skillId: step.skillId, variantKey: `miss-${session}-${index}`, correct: false, now: NOW + session * 100 + index
      }));
    }
  }
  assert.equal(appearances.size, skills.length);
  assert.ok(Math.min(...appearances.values()) >= 4);
});

test("small catalogs still make six balanced steps and empty catalogs produce no fake skill", () => {
  const profile = createTrainingProfile(NOW);
  for (const count of [1, 2, 3, 4, 5]) {
    const skills = Array.from({ length: count }, (_, index) => `skill-${index}`);
    const mission = planMission(profile, 1, skills);
    assert.equal(mission.steps.length, 6);
    for (const skillId of skills) assert.ok(mission.steps.filter((step) => step.skillId === skillId).length <= Math.ceil(6 / count));
    if (count > 1) assert.ok(mission.steps.every((step, index) => index === 0 || step.skillId !== mission.steps[index - 1].skillId));
  }
  assert.deepEqual(planMission(profile, 1, []).steps, []);
  assert.equal(planMission(profile, 1, []).total, 0);
  const summary = getTrainingSummary(profile, 1, []);
  assert.equal(summary.diagnostic.complete, false);
  assert.equal(summary.nextReviewAt, null);
  assert.deepEqual(summary.recommendation.skillIds, []);
});

test("planning is deterministic, deduplicates skill inputs, and cannot record planned coverage", () => {
  const profile = createTrainingProfile(NOW);
  const before = JSON.stringify(profile);
  const inputs = ["counting", "counting", { skillId: "geometry", title: "Shapes" }];
  const first = planMission(profile, 1, inputs);
  const second = planMission(profile, 1, inputs);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(profile), before);
  assert.equal(getTrainingSummary(profile, 1, inputs).diagnostic.totalSkills, 2);
  assert.equal(getTrainingSummary(profile, 1, inputs).diagnostic.coveredSkills, 0);
});

test("metadata provides families and readable titles while avoidance stays grade scoped", () => {
  const profile = recordMany([
    attempt(), attempt({ grade: 2, variantKey: "other-grade" })
  ]);
  const metadata = [{ skillId: "counting", title: "Count objects", familyIds: ["objects", "groups"] }];
  const mission = planMission(profile, 1, ["counting"], { skillMeta: metadata });
  assert.equal(mission.steps[0].familyId, "groups");
  assert.equal(mission.steps[1].familyId, "objects");
  assert.deepEqual(mission.steps[0].avoidVariantKeys, ["variant-1"]);
  mission.steps[0].avoidVariantKeys.push("caller-generated");
  assert.deepEqual(mission.steps[1].avoidVariantKeys, ["variant-1"]);
  assert.equal(getTrainingSummary(profile, 1, metadata).skills[0].title, "Count objects");
});

for (const grade of GRADES) {
  test(`Grade ${grade} mission steps resolve through the existing band provider`, () => {
    const profile = createTrainingProfile(NOW);
    const skills = allBandSkills(grade);
    const provider = createPracticeProviderForGrade(grade);
    const mission = planMission(profile, grade, skills, { skillMeta: skillMetaForGrade(grade) });
    const avoid = new Set<string>();
    assert.equal(mission.total, 6);
    assert.equal(mission.kind, "training");
    for (const step of mission.steps) {
      const question = provider.pickBySkill(step.skillId, avoid, step.pointTier);
      assert.equal(question.grade, grade);
      assert.equal(question.bandId, mission.bandId);
      assert.equal(question.skillId, step.skillId);
      assert.equal(question.pointTier, step.pointTier);
      assert.ok(!avoid.has(question.variantKey));
      avoid.add(question.variantKey);
    }
  });
}

test("rank aspiration is retained as a goal, never manufactured as evidence or automatic contest mode", () => {
  let profile = createTrainingProfile(NOW);
  profile.aspiration = "Aim for a top rank";
  profile = recordMany(Array.from({ length: 30 }, (_, index) => attempt({
    variantKey: `long-run-${index}`, now: NOW + index * 30 * DAY
  })), profile);
  const summary = getTrainingSummary(profile, 1, ["counting"]);
  assert.equal(summary.aspiration, "Aim for a top rank");
  assert.equal(summary.rankEvidence, "not-measured");
  assert.equal(summary.recommendation.kind, "mission");
  assert.equal(planMission(profile, 1, ["counting"]).total, 6);
  assert.equal(planMission(profile, 1, ["counting"]).kind, "training");
  assert.match(summary.evidenceNote, /no rank or score/);
  assert.match(summary.evidenceNote, /explicitly/);
});

test("normalization rejects unknown schemas and legacy global practice mastery", () => {
  for (const value of [undefined, null, [], "junk", 42, {}, { version: 99 }, {
    version: 2, skills: { counting: { correct: 100, attempts: 100 } }
  }]) assert.deepEqual(normalizeTrainingProfile(value, NOW), createTrainingProfile(NOW));
});

test("normalization salvages valid rows, rejects cross-grade pollution, and recomputes evidence", () => {
  const valid = attempt();
  const corrupted = {
    version: 1, createdAt: -1, updatedAt: "tomorrow", aspiration: "  Learn steadily  ",
    grades: {
      "1": { attempts: [attempt({ variantKey: "later", now: NOW + DAY }), valid, valid,
        attempt({ grade: 2, variantKey: "wrong-grade" }), { ...valid, variantKey: "bad-help", assisted: "false" }, null],
      mastered: true, independentCorrect: 999 },
      "2": { attempts: [attempt({ grade: 2, assisted: true })] },
      "3": { attempts: "broken" },
      "13": { attempts: [valid] }
    }
  };
  const normalized = normalizeTrainingProfile(corrupted, NOW);
  assert.deepEqual(Object.keys(normalized.grades), ["1", "2"]);
  assert.equal(normalized.grades[1]?.attempts.length, 2);
  assert.equal(normalized.grades[1]?.attempts[0].now, NOW);
  assert.equal(normalized.updatedAt, NOW + DAY);
  assert.equal(normalized.aspiration, "Learn steadily");
  assert.equal(progress(normalized).independentCorrect, 2);
  assert.equal(progress(normalized).mastered, false);
  assert.equal(getTrainingSummary(normalized, 2, ["counting"]).totals.independentCorrect, 0);
  assert.deepEqual(normalizeTrainingProfile(normalized, NOW), normalized);
  assert.equal(recordTrainingAttempt(normalized, valid), normalized);
});

test("legacy raw and compact fingerprints normalize to one attempt without upgrading helped evidence", () => {
  const raw = JSON.stringify(["objects", "Count the cubes.", "3", "<svg></svg>"]);
  const compact = compactQuestionContent(raw);
  const original = {
    ...createTrainingProfile(NOW),
    grades: { 1: { attempts: [
      attempt({ variantKey: compact, now: NOW + DAY }),
      attempt({ variantKey: raw, assisted: true })
    ] } }
  };
  const normalized = normalizeTrainingProfile(original, NOW);
  assert.equal(normalized.grades[1]?.attempts.length, 1);
  assert.equal(normalized.grades[1]?.attempts[0].variantKey, compact);
  assert.equal(normalized.grades[1]?.attempts[0].assisted, true);
  assert.equal(progress(normalized).independentCorrect, 0);
  assert.equal(progress(normalized).successfulReviewDays, 0);
  assert.equal(original.grades[1].attempts[1].variantKey, raw);
  assert.deepEqual(normalizeTrainingProfile(normalized, NOW), normalized);

  const recorded = recordMany([attempt({ variantKey: raw }), attempt({ variantKey: compact, now: NOW + DAY })]);
  assert.equal(recorded.grades[1]?.attempts.length, 1);
});

test("fingerprint migration hashes the exact original JSON string instead of reserializing it", () => {
  const raw = ' [ "objects", "Count cubes", "3", "" ] ';
  const expected = compactQuestionContent(raw);
  assert.notEqual(expected, compactQuestionContent(JSON.stringify(JSON.parse(raw))));
  assert.equal(recordMany([attempt({ variantKey: raw })]).grades[1]?.attempts[0].variantKey, expected);
});

test("fingerprint migration leaves nonmatching families, non-four-string JSON, and opaque keys unchanged", () => {
  const keys = [
    '["groups","Count cubes","3",""]',
    '["objects","Count cubes","3"]',
    '["objects","Count cubes","3","","extra"]',
    '["objects","Count cubes",3,""]',
    '["objects","Count cubes","3",null]',
    '{"familyId":"objects"}',
    '["objects",',
    'null',
    'variant-1',
    compactQuestionContent('["objects","Count cubes","3",""]')
  ];
  for (const variantKey of keys) {
    const profile = recordMany([attempt({ variantKey })]);
    assert.equal(profile.grades[1]?.attempts[0].variantKey, variantKey);
    assert.equal(normalizeTrainingProfile(profile, NOW).grades[1]?.attempts[0].variantKey, variantKey);
  }
});

test("legacy fingerprint load, compact replay, and persistence round-trip retain exactly one attempt", async () => {
  const raw = JSON.stringify(["objects", "Count the cubes.", "3", ""]);
  const compact = compactQuestionContent(raw);
  const storage = memoryStorage();
  storage.values.set(TRAINING_STORAGE_KEY, JSON.stringify({
    ...createTrainingProfile(NOW),
    grades: { 1: { attempts: [attempt({ variantKey: raw })] } }
  }));
  const loaded = await loadTrainingProfile(storage, NOW);
  assert.equal(loaded.grades[1]?.attempts[0].variantKey, compact);
  assert.equal(recordTrainingAttempt(loaded, attempt({ variantKey: compact, now: NOW + DAY })), loaded);
  assert.equal(recordTrainingAttempt(loaded, attempt({ variantKey: raw, now: NOW + DAY })), loaded);
  assert.equal(await saveTrainingProfile(loaded, storage), true);
  const roundTrip = await loadTrainingProfile(storage, NOW);
  assert.deepEqual(roundTrip, loaded);
  assert.equal(roundTrip.grades[1]?.attempts.length, 1);
  assert.equal(progress(roundTrip).independentCorrect, 1);
  assert.equal(progress(roundTrip).successfulReviewDays, 0);
});

test("summary only counts evidence in the requested skill catalog", () => {
  const profile = recordMany([attempt(), attempt({ skillId: "retired-skill" })]);
  const summary = getTrainingSummary(profile, 1, ["counting"]);
  assert.equal(summary.totals.attempts, 1);
  assert.equal(summary.skills.length, 1);
});

test("invalid grades are rejected rather than silently using the wrong band", () => {
  for (const grade of [0, 13, 1.5, NaN] as Grade[]) {
    assert.throws(() => planMission(createTrainingProfile(NOW), grade, ["counting"]), RangeError);
    assert.throws(() => getTrainingSummary(createTrainingProfile(NOW), grade, ["counting"]), RangeError);
  }
});

test("async persistence round-trips the exact schema using mk_training_v1", async () => {
  const storage = memoryStorage();
  const asynchronous: TrainingStorage = {
    getItem: async (key) => storage.values.get(key) ?? null,
    setItem: async (key, value) => { storage.values.set(key, value); }
  };
  const profile = recordMany([attempt()]);
  assert.equal(await saveTrainingProfile(profile, asynchronous), true);
  assert.deepEqual([...storage.values.keys()], ["mk_training_v1"]);
  assert.deepEqual(await loadTrainingProfile(asynchronous, NOW), profile);
  assert.equal(recordTrainingAttempt(await loadTrainingProfile(asynchronous, NOW), attempt()).grades[1]?.attempts.length, 1);
});

test("corrupt, unavailable, and explicitly disabled storage safely fall back to a fresh profile", async () => {
  const storage = memoryStorage();
  for (const corrupt of ["{oops", "null", "[]", '{"version":999}', "not base64!"]) {
    storage.values.set(TRAINING_STORAGE_KEY, corrupt);
    assert.deepEqual(await loadTrainingProfile(storage, NOW), createTrainingProfile(NOW));
  }
  const unavailable: TrainingStorage = {
    getItem: async () => { throw new Error("offline"); },
    setItem: async () => { throw new Error("quota"); }
  };
  assert.deepEqual(await loadTrainingProfile(unavailable, NOW), createTrainingProfile(NOW));
  assert.equal(await saveTrainingProfile(createTrainingProfile(NOW), unavailable), false);
  assert.deepEqual(await loadTrainingProfile(null, NOW), createTrainingProfile(NOW));
  assert.equal(await saveTrainingProfile(createTrainingProfile(NOW), null), false);
});

test("optional SDK storage uses base64, preserves Unicode goals, and mirrors local storage", async () => {
  const sdk = memoryStorage();
  const local = memoryStorage();
  const profile = recordMany([attempt()]);
  profile.aspiration = "Learn \u6570\u5b66 \ud83c\udfaf";
  await withStorageGlobals({ plain: sdk }, local, async () => {
    assert.equal(await saveTrainingProfile(profile), true);
    const stored = sdk.values.get(TRAINING_STORAGE_KEY)!;
    assert.notEqual(stored[0], "{");
    assert.deepEqual(JSON.parse(atob(stored)), profile);
    assert.deepEqual(JSON.parse(local.values.get(TRAINING_STORAGE_KEY)!), profile);
    assert.deepEqual(await loadTrainingProfile(undefined, NOW), profile);
  });
});

test("SDK failures and corrupt payloads use the local fallback", async () => {
  const profile = recordMany([attempt()]);
  const local = memoryStorage();
  await saveTrainingProfile(profile, local);
  for (const sdk of [
    { getItem: async () => { throw new Error("SDK offline"); }, setItem: async () => { throw new Error("SDK offline"); } },
    { getItem: async () => "broken", setItem: async () => { throw new Error("SDK offline"); } }
  ]) {
    await withStorageGlobals({ plain: sdk }, local, async () => {
      assert.deepEqual(await loadTrainingProfile(undefined, NOW), profile);
      assert.equal(await saveTrainingProfile(profile), true);
    });
  }
});

test("loading chooses the newest valid snapshot whether local or SDK instead of discarding offline progress", async () => {
  const sdk = memoryStorage();
  const local = memoryStorage();
  const older = recordMany([attempt()]);
  const newer = recordMany([attempt({ variantKey: "offline", now: NOW + DAY })], older);
  for (const [remoteProfile, localProfile] of [[older, newer], [newer, older]]) {
    sdk.values.set(TRAINING_STORAGE_KEY, btoa(JSON.stringify(remoteProfile)));
    await saveTrainingProfile(localProfile, local);
    await withStorageGlobals({ plain: sdk }, local, async () => {
      const loaded = await loadTrainingProfile(undefined, NOW);
      assert.deepEqual(loaded, newer);
      assert.equal(await saveTrainingProfile(loaded), true);
      assert.deepEqual(await loadTrainingProfile(undefined, NOW), loaded);
    });
  }
});

test("equal snapshot timestamps prefer more recorded evidence", async () => {
  const sdk = memoryStorage();
  const local = memoryStorage();
  const older = recordMany([attempt()]);
  const newer = recordMany([attempt({ variantKey: "extra" })], older);
  sdk.values.set(TRAINING_STORAGE_KEY, btoa(JSON.stringify(older)));
  await saveTrainingProfile(newer, local);
  await withStorageGlobals({ plain: sdk }, local, async () => {
    assert.deepEqual(await loadTrainingProfile(undefined, NOW), newer);
  });
});

test("a never-settling SDK read or write falls back to local storage at one second", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sdk: TrainingStorage = {
    getItem: () => new Promise<never>(() => {}),
    setItem: () => new Promise<never>(() => {})
  };
  const local = memoryStorage();
  const profile = recordMany([attempt()]);
  await saveTrainingProfile(profile, local);
  await withStorageGlobals({ plain: sdk }, local, async () => {
    const loading = loadTrainingProfile(undefined, NOW);
    let settled = false;
    void loading.then(() => { settled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(999);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    t.mock.timers.tick(1);
    assert.deepEqual(await loading, profile);

    const updated = recordMany([attempt({ variantKey: "new", now: NOW + DAY })], profile);
    const saving = saveTrainingProfile(updated);
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(1000);
    assert.equal(await saving, true);
    assert.deepEqual(JSON.parse(local.values.get(TRAINING_STORAGE_KEY)!), updated);
  });
});

test("SDK-only saves serialize raw writes even after the older save times out", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const values = new Map<string, string>();
  const writes: string[] = [];
  let finishOld: () => void = () => {};
  const sdk: TrainingStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(value);
      if (writes.length === 1) return new Promise<void>((resolve) => {
        finishOld = () => { values.set(key, value); resolve(); };
      });
      values.set(key, value);
    }
  };
  const older = recordMany([attempt()]);
  const newer = recordMany([attempt({ variantKey: "newer", now: NOW + DAY })], older);
  await withStorageGlobals({ plain: sdk }, undefined, async () => {
    const firstSave = saveTrainingProfile(older);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(writes.length, 1);
    t.mock.timers.tick(1000);
    assert.equal(await firstSave, false);

    const secondSave = saveTrainingProfile(newer);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(writes.length, 1, "the timed-out raw write must still own the SDK write lock");
    finishOld();
    assert.equal(await secondSave, true);
    assert.equal(writes.length, 2);
    assert.deepEqual(JSON.parse(atob(writes[1])), newer);
    assert.deepEqual(await loadTrainingProfile(undefined, NOW), newer);
  });
});

test("a blocked SDK coalesces pending snapshots to the latest while local saves remain independent", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const values = new Map<string, string>();
  const writes: string[] = [];
  let finishOld: () => void = () => {};
  const sdk: TrainingStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(value);
      if (writes.length === 1) return new Promise<void>((resolve) => {
        finishOld = () => { values.set(key, value); resolve(); };
      });
      values.set(key, value);
    }
  };
  const local = memoryStorage();
  let latest = createTrainingProfile(NOW);
  await withStorageGlobals({ plain: sdk }, local, async () => {
    for (let index = 0; index < 8; index += 1) {
      latest = recordTrainingAttempt(latest, attempt({ variantKey: `queued-${index}`, now: NOW + index }));
      const saving = saveTrainingProfile(latest);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(JSON.parse(local.values.get(TRAINING_STORAGE_KEY)!), latest);
      t.mock.timers.tick(1000);
      assert.equal(await saving, true);
    }
    assert.equal(writes.length, 1, "a hanging SDK must not accumulate overlapping raw writes");
    finishOld();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(writes.length, 2, "only the newest pending snapshot should be written after recovery");
    assert.deepEqual(JSON.parse(atob(values.get(TRAINING_STORAGE_KEY)!)), latest);
    assert.deepEqual(await loadTrainingProfile(undefined, NOW), latest);
  });
});

test("a rejected old raw write releases its store queue and a superseded snapshot is not acknowledged", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const values = new Map<string, string>();
  const writes: string[] = [];
  let rejectOld: (error: Error) => void = () => {};
  const storage: TrainingStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(value);
      if (writes.length === 1) return new Promise<void>((_resolve, reject) => { rejectOld = reject; });
      values.set(key, value);
    }
  };
  const first = recordMany([attempt()]);
  const second = recordMany([attempt({ variantKey: "second", now: NOW + 1 })], first);
  const third = recordMany([attempt({ variantKey: "third", now: NOW + 2 })], second);
  const initialSave = saveTrainingProfile(first, storage);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const skippedSave = saveTrainingProfile(second, storage);
  const latestSave = saveTrainingProfile(third, storage);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(await skippedSave, false, "coalescing does not pretend the skipped snapshot was written");
  assert.equal(writes.length, 1);
  rejectOld(new Error("old write failed"));
  assert.equal(await initialSave, false);
  assert.equal(await latestSave, true);
  assert.equal(writes.length, 2);
  assert.deepEqual(JSON.parse(writes[1]), third);
  assert.deepEqual(await loadTrainingProfile(storage, NOW), third);
});

test("SDK-only timeouts return memory-only status and late SDK failures stay handled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let rejectRead: (error: Error) => void = () => {};
  let rejectWrite: (error: Error) => void = () => {};
  const sdk: TrainingStorage = {
    getItem: () => new Promise((_resolve, reject) => { rejectRead = reject; }),
    setItem: () => new Promise((_resolve, reject) => { rejectWrite = reject; })
  };
  await withStorageGlobals({ plain: sdk }, undefined, async () => {
    const loading = loadTrainingProfile(undefined, NOW);
    const saving = saveTrainingProfile(createTrainingProfile(NOW));
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(1000);
    assert.deepEqual(await loading, createTrainingProfile(NOW));
    assert.equal(await saving, false);
    rejectRead(new Error("late read failure"));
    rejectWrite(new Error("late write failure"));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
});

test("throwing localStorage getters do not prevent SDK-only persistence", async () => {
  const sdk = memoryStorage();
  const profile = recordMany([attempt()]);
  await withStorageGlobals({ plain: sdk }, undefined, async () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("denied"); } });
    assert.equal(await saveTrainingProfile(profile), true);
    assert.deepEqual(await loadTrainingProfile(undefined, NOW), profile);
  });
});

test("no SDK and no localStorage remains usable in memory", async () => {
  await withStorageGlobals(undefined, undefined, async () => {
    const profile = await loadTrainingProfile(undefined, NOW);
    assert.deepEqual(profile, createTrainingProfile(NOW));
    assert.equal(await saveTrainingProfile(profile), false);
    assert.equal(recordTrainingAttempt(profile, attempt()).grades[1]?.attempts.length, 1);
  });
});
