import test from "node:test";
import assert from "node:assert/strict";
import coverageMap from "../src/content/g1g2/coverage-map.json";
import { bankStats, buildContestQuestions, buildGradeTemplates } from "../src/content/g1g2/bank";

for (const grade of [1, 2] as const) {
  test(`grade ${grade} coverage is complete`, () => {
    const config = coverageMap.grades[String(grade) as "1" | "2"];
    const stats = bankStats(grade);

    assert.ok(stats.total >= config.targetTemplates);
    for (const row of config.curriculum) {
      assert.ok(
        (stats.bySkill[row.skillId] || 0) >= row.requiredTemplates,
        `Missing count for ${row.skillId}`
      );
    }
  });

  test(`grade ${grade} question templates have valid options`, () => {
    const templates = buildGradeTemplates(grade);
    for (let i = 0; i < Math.min(templates.length, 120); i += 1) {
      const q = templates[i].generate({
        templateId: templates[i].id,
        grade,
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
    }
  });

  test(`grade ${grade} skills use multiple question families`, () => {
    const templates = buildGradeTemplates(grade);
    const familiesBySkill = new Map<string, Set<string>>();
    for (const template of templates) {
      if (!familiesBySkill.has(template.skillId)) {
        familiesBySkill.set(template.skillId, new Set());
      }
      familiesBySkill.get(template.skillId)!.add(template.familyId);
    }

    for (const row of coverageMap.grades[String(grade) as "1" | "2"].curriculum) {
      const familyCount = familiesBySkill.get(row.skillId)?.size || 0;
      const minFamilies = row.requiredTemplates >= 8 ? 3 : 2;
      assert.ok(familyCount >= minFamilies, `${row.skillId} only has ${familyCount} families`);
    }
  });

  test(`grade ${grade} contest has official 24 questions with point tiers`, () => {
    const q = buildContestQuestions(grade, 123);
    assert.equal(q.length, 24);
    const tiers = q.reduce(
      (acc, item) => {
        acc[item.pointTier] += 1;
        return acc;
      },
      { 3: 0, 4: 0, 5: 0 }
    );
    assert.equal(tiers[3], 8);
    assert.equal(tiers[4], 8);
    assert.equal(tiers[5], 8);
  });
}
