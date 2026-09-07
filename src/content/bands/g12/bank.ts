import type { Grade } from '../../../domain/types';
import coverageMap from './coverage-map.json';
import { bankStats, buildContestQuestions, buildGradeTemplates, createPracticeProvider, allGrade12Skills } from '../../g1g2/bank';
import { familyIdsForSkill } from '../../g1g2/templates';

function grade12(grade: Grade): 1 | 2 {
  if (grade !== 1 && grade !== 2) {
    throw new RangeError(`The g12 bank only supports grades 1 and 2, received ${grade}`);
  }
  return grade;
}

export const bank = {
  bandId: 'g12' as const,
  coverageMap,
  buildTemplates: (grade: Grade) => buildGradeTemplates(grade12(grade)),
  buildContestQuestions: (grade: Grade, seed?: number) => buildContestQuestions(grade, seed),
  createPracticeProvider: (grade: Grade) => createPracticeProvider(grade12(grade)),
  bankStats: (grade: Grade) => bankStats(grade12(grade)),
  allSkills: (grade: Grade = 1) => allGrade12Skills(grade12(grade)),
  allFamilies: (skillId: string) => familyIdsForSkill(skillId),
  skillMeta: () => []
};
