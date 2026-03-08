import type { PracticeProfile } from "../domain/types";

const STORAGE_KEY = "mk_profile_v2";
const LEGACY_KEYS = ["mk_profile_v1", "mk_profile"];

type CreationStorageApi = {
  plain?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
};

function now(): number {
  return Date.now();
}

function emptyProfile(): PracticeProfile {
  return {
    version: 2,
    createdAt: now(),
    updatedAt: now(),
    gradeStats: {},
    skills: {},
    families: {},
    recentQuestionHashes: []
  };
}

function encodeBase64(value: string): string {
  if (typeof btoa === "function") return btoa(value);
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64(value: string): string {
  if (typeof atob === "function") return atob(value);
  return Buffer.from(value, "base64").toString("utf8");
}

function getCreationStorage(): CreationStorageApi | null {
  const storage = (globalThis as unknown as { creationStorage?: CreationStorageApi }).creationStorage;
  return storage?.plain ? storage : null;
}

function migrateLegacy(raw: unknown): PracticeProfile {
  if (!raw || typeof raw !== "object") return emptyProfile();
  const obj = raw as Record<string, unknown>;
  const migrated: PracticeProfile = {
    version: 2,
    createdAt: Number(obj.createdAt || now()),
    updatedAt: now(),
    gradeStats: (obj.gradeStats as PracticeProfile["gradeStats"]) || {},
    skills: (obj.skills as PracticeProfile["skills"]) || {},
    families: (obj.families as PracticeProfile["families"]) || {},
    recentQuestionHashes: Array.isArray(obj.recentQuestionHashes)
      ? (obj.recentQuestionHashes as string[]).slice(-200)
      : []
  };
  return migrated;
}

export function loadProfile(): PracticeProfile {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      return migrateLegacy(JSON.parse(current));
    }

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = migrateLegacy(JSON.parse(legacy));
      saveProfile(migrated);
      return migrated;
    }
  } catch {
    // ignore and return empty profile
  }
  return emptyProfile();
}

export function saveProfile(profile: PracticeProfile): void {
  const normalized = {
    ...profile,
    version: 2,
    updatedAt: now(),
    recentQuestionHashes: (profile.recentQuestionHashes || []).slice(-200)
  } satisfies PracticeProfile;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export async function loadProfileAsync(): Promise<PracticeProfile> {
  const local = loadProfile();
  const creationStorage = getCreationStorage();
  if (!creationStorage?.plain) return local;

  try {
    const stored = await creationStorage.plain.getItem(STORAGE_KEY);
    if (stored) {
      return migrateLegacy(JSON.parse(decodeBase64(stored)));
    }

    for (const key of LEGACY_KEYS) {
      const legacy = await creationStorage.plain.getItem(key);
      if (!legacy) continue;
      const migrated = migrateLegacy(JSON.parse(decodeBase64(legacy)));
      await saveProfileAsync(migrated);
      return migrated;
    }
  } catch {
    return local;
  }

  return local;
}

export async function saveProfileAsync(profile: PracticeProfile): Promise<void> {
  saveProfile(profile);
  const creationStorage = getCreationStorage();
  if (!creationStorage?.plain) return;

  const normalized = {
    ...profile,
    version: 2,
    updatedAt: now(),
    recentQuestionHashes: (profile.recentQuestionHashes || []).slice(-200)
  } satisfies PracticeProfile;

  try {
    await creationStorage.plain.setItem(STORAGE_KEY, encodeBase64(JSON.stringify(normalized)));
  } catch {
    // Keep localStorage as fallback.
  }
}

export const PROFILE_STORAGE_KEY = STORAGE_KEY;
