import type { Grade } from '../../../domain/types';
import coverageMap from './coverage-map.json';
import { bankStats, buildContestQuestions, buildGradeTemplates, createPracticeProvider, allGrade12Skills } from '../../g1g2/bank';
import { familyIdsForSkill } from '../../g1g2/templates';

export const bank = {
  bandId: 'g12' as const,
  coverageMap,
  buildTemplates: (grade: Grade) => buildGradeTemplates(grade as 1 | 2),
  buildContestQuestions: (grade: Grade, seed?: number) => buildContestQuestions(grade, seed),
  createPracticeProvider: (grade: Grade) => createPracticeProvider(grade as 1 | 2),
  bankStats: (grade: Grade) => bankStats(grade as 1 | 2),
  allSkills: (grade?: Grade) => allGrade12Skills((grade || 1) as 1 | 2),
  allFamilies: (skillId: string) => familyIdsForSkill(skillId),
  skillMeta: () => []
};
