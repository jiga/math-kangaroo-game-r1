import test from 'node:test';
import assert from 'node:assert/strict';
import { questionContentKey } from '../src/engine/questionIdentity';
import { buildContestQuestionsForGrade } from '../src/content/bands';

test('re-seeding or shuffling the same question cannot create new learning evidence', () => {
  const q = buildContestQuestionsForGrade(1, 7)[0];
  const options = [...q.options].reverse() as typeof q.options;
  const shuffled = { ...q, id: 'different', variantKey: 'new seed', options, answerIndex: 4 - q.answerIndex };
  assert.equal(questionContentKey(q), questionContentKey(shuffled));
  assert.notEqual(questionContentKey(q), questionContentKey({ ...q, prompt: q.prompt + ' Changed given.' }));
  assert.ok(questionContentKey(q).length < 32);
});
