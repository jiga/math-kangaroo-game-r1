import type { BandId, Grade, SkillId } from "../../domain/types";
import { gradeToBand, questionCountForGrade } from "./common";
import { bank as g12 } from "./g12/bank";
import { bank as g34 } from "./g34/bank";
import { bank as g56 } from "./g56/bank";
import { bank as g78 } from "./g78/bank";
import { bank as g910 } from "./g910/bank";
import { bank as g1112 } from "./g1112/bank";

const BANKS = {
  g12,
  g34,
  g56,
  g78,
  g910,
  g1112
};

export { gradeToBand, questionCountForGrade };

export function bankForGrade(grade: Grade) {
  return BANKS[gradeToBand(grade)];
}

export function buildContestQuestionsForGrade(grade: Grade, seed = Date.now()) {
  return bankForGrade(grade).buildContestQuestions(grade, seed);
}

export function buildTemplatesForGrade(grade: Grade) {
  return bankForGrade(grade).buildTemplates(grade);
}

export function createPracticeProviderForGrade(grade: Grade) {
  return bankForGrade(grade).createPracticeProvider(grade);
}

export function bankStatsForGrade(grade: Grade) {
  return bankForGrade(grade).bankStats(grade);
}

export function allBandSkills(gradeOrBand: Grade | BandId): SkillId[] {
  const bank = typeof gradeOrBand === "string" ? BANKS[gradeOrBand] : bankForGrade(gradeOrBand);
  return bank.allSkills(typeof gradeOrBand === "number" ? gradeOrBand : undefined);
}

export function allBandFamilies(gradeOrBand: Grade | BandId, skillId: SkillId): string[] {
  const bank = typeof gradeOrBand === "string" ? BANKS[gradeOrBand] : bankForGrade(gradeOrBand);
  return bank.allFamilies(skillId);
}

export function skillMetaForGrade(grade: Grade) {
  return bankForGrade(grade).skillMeta();
}
