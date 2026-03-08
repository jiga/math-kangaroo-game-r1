import test from "node:test";
import assert from "node:assert/strict";
import { loadProfileAsync, saveProfileAsync } from "../src/storage/profileStore";
import type { PracticeProfile } from "../src/domain/types";

function makeProfile(): PracticeProfile {
  return {
    version: 2,
    createdAt: 1,
    updatedAt: 1,
    gradeStats: { "1": { sessions: 1, totalAttempts: 3, totalCorrect: 2 } },
    skills: {},
    recentQuestionHashes: ["a", "b"]
  };
}

test("profile storage uses creationStorage when available", async () => {
  const store = new Map<string, string>();
  const originalLocalStorage = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  const originalCreationStorage = (globalThis as unknown as { creationStorage?: unknown }).creationStorage;

  (globalThis as unknown as { localStorage?: Storage }).localStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0
  };

  (globalThis as unknown as { creationStorage?: { plain: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> } } }).creationStorage = {
    plain: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      }
    }
  };

  const profile = makeProfile();
  await saveProfileAsync(profile);
  const loaded = await loadProfileAsync();

  assert.equal(loaded.gradeStats["1"]?.sessions, 1);
  assert.ok(store.size > 0);

  (globalThis as unknown as { localStorage?: Storage }).localStorage = originalLocalStorage;
  (globalThis as unknown as { creationStorage?: unknown }).creationStorage = originalCreationStorage;
});
