import test from "node:test";
import assert from "node:assert/strict";
import { allBandSkills } from "../src/content/bands/index";
import { hasSpecificGuidedBuilder } from "../src/content/bands/guidedFactory";
import g34Coverage from "../src/content/bands/g34/coverage-map.json";
import g56Coverage from "../src/content/bands/g56/coverage-map.json";
import g78Coverage from "../src/content/bands/g78/coverage-map.json";
import g910Coverage from "../src/content/bands/g910/coverage-map.json";
import g1112Coverage from "../src/content/bands/g1112/coverage-map.json";
import { guidedSkillCoverage, listGuidedTopics } from "../src/learn/guidedLessons";

for (const grade of [1, 2, 3, 5, 7, 9, 11] as const) {
  test(`guided lessons cover every Grade ${grade} skill`, () => {
    assert.deepEqual(new Set(guidedSkillCoverage(grade)), new Set(allBandSkills(grade)));
  });

  test(`guided lessons for Grade ${grade} expose interactive visuals and checks`, () => {
    const topics = listGuidedTopics(grade);
    assert.ok(topics.length > 0, `grade ${grade} should have topics`);

    for (const topic of topics) {
      assert.ok(topic.stages.length >= 3, `${topic.id} should have multiple stages`);
      assert.ok(topic.stages.some((stage) => (stage.controls || []).length > 0), `${topic.id} should have controls`);
      assert.ok(topic.stages.some((stage) => stage.prompt && stage.options && stage.correctIndex), `${topic.id} should have a quick check`);

      for (const stage of topic.stages) {
        const body = stage.body(topic.initialValues);
        const derivation = stage.derivation(topic.initialValues);
        const visual = stage.visual(topic.initialValues);
        assert.ok(body.length > 12, `${topic.id}/${stage.id} body should be non-trivial`);
        assert.ok(derivation.length > 3, `${topic.id}/${stage.id} derivation should be non-trivial`);
        assert.ok(visual.svg.startsWith("<svg"), `${topic.id}/${stage.id} should render an svg`);
        assert.ok(visual.altText.length > 6, `${topic.id}/${stage.id} should have alt text`);

        if (stage.prompt && stage.options && stage.correctIndex) {
          const prompt = stage.prompt(topic.initialValues);
          const options = stage.options(topic.initialValues);
          const correctIndex = stage.correctIndex(topic.initialValues);
          assert.ok(prompt.length > 6, `${topic.id}/${stage.id} prompt should be non-trivial`);
          assert.equal(options.length, 3, `${topic.id}/${stage.id} should have 3 options`);
          assert.ok(correctIndex >= 0 && correctIndex <= 2, `${topic.id}/${stage.id} correctIndex out of range`);
          assert.ok(new Set(options).size >= 2, `${topic.id}/${stage.id} options should not all be identical`);
        }
      }
    }
  });
}


for (const coverage of [g34Coverage, g56Coverage, g78Coverage, g910Coverage, g1112Coverage]) {
  test(`guided builders are topic-specific for ${coverage.bandId}`, () => {
    for (const topicKey of new Set(coverage.curriculum.map((row) => row.lessonTopic))) {
      assert.equal(hasSpecificGuidedBuilder(coverage.bandId, topicKey), true, `${coverage.bandId}:${topicKey} should use a specific guided builder`);
    }
  });
}
