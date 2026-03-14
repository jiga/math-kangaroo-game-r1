import type { Grade, PracticeProfile, PracticeSession, SkillId, QuestionInstance, SkillProgress } from "../domain/types";
import { gradeToBand, questionCountForGrade } from "../content/bands/common";

export interface PracticeQuestionProvider {
  pickAny: (grade: Grade, avoidHashes: Set<string>, pointTier: 3 | 4 | 5) => QuestionInstance;
  pickBySkill: (grade: Grade, skillId: SkillId, avoidHashes: Set<string>, pointTier: 3 | 4 | 5) => QuestionInstance;
  pickByFamily: (
    grade: Grade,
    skillId: SkillId,
    familyId: string,
    avoidHashes: Set<string>,
    pointTier: 3 | 4 | 5
  ) => QuestionInstance;
  allSkills: (grade: Grade) => SkillId[];
  allFamilies: (grade: Grade, skillId: SkillId) => string[];
}

let provider: PracticeQuestionProvider | null = null;

export function setPracticeQuestionProvider(nextProvider: PracticeQuestionProvider): void {
  provider = nextProvider;
}

function sessionStage(profile: PracticeProfile, grade: Grade): "diagnostic" | "mastery" | "mock" {
  const sessions = profile.gradeStats[String(grade)]?.sessions || 0;
  if (sessions < 2) return "diagnostic";
  if ((sessions + 1) % 4 === 0) return "mock";
  return "mastery";
}

