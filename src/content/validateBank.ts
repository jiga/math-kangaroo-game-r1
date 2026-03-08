import coverageMap from "./g1g2/coverage-map.json";
import { bankStats, buildContestQuestions, buildGradeTemplates } from "./g1g2/bank";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function validateGrade(grade: 1 | 2): void {
  const stats = bankStats(grade);
  const config = coverageMap.grades[String(grade) as "1" | "2"];
  assert(stats.total >= config.targetTemplates, `Grade ${grade} templates below target`);

  for (const row of config.curriculum) {
    const actual = stats.bySkill[row.skillId] || 0;
    assert(
      actual >= row.requiredTemplates,
      `Grade ${grade} skill ${row.skillId} has ${actual}, expected >= ${row.requiredTemplates}`
    );

    const familyCount = Object.keys(stats.byFamily).filter((key) => key.startsWith(`${row.skillId}:`)).length;
    const minFamilies = row.requiredTemplates >= 8 ? 4 : 3;
    assert(
      familyCount >= minFamilies,
      `Grade ${grade} skill ${row.skillId} has only ${familyCount} families, expected >= ${minFamilies}`
    );
  }

  const total = stats.total;
  const expected3 = Math.round(total * coverageMap.pointDistribution["3"]);
  const expected4 = Math.round(total * coverageMap.pointDistribution["4"]);
  const expected5 = total - expected3 - expected4;
  const delta3 = Math.abs(stats.byTier["3"] - expected3);
  const delta4 = Math.abs(stats.byTier["4"] - expected4);
  const delta5 = Math.abs(stats.byTier["5"] - expected5);
  assert(delta3 <= 1 && delta4 <= 1 && delta5 <= 1, `Grade ${grade} point-tier distribution mismatch`);

  const templates = buildGradeTemplates(grade);
  for (let i = 0; i < Math.min(templates.length, 200); i += 1) {
    const template = templates[i];
    const q = template.generate({
      templateId: template.id,
      grade,
      pointTier: template.pointTier,
      variantSeed: i + 11
    });
    assert(q.options.length === 5, `Question ${q.id} does not have 5 options`);
    const unique = new Set(q.options);
    assert(unique.size === 5, `Question ${q.id} has duplicate options`);
    assert(q.answerIndex >= 0 && q.answerIndex <= 4, `Question ${q.id} has invalid answer index`);
    assert(Boolean(q.options[q.answerIndex]), `Question ${q.id} correct option missing`);
    assert(q.explanation.length > 5, `Question ${q.id} explanation too short`);
    assert(q.familyId.length > 0, `Question ${q.id} missing family id`);
    assert(q.strategyTags.length > 0, `Question ${q.id} missing strategy tags`);
  }

  const contest = buildContestQuestions(grade, 42);
  assert(contest.length === 24, `Grade ${grade} contest must have 24 questions`);
  const tierCount = contest.reduce(
    (acc, q) => {
      acc[q.pointTier] += 1;
      return acc;
    },
    { 3: 0, 4: 0, 5: 0 }
  );
  assert(tierCount[3] === 8 && tierCount[4] === 8 && tierCount[5] === 8, `Grade ${grade} contest tier split invalid`);
}

function main(): void {
  validateGrade(1);
  validateGrade(2);
  console.log("Grade 1-2 bank validation passed");
}

main();
