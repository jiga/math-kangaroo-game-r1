import type { PracticeProfile, PracticeSession, SkillId, QuestionInstance } from "../domain/types";

export interface PracticeQuestionProvider {
  pickAny: (grade: 1 | 2, avoidHashes: Set<string>, pointTier: 3 | 4 | 5) => QuestionInstance;
  pickBySkill: (grade: 1 | 2, skillId: SkillId, avoidHashes: Set<string>, pointTier: 3 | 4 | 5) => QuestionInstance;
  allSkills: (grade: 1 | 2) => SkillId[];
}

let provider: PracticeQuestionProvider | null = null;

export function setPracticeQuestionProvider(nextProvider: PracticeQuestionProvider): void {
  provider = nextProvider;
}

function sessionStage(profile: PracticeProfile, grade: 1 | 2): "diagnostic" | "mastery" | "mock" {
  const sessions = profile.gradeStats[String(grade)]?.sessions || 0;
  if (sessions < 2) return "diagnostic";
  if ((sessions + 1) % 4 === 0) return "mock";
  return "mastery";
}

export function startPracticeSession(profile: PracticeProfile, grade: 1 | 2): PracticeSession {
  const stage = sessionStage(profile, grade);
  return {
    id: `practice_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    grade,
    stage,
    index: 0,
    total: stage === "mock" ? 24 : 24,
    startedAt: Date.now(),
    missesBySkill: {},
    askedQuestionHashes: new Set<string>(),
    answered: []
  };
}

function weakness(profile: PracticeProfile, skillId: SkillId): number {
  const s = profile.skills[skillId];
  if (!s || s.attempts === 0) return 0.5;
  const acc = s.correct / s.attempts;
  return 1 - acc;
}

function recencyDecay(profile: PracticeProfile, skillId: SkillId): number {
  const s = profile.skills[skillId];
  if (!s) return 1;
  const elapsedHours = (Date.now() - s.lastSeenAt) / (1000 * 60 * 60);
  return Math.min(1, elapsedHours / 24);
}

function contestWeight(skillId: SkillId): number {
  const highValue: SkillId[] = [
    "maze_shape_puzzles",
    "venn_diagrams_easy",
    "cube_cuboid_visualization",
    "perimeter_broken_lines",
    "prealgebra_balance"
  ];
  return highValue.includes(skillId) ? 0.35 : 0.15;
}

function dueForReview(profile: PracticeProfile, skillId: SkillId): number {
  const s = profile.skills[skillId];
  if (!s) return 0.6;
  if (s.nextReviewAt <= Date.now()) return 0.4;
  return 0;
}

function recentMissBoost(session: PracticeSession, skillId: SkillId): number {
  return Math.min(0.6, (session.missesBySkill[skillId] || 0) * 0.2);
}

function selectMasterySkill(profile: PracticeProfile, session: PracticeSession, grade: 1 | 2): SkillId {
  if (!provider) throw new Error("Practice provider not configured");
  const skills = provider.allSkills(grade);
  const recentSkills = session.answered.slice(-2).map((entry) => entry.skillId);
  let best = skills[0];
  let bestScore = -Infinity;
  for (const skill of skills) {
    let score =
      weakness(profile, skill) +
      recencyDecay(profile, skill) +
      contestWeight(skill) +
      dueForReview(profile, skill) +
      recentMissBoost(session, skill);

    if (recentSkills.includes(skill)) {
      score -= 0.25;
    }

    if (score > bestScore) {
      bestScore = score;
      best = skill;
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
    correct: isCorrect,
    responseMs
  });
  session.index += 1;

  if (!isCorrect) {
    session.missesBySkill[question.skillId] = (session.missesBySkill[question.skillId] || 0) + 1;
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

  const gradeKey = String(session.grade);
  const gradeStat = profile.gradeStats[gradeKey] || { sessions: 0, totalAttempts: 0, totalCorrect: 0 };
  gradeStat.totalAttempts += 1;
  gradeStat.totalCorrect += isCorrect ? 1 : 0;
  profile.gradeStats[gradeKey] = gradeStat;

  profile.recentQuestionHashes.push(question.variantKey);
  if (profile.recentQuestionHashes.length > 200) {
    profile.recentQuestionHashes = profile.recentQuestionHashes.slice(-200);
  }
  profile.updatedAt = now;
}

function tierForIndex(index: number): 3 | 4 | 5 {
  if (index < 8) return 3;
  if (index < 16) return 4;
  return 5;
}

export function nextQuestion(session: PracticeSession, profile: PracticeProfile): QuestionInstance {
  if (!provider) throw new Error("Practice provider not configured");
  const pointTier = tierForIndex(session.index);

  if (session.stage === "diagnostic") {
    const skills = provider.allSkills(session.grade);
    const skill = skills[session.index % skills.length];
    const q = provider.pickBySkill(session.grade, skill, session.askedQuestionHashes, pointTier);
    session.askedQuestionHashes.add(q.variantKey);
    return q;
  }

  if (session.stage === "mock") {
    const q = provider.pickAny(session.grade, session.askedQuestionHashes, pointTier);
    session.askedQuestionHashes.add(q.variantKey);
    return q;
  }

  const weakSkill = selectMasterySkill(profile, session, session.grade);
  const candidate = provider.pickBySkill(session.grade, weakSkill, session.askedQuestionHashes, pointTier);
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
