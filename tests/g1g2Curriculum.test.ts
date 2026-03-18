import test from 'node:test';
import assert from 'node:assert/strict';
import { G12_CURRICULUM_CHECKLIST } from '../src/content/g1g2/curriculumChecklist';
import { familyIdsForSkill } from '../src/content/g1g2/templates';
import { buildTemplatesForGrade } from '../src/content/bands/index';
import { listGuidedTopics } from '../src/learn/guidedLessons';

for (const grade of [1, 2] as const) {
  test(`Grade ${grade} curriculum checklist is fully mapped`, () => {
    const topics = listGuidedTopics(grade);
    const topicIds = new Set(topics.map((topic) => topic.id));
    const stageIds = new Set(topics.flatMap((topic) => topic.stages.map((stage) => `${topic.id}:${stage.id}`)));

    for (const bullet of G12_CURRICULUM_CHECKLIST) {
      let familyMatchCount = 0;
      for (const skillId of bullet.skills) {
        const families = familyIdsForSkill(skillId);
        familyMatchCount += bullet.families.filter((familyId) => families.includes(familyId)).length;
      }
      assert.ok(familyMatchCount > 0, `${bullet.id} should map to at least one family`);
      for (const topicId of bullet.guidedTopicIds) assert.ok(topicIds.has(topicId), `${bullet.id} missing topic ${topicId}`);
      for (const stageId of bullet.guidedStageIds) assert.ok(stageIds.has(stageId), `${bullet.id} missing stage ${stageId}`);
    }
  });

  test(`Grade ${grade} pattern questions use rule spotting instead of next-item prompts`, () => {
    for (const template of buildTemplatesForGrade(grade).filter((template) => template.skillId === 'patterns')) {
      const question = template.generate({
        templateId: template.id,
        grade,
        bandId: template.bandId,
        pointTier: template.pointTier,
        variantSeed: 77
      });
      assert.equal(/what comes next|next number/i.test(question.prompt), false, question.prompt);
    }
  });

  test(`Grade ${grade} 3-4 point clock content stays on full and half hours`, () => {
    for (const template of buildTemplatesForGrade(grade).filter((template) => template.skillId === 'clock_full_half' && template.pointTier !== 5)) {
      const question = template.generate({
        templateId: template.id,
        grade,
        bandId: template.bandId,
        pointTier: template.pointTier,
        variantSeed: 88
      });
      const combined = [question.prompt, ...question.options, question.explanation].join(' ');
      assert.equal(/:15|:45|quarter|30 minutes/i.test(combined), false, combined);
    }
  });
}