export function startPracticeSession(profile: PracticeProfile, grade: Grade): PracticeSession {
  const stage = sessionStage(profile, grade);
  return {
    id: `practice_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    grade,
    bandId: gradeToBand(grade),
    stage,
    index: 0,
    total: questionCountForGrade(grade),
    startedAt: Date.now(),
    missesBySkill: {},
    missesByFamily: {},
    askedQuestionHashes: new Set<string>(),
    answered: []
  };
}

function familyKey(skillId: SkillId, familyId: string): string {
  return `${skillId}:${familyId}`;
}

function weakness(progress?: SkillProgress): number {
  if (!progress || progress.attempts === 0) return 0.55;
  const acc = progress.correct / progress.attempts;
  return 1 - acc;
}

function recencyDecay(progress?: SkillProgress, horizonHours = 24): number {
  if (!progress) return 1;
  const elapsedHours = (Date.now() - progress.lastSeenAt) / (1000 * 60 * 60);
  return Math.min(1, elapsedHours / horizonHours);
}

function skillWeakness(profile: PracticeProfile, skillId: SkillId): number {
  return weakness(profile.skills[skillId]);
}

function familyWeakness(profile: PracticeProfile, skillId: SkillId, familyId: string): number {
  return weakness(profile.families[familyKey(skillId, familyId)]);
}

function skillRecency(profile: PracticeProfile, skillId: SkillId): number {
  return recencyDecay(profile.skills[skillId], 24);
}

function familyRecency(profile: PracticeProfile, skillId: SkillId, familyId: string): number {
  return recencyDecay(profile.families[familyKey(skillId, familyId)], 18);
}

function dueForReview(progress?: SkillProgress): number {
  if (!progress) return 0.6;
  if (progress.nextReviewAt <= Date.now()) return 0.4;
  return 0;
}

function dueForSkillReview(profile: PracticeProfile, skillId: SkillId): number {
  return dueForReview(profile.skills[skillId]);
}

function dueForFamilyReview(profile: PracticeProfile, skillId: SkillId, familyId: string): number {
  return dueForReview(profile.families[familyKey(skillId, familyId)]);
}

function contestWeight(skillId: SkillId): number {
  const highValueNeedles = [
    "logic",
    "count",
    "probability",
    "geometry",
    "net",
    "modular",
    "quadratic",
    "system",
    "ratio"
  ];
  return highValueNeedles.some((needle) => skillId.includes(needle)) ? 0.35 : 0.15;
}

function recentMissBoost(session: PracticeSession, skillId: SkillId): number {
  return Math.min(1, (session.missesBySkill[skillId] || 0) * 0.45);
}

function recentFamilyMissBoost(session: PracticeSession, key: string): number {
  return Math.min(1, (session.missesByFamily[key] || 0) * 0.45);
}

function selectMasterySkill(profile: PracticeProfile, session: PracticeSession, grade: Grade): SkillId {
  if (!provider) throw new Error("Practice provider not configured");
  const skills = provider.allSkills(grade);
  const lastMiss = [...session.answered].reverse().find((entry) => !entry.correct);
  if (lastMiss && !session.answered.slice(-1)[0]?.correct) return lastMiss.skillId;
  const recentSkills = session.answered.slice(-2).map((entry) => entry.skillId);
  let best = skills[0];
  let bestScore = -Infinity;
  for (const skill of skills) {
    let score =
      skillWeakness(profile, skill) +
      skillRecency(profile, skill) +
      contestWeight(skill) +
      dueForSkillReview(profile, skill) +
      recentMissBoost(session, skill);

    if (recentSkills.includes(skill)) score -= 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = skill;
    }
  }
  return best;
}

function selectMasteryFamily(profile: PracticeProfile, session: PracticeSession, grade: Grade, skillId: SkillId): string {
  if (!provider) throw new Error("Practice provider not configured");
  const families = provider.allFamilies(grade, skillId);
  const recentFamilies = session.answered.slice(-3).map((entry) => entry.familyKey);
  let best = families[0];
  let bestScore = -Infinity;
  for (const familyId of families) {
    const key = familyKey(skillId, familyId);
    let score =
      familyWeakness(profile, skillId, familyId) +
      familyRecency(profile, skillId, familyId) +
      dueForFamilyReview(profile, skillId, familyId) +
      recentFamilyMissBoost(session, key);

    if (recentFamilies.includes(key)) score -= 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = familyId;
    }
  }
  return best;
}

export function recordAttempt(
  session: PracticeSession,
  profile: PracticeProfile,
  question: QuestionInstance,
  isCorrect: boolean,
  responseMs: number
): void {
  const now = Date.now();
  session.answered.push({
    questionId: question.id,
    skillId: question.skillId,
    familyId: question.familyId,
    familyKey: familyKey(question.skillId, question.familyId),
    correct: isCorrect,
    responseMs
  });
  session.index += 1;

  if (!isCorrect) {
    session.missesBySkill[question.skillId] = (session.missesBySkill[question.skillId] || 0) + 1;
    session.missesByFamily[familyKey(question.skillId, question.familyId)] =
      (session.missesByFamily[familyKey(question.skillId, question.familyId)] || 0) + 1;
  }

  const skill = profile.skills[question.skillId] || {
    attempts: 0,
    correct: 0,
    streak: 0,
    lastSeenAt: now,
    nextReviewAt: now
  };

  skill.attempts += 1;
  skill.correct += isCorrect ? 1 : 0;
  skill.streak = isCorrect ? skill.streak + 1 : 0;
  skill.lastSeenAt = now;
  const intervalMinutes = isCorrect ? Math.min(60 * 24, 15 * Math.max(1, skill.streak)) : 10;
  skill.nextReviewAt = now + intervalMinutes * 60 * 1000;
  profile.skills[question.skillId] = skill;

  const familyProgress = profile.families[familyKey(question.skillId, question.familyId)] || {
    attempts: 0,
    correct: 0,
    streak: 0,
    lastSeenAt: now,
    nextReviewAt: now
  };
  familyProgress.attempts += 1;
  familyProgress.correct += isCorrect ? 1 : 0;
  familyProgress.streak = isCorrect ? familyProgress.streak + 1 : 0;
  familyProgress.lastSeenAt = now;
  const familyIntervalMinutes = isCorrect ? Math.min(60 * 24, 12 * Math.max(1, familyProgress.streak)) : 8;
  familyProgress.nextReviewAt = now + familyIntervalMinutes * 60 * 1000;
  profile.families[familyKey(question.skillId, question.familyId)] = familyProgress;

  const gradeKey = String(session.grade);
  const gradeStat = profile.gradeStats[gradeKey] || { sessions: 0, totalAttempts: 0, totalCorrect: 0 };
  gradeStat.totalAttempts += 1;
  gradeStat.totalCorrect += isCorrect ? 1 : 0;
  profile.gradeStats[gradeKey] = gradeStat;

  profile.recentQuestionHashes.push(question.variantKey);
  if (profile.recentQuestionHashes.length > 200) profile.recentQuestionHashes = profile.recentQuestionHashes.slice(-200);
  profile.updatedAt = now;
}

function tierForIndex(index: number, total: number): 3 | 4 | 5 {
  const segment = total / 3;
  if (index < segment) return 3;
  if (index < segment * 2) return 4;
  return 5;
}

export function nextQuestion(session: PracticeSession, profile: PracticeProfile): QuestionInstance {
  if (!provider) throw new Error("Practice provider not configured");
  const pointTier = tierForIndex(session.index, session.total);

  if (session.stage === "diagnostic") {
    const skills = provider.allSkills(session.grade);
    const skill = skills[session.index % skills.length];
    const families = provider.allFamilies(session.grade, skill);
    const family = families[Math.floor(session.index / skills.length) % families.length];
    const q = provider.pickByFamily(session.grade, skill, family, session.askedQuestionHashes, pointTier);
    session.askedQuestionHashes.add(q.variantKey);
    return q;
  }

  if (session.stage === "mock") {
    const q = provider.pickAny(session.grade, session.askedQuestionHashes, pointTier);
    session.askedQuestionHashes.add(q.variantKey);
    return q;
  }

  const weakSkill = selectMasterySkill(profile, session, session.grade);
  const weakFamily = selectMasteryFamily(profile, session, session.grade, weakSkill);
  const candidate = provider.pickByFamily(session.grade, weakSkill, weakFamily, session.askedQuestionHashes, pointTier);
  session.askedQuestionHashes.add(candidate.variantKey);
  return candidate;
}

export function finalizePracticeSession(session: PracticeSession, profile: PracticeProfile): void {
  const gradeKey = String(session.grade);
  const gradeStat = profile.gradeStats[gradeKey] || { sessions: 0, totalAttempts: 0, totalCorrect: 0 };
  gradeStat.sessions += 1;
  profile.gradeStats[gradeKey] = gradeStat;
  profile.updatedAt = Date.now();
}
