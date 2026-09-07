import type { Grade } from '../domain/types';

export type LearnerPreferences = {
  grade: Grade;
  theme: 'neon' | 'gameboy';
  explored: string[];
  mockHistory: Array<{ grade: Grade; score: number; maxScore: number; correct: number; total: number; at: number }>;
};

const KEY = 'mk_studio_preferences_v1';
export function loadPreferences(): LearnerPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      grade: Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 12 ? value.grade : 1,
      theme: value.theme === 'neon' ? 'neon' : 'gameboy',
      explored: Array.isArray(value.explored) ? value.explored.filter((id: unknown) => typeof id === 'string').slice(-300) : [],
      mockHistory: Array.isArray(value.mockHistory) ? value.mockHistory.filter((entry: any) =>
        entry && Number.isInteger(entry.grade) && entry.grade >= 1 && entry.grade <= 12 &&
        [entry.score, entry.maxScore, entry.correct, entry.total, entry.at].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0) &&
        entry.score <= entry.maxScore && entry.correct <= entry.total && (entry.total === 24 || entry.total === 30)
      ).slice(-30) : []
    };
  } catch {
    return { grade: 1, theme: 'gameboy', explored: [], mockHistory: [] };
  }
}

export function savePreferences(preferences: LearnerPreferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Learning still works without persistence. */ }
}
