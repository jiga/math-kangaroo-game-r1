import g12Coverage from "./g1g2/coverage-map.json";
import { G12_CURRICULUM_CHECKLIST } from "./g1g2/curriculumChecklist";
import { familyIdsForSkill } from "./g1g2/templates";
import { bankForGrade, bankStatsForGrade, buildContestQuestionsForGrade, buildTemplatesForGrade, questionCountForGrade } from "./bands/index";
import type { Grade } from "../domain/types";
import { listGuidedTopics } from "../learn/guidedLessons";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function rowsForGrade(grade: Grade) {
  if (grade <= 2) return g12Coverage.grades[String(grade) as "1" | "2"].curriculum;
  return bankForGrade(grade).coverageMap.curriculum;
}

function configForGrade(grade: Grade) {
  if (grade <= 2) return { ...g12Coverage.grades[String(grade) as "1" | "2"], pointDistribution: g12Coverage.pointDistribution };
  return bankForGrade(grade).coverageMap;
}

function validateGrade(grade: Grade): void {
  const config = configForGrade(grade);
  const stats = bankStatsForGrade(grade);
  assert(stats.total >= config.targetTemplates, `Grade ${grade} templates below target`);

  for (const row of rowsForGrade(grade)) {
    const actual = stats.bySkill[row.skillId] || 0;
    assert(actual >= row.requiredTemplates, `Grade ${grade} skill ${row.skillId} has ${actual}, expected >= ${row.requiredTemplates}`);
    const familyCount = Object.keys(stats.byFamily).filter((key) => key.startsWith(`${row.skillId}:`)).length;
    const requiredFamilies = row.requiredFamilies ?? (row.requiredTemplates >= 8 ? 4 : 3);
    assert(familyCount >= requiredFamilies, `Grade ${grade} skill ${row.skillId} has only ${familyCount}, expected >= ${requiredFamilies}`);
  }

  const total = stats.total;
  const dist = config.pointDistribution;
  const expected3 = Math.round(total * dist["3"]);
  const expected4 = Math.round(total * dist["4"]);
  const expected5 = total - expected3 - expected4;
  const delta3 = Math.abs(stats.byTier["3"] - expected3);
  const delta4 = Math.abs(stats.byTier["4"] - expected4);
  const delta5 = Math.abs(stats.byTier["5"] - expected5);
  assert(delta3 <= 1 && delta4 <= 1 && delta5 <= 1, `Grade ${grade} point-tier distribution mismatch`);

  const templates = buildTemplatesForGrade(grade);
  for (let i = 0; i < Math.min(templates.length, 120); i += 1) {
    const template = templates[i];
    const q = template.generate({
      templateId: template.id,
      grade,
      bandId: template.bandId,
      pointTier: template.pointTier,
      variantSeed: i + 11
    });
    assert(q.options.length === 5, `Question ${q.id} does not have 5 options`);
    assert(new Set(q.options).size === 5, `Question ${q.id} has duplicate options`);
    assert(q.answerIndex >= 0 && q.answerIndex <= 4, `Question ${q.id} has invalid answer index`);
    assert(Boolean(q.options[q.answerIndex]), `Question ${q.id} correct option missing`);
    assert(q.explanation.length > 5, `Question ${q.id} explanation too short`);
    assert(q.familyId.length > 0, `Question ${q.id} missing family id`);
    assert(q.strategyTags.length > 0, `Question ${q.id} missing strategy tags`);
  }

  const contest = buildContestQuestionsForGrade(grade, 42);
  const totalContest = questionCountForGrade(grade);
  const perTier = totalContest / 3;
  assert(contest.length === totalContest, `Grade ${grade} contest must have ${totalContest} questions`);
  const tierCount = contest.reduce(
    (acc, q) => {
      acc[q.pointTier] += 1;
      return acc;
    },
    { 3: 0, 4: 0, 5: 0 }
  );
  assert(tierCount[3] === perTier && tierCount[4] === perTier && tierCount[5] === perTier, `Grade ${grade} contest tier split invalid`);

  if (grade <= 2) {
    const guidedTopics = listGuidedTopics(grade);
    const guidedTopicIds = new Set(guidedTopics.map((topic) => topic.id));
    const guidedStageIds = new Set(guidedTopics.flatMap((topic) => topic.stages.map((stage) => `${topic.id}:${stage.id}`)));
    const gradeSkills = new Set(rowsForGrade(grade).map((row) => row.skillId));

    for (const bullet of G12_CURRICULUM_CHECKLIST) {
      const matchedFamilies = new Set<string>();
      for (const skillId of bullet.skills) {
        assert(gradeSkills.has(skillId), `Grade ${grade} missing curriculum skill ${skillId} for ${bullet.id}`);
        const families = familyIdsForSkill(skillId);
        for (const familyId of bullet.families) {
          if (families.includes(familyId)) matchedFamilies.add(familyId);
        }
      }
      assert(matchedFamilies.size > 0, `Grade ${grade} missing representative question families for ${bullet.id}`);
      for (const topicId of bullet.guidedTopicIds) {
        assert(guidedTopicIds.has(topicId), `Grade ${grade} missing guided topic ${topicId} for ${bullet.id}`);
      }
      for (const stageId of bullet.guidedStageIds) {
        assert(guidedStageIds.has(stageId), `Grade ${grade} missing guided stage ${stageId} for ${bullet.id}`);
      }
    }

    for (const template of templates.filter((entry) => entry.skillId === "patterns")) {
      const question = template.generate({
        templateId: template.id,
        grade,
        bandId: template.bandId,
        pointTier: template.pointTier,
        variantSeed: 101
      });
      assert(!/what comes next|next number/i.test(question.prompt), `Pattern question ${question.id} should not ask for next item`);
    }

    for (const template of templates.filter((entry) => entry.skillId === "clock_full_half" && entry.pointTier !== 5)) {
      const question = template.generate({
        templateId: template.id,
        grade,
        bandId: template.bandId,
        pointTier: template.pointTier,
        variantSeed: 202
      });
      const combined = [question.prompt, ...question.options, question.explanation].join(" ");
      assert(!/:15|:45|quarter|30 minutes/i.test(combined), `Clock question ${question.id} should stay on full/half-hour language`);
    }
  }
}

function main(): void {
  for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const) {
    validateGrade(grade);
  }
  console.log("Grade 1-12 bank validation passed");
}

main();
