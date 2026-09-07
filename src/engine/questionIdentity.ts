import type { QuestionInstance } from '../domain/types';

/** Content identity ignores generator seeds and choice order; bounded for device storage. */
export function questionContentKey(question: QuestionInstance): string {
  const content = JSON.stringify([question.familyId, question.prompt, question.options[question.answerIndex], question.visualAssetSpec?.svg || '']);
  return compactQuestionContent(content);
}

export function compactQuestionContent(content: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    first = Math.imul(first ^ content.charCodeAt(i), 0x01000193);
    second = Math.imul(second ^ content.charCodeAt(i), 0x85ebca6b);
  }
  return 'q1:' + (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0') + ':' + content.length;
}
