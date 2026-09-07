/**
 * Short, grade-scoped training; deliberately independent of contest sequencing.
 *
 * Supply allBandSkills(grade) or provider metadata to planMission. Resolve each
 * step with the existing provider's pickBySkill/pickByFamily. Record a stable,
 * content-based variantKey, not a generator seed; avoidVariantKeys uses those
 * recorded keys, so the caller must also maintain any provider-specific avoids.
 * Recording returns a new profile; assign it before planning again. A replay of
 * a grade/skill/family/variant is ignored forever, including an assisted variant.
 *
 * Planning and summaries are deterministic and never mutate their inputs. Their
 * default clock is profile.updatedAt; pass Date.now() for live review checks.
 * Only the factory and persistence boundaries use the wall clock by default.
 */
import type { BandId, Grade, PointTier, SkillId } from "../domain/types";
import { gradeToBand } from "../content/bands/common";
import { compactQuestionContent } from "./questionIdentity";

export const TRAINING_STORAGE_KEY = "mk_training_v1";
export const TRAINING_MISSION_LENGTH = 6;
const DAY_MS = 86_400_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;
const STORAGE_TIMEOUT_MS = 1000;

export interface TrainingAttempt {
  grade: Grade;
  skillId: SkillId;
  familyId: string;
  variantKey: string;
  correct: boolean;
  assisted: boolean;
  responseMs: number;
  /** Unix milliseconds. Review retrieval requires the due time AND a later UTC day. */
  now: number;
}

export interface TrainingGradeProgress {
  /** Canonical, chronological, unique variant evidence; no persisted mastery counters. */
  attempts: TrainingAttempt[];
}

export interface TrainingProfile {
  version: 1;
  createdAt: number;
  updatedAt: number;
  /** A learner's stated goal, never evidence of a rank or a predicted outcome. */
  aspiration: string | null;
  grades: Partial<Record<Grade, TrainingGradeProgress>>;
}

export interface TrainingSkillMetadata {
  skillId: SkillId;
  title?: string;
  /** Multiple distinct families require independent successes in at least two for mastery. */
  familyIds?: readonly string[];
}

export type TrainingSkillInput = SkillId | TrainingSkillMetadata;
export type TrainingReason = "unseen" | "due" | "weak" | "mixed";
export type TrainingSkillStatus = "unseen" | "needs-help" | "developing" | "review-due" | "mastered";

export interface TrainingEvidenceTotals {
  attempts: number;
  independentAttempts: number;
  independentCorrect: number;
  assistedAttempts: number;
  assistedCorrect: number;
  /** Observed time only: never used as a proxy for ability or ranking. */
  totalResponseMs: number;
}

export interface TrainingSkillSummary extends TrainingEvidenceTotals {
  skillId: SkillId;
  title: string;
  status: TrainingSkillStatus;
  mastered: boolean;
  independentAccuracy: number | null;
  recentIndependentAccuracy: number | null;
  distinctIndependentVariants: number;
  distinctIndependentFamilies: number;
  independentSuccessDays: number;
  successfulReviewDays: number;
  reviewStage: number;
  nextReviewAt: number | null;
  lastAttemptAt: number | null;
}

export interface TrainingDiagnosticCoverage {
  /** Skills with at least one independent attempt, correct or incorrect. */
  coveredSkills: number;
  encounteredSkills: number;
  totalSkills: number;
  remainingSkills: number;
  complete: boolean;
}

export interface TrainingMissionStep {
  skillId: SkillId;
  pointTier: PointTier;
  reason: TrainingReason;
  familyId?: string;
  avoidVariantKeys: string[];
}

export interface TrainingMission {
  kind: "training";
  grade: Grade;
  bandId: BandId;
  total: 0 | 6;
  steps: TrainingMissionStep[];
}

export interface TrainingMissionOptions {
  now?: number;
  skillMeta?: readonly TrainingSkillMetadata[];
}

export interface TrainingRecommendation {
  kind: "mission";
  title: string;
  description: string;
  skillIds: SkillId[];
}

