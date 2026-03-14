import test from "node:test";
import assert from "node:assert/strict";
import g12Coverage from "../src/content/g1g2/coverage-map.json";
import { bankForGrade, bankStatsForGrade, buildContestQuestionsForGrade, buildTemplatesForGrade, questionCountForGrade } from "../src/content/bands/index";
import type { Grade } from "../src/domain/types";

function configForGrade(grade: Grade) {
  if (grade <= 2) {
    return g12Coverage.grades[String(grade) as "1" | "2"];
  }
  return bankForGrade(grade).coverageMap;
}

function skillRowsForGrade(grade: Grade) {
  if (grade <= 2) {
    return g12Coverage.grades[String(grade) as "1" | "2"].curriculum;
  }
  return bankForGrade(grade).coverageMap.curriculum;
}

for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const) {
  test(`grade ${grade} coverage is complete`, () => {
    const config = configForGrade(grade);
    const stats = bankStatsForGrade(grade);
    assert.ok(stats.total >= config.targetTemplates);
    for (const row of skillRowsForGrade(grade)) {
      assert.ok((stats.bySkill[row.skillId] || 0) >= row.requiredTemplates, `Missing count for ${row.skillId}`);
    }
  });

  test(`grade ${grade} question templates have valid options`, () => {
    const templates = buildTemplatesForGrade(grade);
    const sample = Math.min(templates.length, grade <= 2 ? 80 : 60);
    for (let i = 0; i < sample; i += 1) {
      const q = templates[i].generate({
        templateId: templates[i].id,
        grade,
        bandId: templates[i].bandId,
        pointTier: templates[i].pointTier,
        variantSeed: 1234 + i
      });
      assert.equal(q.options.length, 5);
      assert.equal(new Set(q.options).size, 5);
      assert.ok(q.answerIndex >= 0 && q.answerIndex <= 4);
      assert.ok(Boolean(q.options[q.answerIndex]));
      assert.ok(q.explanation.length > 8);
      assert.ok(q.familyId.length > 0);
      assert.ok(q.strategyTags.length > 0);
      assert.equal(q.bandId, templates[i].bandId);
    }
  });

  test(`grade ${grade} skills use multiple question families`, () => {
    const stats = bankStatsForGrade(grade);
    for (const row of skillRowsForGrade(grade)) {
      const familyCount = Object.keys(stats.byFamily).filter((key) => key.startsWith(`${row.skillId}:`)).length;
      const requiredFamilies = row.requiredFamilies ?? (row.requiredTemplates >= 8 ? 4 : 3);
      assert.ok(familyCount >= requiredFamilies, `${row.skillId} only has ${familyCount} families`);
    }
  });

  test(`grade ${grade} contest has official question count and point tiers`, () => {
    const q = buildContestQuestionsForGrade(grade, 123);
    const expectedTotal = questionCountForGrade(grade);
    assert.equal(q.length, expectedTotal);
    const tiers = q.reduce(
      (acc, item) => {
        acc[item.pointTier] += 1;
        return acc;
      },
      { 3: 0, 4: 0, 5: 0 }
    );
    const expectedPerTier = expectedTotal / 3;
    assert.equal(tiers[3], expectedPerTier);
    assert.equal(tiers[4], expectedPerTier);
    assert.equal(tiers[5], expectedPerTier);
  });
}
