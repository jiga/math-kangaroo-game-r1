import type { PointTier } from "../../domain/types";

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

export function shuffled<T>(arr: readonly T[], rng: SeededRng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function uniqueFiveOptions(correct: string, distractors: string[]): [string, string, string, string, string] {
  const seen = new Set<string>([correct]);
  const list = [correct];
  for (const d of distractors) {
    if (!seen.has(d)) {
      seen.add(d);
      list.push(d);
    }
  }
  while (list.length < 5) {
    list.push(`${correct}*${list.length}`);
  }
  return [list[0], list[1], list[2], list[3], list[4]];
}

export function shuffledOptions(
  correct: string,
  distractors: string[],
  rng: SeededRng
): { options: [string, string, string, string, string]; answerIndex: number } {
  const base = uniqueFiveOptions(correct, distractors);
  const mutable = [...base];
  for (let i = mutable.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [mutable[i], mutable[j]] = [mutable[j], mutable[i]];
  }
  return {
    options: [mutable[0], mutable[1], mutable[2], mutable[3], mutable[4]],
    answerIndex: mutable.indexOf(correct)
  };
}

export function pointTierByIndex(index: number, total: number): PointTier {
  const slot = index % 3;
  if (slot === 0) return 3;
  if (slot === 1) return 4;
  return 5;
}

export function officialContestPointTier(index: number): PointTier {
  if (index < 8) return 3;
  if (index < 16) return 4;
  return 5;
}

export function toTimeLabel(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function hashQuestion(parts: Array<string | number>): string {
  return parts.join("|");
}