export interface TrainingSummary {
  grade: Grade;
  diagnostic: TrainingDiagnosticCoverage;
  totals: TrainingEvidenceTotals;
  skills: TrainingSkillSummary[];
  masteredSkills: number;
  dueSkills: number;
  nextReviewAt: number | null;
  recommendation: TrainingRecommendation;
  aspiration: string | null;
  rankEvidence: "not-measured";
  evidenceNote: string;
}

/** Accepts localStorage or an asynchronous SDK-shaped adapter. Explicit null disables storage. */
export interface TrainingStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isGrade(value: unknown): value is Grade {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

function isTime(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15 - 30 * DAY_MS;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readAttempt(value: unknown): TrainingAttempt | null {
  if (!isObject(value) || !isGrade(value.grade) || !isId(value.skillId) || !isId(value.familyId)
    || !isId(value.variantKey) || typeof value.correct !== "boolean" || typeof value.assisted !== "boolean"
    || !isTime(value.now) || typeof value.responseMs !== "number" || !Number.isFinite(value.responseMs)
    || value.responseMs < 0 || value.responseMs > Number.MAX_SAFE_INTEGER) return null;
  let variantKey = value.variantKey;
  if (variantKey.trimStart().startsWith("[")) {
    try {
      const content: unknown = JSON.parse(variantKey);
      if (Array.isArray(content) && content.length === 4 && content.every((part) => typeof part === "string")
        && content[0] === value.familyId) {
        // Migrate the original serialized identity, without changing its exact bytes.
        variantKey = compactQuestionContent(variantKey);
      }
    } catch { /* Opaque or malformed provider keys remain valid, unchanged identities. */ }
  }
  return {
    grade: value.grade, skillId: value.skillId, familyId: value.familyId, variantKey,
    correct: value.correct, assisted: value.assisted, responseMs: value.responseMs, now: value.now
  };
}

function evidenceKey(attempt: TrainingAttempt): string {
  // Tuple encoding avoids collisions when provider identifiers contain separators.
  return JSON.stringify([attempt.skillId, attempt.familyId, attempt.variantKey]);
}

export function createTrainingProfile(now = Date.now()): TrainingProfile {
  const time = isTime(now) ? now : 0;
  return { version: 1, createdAt: time, updatedAt: time, aspiration: null, grades: {} };
}

/** Salvage valid evidence only; legacy practice counters cannot establish independent mastery. */
export function normalizeTrainingProfile(value: unknown, now = Date.now()): TrainingProfile {
  const profile = createTrainingProfile(now);
  if (!isObject(value) || value.version !== 1) return profile;
  if (isTime(value.createdAt)) profile.createdAt = value.createdAt;
  profile.updatedAt = Math.max(profile.createdAt, isTime(value.updatedAt) ? value.updatedAt : 0);
  if (typeof value.aspiration === "string" && value.aspiration.trim()) profile.aspiration = value.aspiration.trim();
  if (!isObject(value.grades)) return profile;
  for (let number = 1; number <= 12; number += 1) {
    const grade = number as Grade;
    const entry = value.grades[grade];
    if (!isObject(entry) || !Array.isArray(entry.attempts)) continue;
    const seen = new Set<string>();
    const attempts = entry.attempts.map(readAttempt)
      .filter((attempt): attempt is TrainingAttempt => attempt !== null && attempt.grade === grade)
      .sort((a, b) => a.now - b.now)
      .filter((attempt) => {
        const key = evidenceKey(attempt);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!attempts.length) continue;
    profile.grades[grade] = { attempts };
    profile.createdAt = Math.min(profile.createdAt, attempts[0].now);
    profile.updatedAt = Math.max(profile.updatedAt, attempts[attempts.length - 1].now);
  }
  return profile;
}

/** Immutable. Invalid attempts and exact variant replays return the original profile unchanged. */
export function recordTrainingAttempt(profile: TrainingProfile, input: TrainingAttempt): TrainingProfile {
  const attempt = readAttempt(input);
  if (!attempt) return profile;
  const previous = profile.grades[attempt.grade]?.attempts ?? [];
  if (previous.some((entry) => evidenceKey(entry) === evidenceKey(attempt))) return profile;
  return {
    ...profile,
    createdAt: Math.min(profile.createdAt, attempt.now),
    updatedAt: Math.max(profile.updatedAt, attempt.now),
    grades: {
      ...profile.grades,
      [attempt.grade]: { attempts: [...previous, attempt].sort((a, b) => a.now - b.now) }
    }
  };
}

function evidenceTotals(attempts: readonly TrainingAttempt[]): TrainingEvidenceTotals {
  const independent = attempts.filter((attempt) => !attempt.assisted);
  const assisted = attempts.filter((attempt) => attempt.assisted);
  return {
    attempts: attempts.length,
    independentAttempts: independent.length,
    independentCorrect: independent.filter((attempt) => attempt.correct).length,
    assistedAttempts: assisted.length,
    assistedCorrect: assisted.filter((attempt) => attempt.correct).length,
    totalResponseMs: attempts.reduce((sum, attempt) => sum + attempt.responseMs, 0)
  };
}

function skillInputs(inputs: readonly TrainingSkillInput[], metadata: readonly TrainingSkillMetadata[] = []): TrainingSkillMetadata[] {
  const extra = new Map(metadata.map((entry) => [entry.skillId, entry]));
  const unique = new Map<SkillId, TrainingSkillMetadata>();
  for (const input of inputs) {
    const entry = typeof input === "string" ? { skillId: input } : input;
    if (!entry || !isId(entry.skillId) || unique.has(entry.skillId)) continue;
    unique.set(entry.skillId, { ...extra.get(entry.skillId), ...entry });
  }
  return [...unique.values()];
}

function summarizeSkill(meta: TrainingSkillMetadata, attempts: TrainingAttempt[], now: number): TrainingSkillSummary {
  const totals = evidenceTotals(attempts);
  const independent = attempts.filter((attempt) => !attempt.assisted);
  const successes = independent.filter((attempt) => attempt.correct);
  const distinctIndependentFamilies = new Set(successes.map((attempt) => attempt.familyId)).size;
  const requiredFamilies = new Set(meta.familyIds?.filter(isId) ?? []).size > 1 ? 2 : 1;
  const recent = independent.slice(-5);
  const recentAccuracy = recent.length ? recent.filter((attempt) => attempt.correct).length / recent.length : null;
  let reviewStage = 0;
  let nextReviewAt: number | null = null;
  let retrievalAnchorAt: number | null = null;
  const reviewDays = new Set<number>();
  for (const attempt of attempts) {
    if (attempt.assisted) {
      // Help records participation, but cannot advance or postpone an existing review.
      nextReviewAt ??= attempt.now + DAY_MS;
    } else if (!attempt.correct) {
      reviewStage = 0;
      retrievalAnchorAt = null;
      nextReviewAt = attempt.now + DAY_MS;
    } else if (retrievalAnchorAt === null) {
      retrievalAnchorAt = attempt.now;
      nextReviewAt = attempt.now + DAY_MS;
    } else if (nextReviewAt !== null && attempt.now >= nextReviewAt
      && Math.floor(attempt.now / DAY_MS) > Math.floor(retrievalAnchorAt / DAY_MS)) {
      reviewStage = Math.min(reviewStage + 1, REVIEW_DAYS.length - 1);
      reviewDays.add(Math.floor(attempt.now / DAY_MS));
      retrievalAnchorAt = attempt.now;
      nextReviewAt = attempt.now + REVIEW_DAYS[reviewStage] * DAY_MS;
    }
  }
  // A practice criterion, not a claim of full curriculum mastery or contest readiness.
  const mastered = successes.length >= 3 && distinctIndependentFamilies >= requiredFamilies
    && reviewStage >= 1 && (recentAccuracy ?? 0) >= 0.8;
  const needsHelp = totals.attempts > 0 && (!successes.length || independent[independent.length - 1]?.correct === false);
  const status: TrainingSkillStatus = !totals.attempts ? "unseen"
    : nextReviewAt !== null && nextReviewAt <= now ? "review-due"
      : needsHelp ? "needs-help" : mastered ? "mastered" : "developing";
  return {
    ...totals,
    skillId: meta.skillId,
    title: meta.title || meta.skillId,
    status,
    mastered,
    independentAccuracy: totals.independentAttempts ? totals.independentCorrect / totals.independentAttempts : null,
    recentIndependentAccuracy: recentAccuracy,
    distinctIndependentVariants: successes.length,
    distinctIndependentFamilies,
    independentSuccessDays: new Set(successes.map((attempt) => Math.floor(attempt.now / DAY_MS))).size,
    successfulReviewDays: reviewDays.size,
    reviewStage,
    nextReviewAt,
    lastAttemptAt: attempts[attempts.length - 1]?.now ?? null
  };
}

function skillSummaries(profile: TrainingProfile, grade: Grade, skills: TrainingSkillMetadata[], now: number): TrainingSkillSummary[] {
  const attempts = profile.grades[grade]?.attempts ?? [];
  return skills.map((meta) => summarizeSkill(meta, attempts.filter((attempt) => attempt.skillId === meta.skillId), now));
}

function buildMission(profile: TrainingProfile, grade: Grade, metadata: TrainingSkillMetadata[], summaries: TrainingSkillSummary[], now: number): TrainingMission {
  const mission: TrainingMission = { kind: "training", grade, bandId: gradeToBand(grade), total: 0, steps: [] };
  if (!summaries.length) return mission;
  const attempts = profile.grades[grade]?.attempts ?? [];
  const useCounts = new Map<SkillId, number>();
  const preferences: TrainingReason[] = ["unseen", "due", "weak", "unseen", "due", "mixed"];
  const matches = (skill: TrainingSkillSummary, reason: TrainingReason): boolean => {
    if (reason === "unseen") return skill.attempts === 0;
    if (reason === "due") return skill.nextReviewAt !== null && skill.nextReviewAt <= now;
    if (reason === "weak") return skill.attempts > 0 && !skill.mastered;
    return true;
  };
  for (const preference of preferences) {
    // Every available skill gets a turn before any skill repeats within a mission.
    const minimumUse = Math.min(...summaries.map((skill) => useCounts.get(skill.skillId) ?? 0));
    let eligible = summaries.filter((skill) => (useCounts.get(skill.skillId) ?? 0) === minimumUse);
    const previousSkill = mission.steps[mission.steps.length - 1]?.skillId;
    if (eligible.some((skill) => skill.skillId !== previousSkill)) eligible = eligible.filter((skill) => skill.skillId !== previousSkill);
    const preferred = eligible.filter((skill) => matches(skill, preference));
    const pool = preferred.length ? preferred : eligible;
    pool.sort((a, b) => {
      if (preference === "weak" && preferred.length) {
        const accuracy = (a.recentIndependentAccuracy ?? 0) - (b.recentIndependentAccuracy ?? 0);
        if (accuracy) return accuracy;
      }
      if (preference === "due" && preferred.length) {
        const overdue = (a.nextReviewAt ?? Infinity) - (b.nextReviewAt ?? Infinity);
        if (overdue) return overdue;
      }
      // Oldest-first ties prevent weak or already-sampled skills monopolizing later sessions.
      return (a.lastAttemptAt ?? -1) - (b.lastAttemptAt ?? -1) || a.attempts - b.attempts;
    });
    const skill = pool[0];
    const reason = matches(skill, preference) ? preference
      : (["unseen", "due", "weak", "mixed"] as const).find((candidate) => matches(skill, candidate))!;
    const occurrence = useCounts.get(skill.skillId) ?? 0;
    const families = [...new Set(metadata.find((meta) => meta.skillId === skill.skillId)?.familyIds?.filter(isId) ?? [])];
    const familyId = families.length ? families[(skill.attempts + occurrence) % families.length] : undefined;
    mission.steps.push({
      skillId: skill.skillId,
      pointTier: skill.mastered ? 5 : skill.independentCorrect >= 3 && (skill.recentIndependentAccuracy ?? 0) >= 0.8 ? 4 : 3,
      reason,
      ...(familyId === undefined ? {} : { familyId }),
      avoidVariantKeys: [...new Set(attempts.map((attempt) => attempt.variantKey))]
    });
    useCounts.set(skill.skillId, occurrence + 1);
  }
  mission.total = TRAINING_MISSION_LENGTH;
  return mission;
}

/** Six adaptive provider requests (zero for an empty catalog); never generates questions or starts a contest. */
export function planMission(profile: TrainingProfile, grade: Grade, availableSkills: readonly TrainingSkillInput[], options: TrainingMissionOptions = {}): TrainingMission {
  if (!isGrade(grade)) throw new RangeError("Training grade must be between 1 and 12");
  const now = isTime(options.now) ? options.now : profile.updatedAt;
  const metadata = skillInputs(availableSkills, options.skillMeta);
  return buildMission(profile, grade, metadata, skillSummaries(profile, grade, metadata, now), now);
}

/** Evidence and diagnostic coverage are scoped to this grade and the supplied skill catalog. */
export function getTrainingSummary(profile: TrainingProfile, grade: Grade, inputs: readonly TrainingSkillInput[], now = profile.updatedAt): TrainingSummary {
  if (!isGrade(grade)) throw new RangeError("Training grade must be between 1 and 12");
  const clock = isTime(now) ? now : profile.updatedAt;
  const metadata = skillInputs(inputs);
  const skills = skillSummaries(profile, grade, metadata, clock);
  const allowed = new Set(metadata.map((meta) => meta.skillId));
  const totals = evidenceTotals((profile.grades[grade]?.attempts ?? []).filter((attempt) => allowed.has(attempt.skillId)));
  const coveredSkills = skills.filter((skill) => skill.independentAttempts > 0).length;
  const dueSkills = skills.filter((skill) => skill.nextReviewAt !== null && skill.nextReviewAt <= clock).length;
  const reviewDates = skills.flatMap((skill) => skill.nextReviewAt === null ? [] : [skill.nextReviewAt]);
  const mission = buildMission(profile, grade, metadata, skills, clock);
  return {
    grade,
    diagnostic: {
      coveredSkills,
      encounteredSkills: skills.filter((skill) => skill.attempts > 0).length,
      totalSkills: skills.length,
      remainingSkills: skills.length - coveredSkills,
      complete: skills.length > 0 && coveredSkills === skills.length
    },
    totals,
    skills,
    masteredSkills: skills.filter((skill) => skill.mastered).length,
    dueSkills,
    nextReviewAt: reviewDates.length ? Math.min(...reviewDates) : null,
    recommendation: {
      kind: "mission",
      title: !skills.length ? "No training skills available" : dueSkills ? "Review and explore" : coveredSkills < skills.length ? "Discover your next skills" : "Build independent confidence",
      description: !skills.length ? "Choose a grade with available training skills."
        : `Try 6 questions mixing new skills, due reviews, and skills needing practice. ${coveredSkills}/${skills.length} skills sampled independently; ${dueSkills} due for review.`,
      skillIds: [...new Set(mission.steps.map((step) => step.skillId))]
    },
    aspiration: profile.aspiration,
    rankEvidence: "not-measured",
    evidenceNote: "Training is not contest evidence and predicts no rank or score. A skill is practiced independently after 3 correct distinct variants, a successful due review on a later UTC day, and at least 80% correct among the last 5 independent attempts (or all if fewer). When metadata lists multiple families, independent successes must span at least 2 distinct families; otherwise 1 family suffices. Help and replay never advance mastery. Start any contest explicitly."
  };
}

type StorageTarget = { storage: TrainingStorage; base64: boolean };
type PendingStorageWrite = { value: string; finish: (written: boolean) => void };
type StorageWriteQueue = { running: boolean; pending: PendingStorageWrite | null };

// The raw operation, not its timeout wrapper, owns this per-store lock. Retain
// only the active snapshot and the newest pending snapshot if an SDK hangs.
const storageWriteQueues = new WeakMap<TrainingStorage, StorageWriteQueue>();

async function flushStorageWrites(storage: TrainingStorage, queue: StorageWriteQueue): Promise<void> {
  queue.running = true;
  while (queue.pending) {
    const write = queue.pending;
    queue.pending = null;
    try {
      await storage.setItem(TRAINING_STORAGE_KEY, write.value);
      write.finish(true);
    } catch {
      write.finish(false);
    }
  }
  queue.running = false;
}

function enqueueStorageWrite(storage: TrainingStorage, value: string): Promise<boolean> {
  let queue = storageWriteQueues.get(storage);
  if (!queue) {
    queue = { running: false, pending: null };
    storageWriteQueues.set(storage, queue);
  }
  const targetQueue = queue;
  return new Promise((finish) => {
    targetQueue.pending?.finish(false);
    targetQueue.pending = { value, finish };
    if (!targetQueue.running) void flushStorageWrites(storage, targetQueue);
  });
}

/** Also observes late rejections, so a timed-out SDK cannot cause an unhandled rejection. */
function boundedStorageCall<T>(operation: () => T | Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false }), STORAGE_TIMEOUT_MS);
    Promise.resolve().then(operation).then(
      (value) => { clearTimeout(timer); resolve({ ok: true, value }); },
      () => { clearTimeout(timer); resolve({ ok: false }); }
    );
  });
}

function storageTargets(override?: TrainingStorage | null): StorageTarget[] {
  if (override !== undefined) return override === null ? [] : [{ storage: override, base64: false }];
  const targets: StorageTarget[] = [];
  try {
    const sdk = (globalThis as unknown as { creationStorage?: { plain?: TrainingStorage } }).creationStorage?.plain;
    if (sdk) targets.push({ storage: sdk, base64: true });
  } catch { /* An inaccessible SDK must not block local persistence. */ }
  try {
    const local = globalThis.localStorage;
    if (local) targets.push({ storage: local, base64: false });
  } catch { /* Sandboxed/private browsing can throw even when accessing the getter. */ }
  return targets;
}

/** Reads stores in parallel, with a one-second deadline, and selects the newest valid snapshot. */
export async function loadTrainingProfile(storage?: TrainingStorage | null, now = Date.now()): Promise<TrainingProfile> {
  const profiles = await Promise.all(storageTargets(storage).map(async (target) => {
    const result = await boundedStorageCall(() => target.storage.getItem(TRAINING_STORAGE_KEY));
    if (!result.ok || !result.value) return null;
    try {
      let value: unknown;
      try { value = JSON.parse(result.value); }
      catch { value = JSON.parse(atob(result.value)); }
      if (isObject(value) && value.version === 1 && isTime(value.createdAt)
        && isTime(value.updatedAt) && isObject(value.grades)) return normalizeTrainingProfile(value, now);
    } catch { /* A corrupt store cannot hide a valid snapshot in the other store. */ }
    return null;
  }));
  let newest: TrainingProfile | null = null;
  const evidenceCount = (profile: TrainingProfile) => Object.values(profile.grades).reduce((sum, grade) => sum + grade.attempts.length, 0);
  for (const profile of profiles) {
    if (profile && (!newest || profile.updatedAt > newest.updatedAt
      || (profile.updatedAt === newest.updatedAt && evidenceCount(profile) > evidenceCount(newest)))) newest = profile;
  }
  return newest ?? createTrainingProfile(now);
}

/**
 * Writes stores independently with one-second caller deadlines. Raw writes are
 * serialized per store even after timeout; pending snapshots coalesce to the last
 * save call. True means this snapshot was confirmed in at least one store. False
 * can mean unavailable, superseded, or still queued; it never cancels a raw write.
 */
export async function saveTrainingProfile(profile: TrainingProfile, storage?: TrainingStorage | null): Promise<boolean> {
  const serialized = JSON.stringify(normalizeTrainingProfile(profile, profile.updatedAt));
  // Escape Unicode before btoa so SDK persistence supports non-ASCII learner goals.
  const ascii = serialized.replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const results = await Promise.all(storageTargets(storage).map(async (target) => {
    const result = await boundedStorageCall(() => enqueueStorageWrite(target.storage, target.base64 ? btoa(ascii) : serialized));
    return result.ok && result.value;
  }));
  return results.some(Boolean);
}
