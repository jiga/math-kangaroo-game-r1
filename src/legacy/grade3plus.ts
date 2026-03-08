import type { Grade, PointTier, QuestionInstance } from "../domain/types";
import { SeededRng, shuffledOptions } from "../content/g1g2/helpers";

function make(id: string, grade: Grade, pointTier: PointTier, skill: string, prompt: string, correct: string, distractors: string[], explanation: string): QuestionInstance {
  const rng = new SeededRng(Number(id.replace(/\D/g, "").slice(-8)) || 1);
  const packed = shuffledOptions(correct, distractors, rng);
  return {
    id,
    grade,
    pointTier,
    skillId: "single_digit_add_sub",
    format: "text",
    prompt,
    options: packed.options,
    answerIndex: packed.answerIndex,
    explanation,
    coachPackId: "single_digit_add_sub",
    variantKey: `${id}|${prompt}|${correct}`
  };
}

function pointTierByIndex(index: number, total: number): PointTier {
  if (index < Math.round(total * 0.4)) return 3;
  if (index < Math.round(total * 0.75)) return 4;
  return 5;
}

function totalForGrade(grade: Grade): number {
  return grade <= 4 ? 24 : 30;
}

export function buildLegacyContestQuestions(grade: Grade, seed = Date.now()): QuestionInstance[] {
  const total = totalForGrade(grade);
  const rng = new SeededRng(seed + grade * 7);
  const out: QuestionInstance[] = [];

  for (let i = 0; i < total; i += 1) {
    const tier = pointTierByIndex(i, total);
    const a = rng.int(grade, grade * 8 + 12);
    const b = rng.int(2, grade * 5 + 5);
    const type = (i + grade) % 6;

    if (type === 0) {
      const c = a + b;
      out.push(make(`g${grade}_q${i}`, grade, tier, "addition", `${a} + ${b} = ?`, String(c), [String(c + 1), String(c - 1), String(c + 2), String(Math.max(0, c - 2))], "Add the two numbers."));
    } else if (type === 1) {
      const x = Math.max(a, b);
      const y = Math.min(a, b);
      const c = x - y;
      out.push(make(`g${grade}_q${i}`, grade, tier, "subtraction", `${x} - ${y} = ?`, String(c), [String(c + 1), String(Math.max(0, c - 1)), String(c + 2), String(Math.max(0, c - 2))], "Subtract the smaller number from the larger number."));
    } else if (type === 2) {
      const m = rng.int(2, Math.min(12, grade + 5));
      const n = rng.int(2, Math.min(12, grade + 6));
      const c = m * n;
      out.push(make(`g${grade}_q${i}`, grade, tier, "multiplication", `${m} × ${n} = ?`, String(c), [String(c + m), String(c - m), String(c + n), String(Math.max(0, c - n))], "Multiply factors."));
    } else if (type === 3) {
      const d = rng.int(2, Math.min(12, grade + 5));
      const q = rng.int(2, Math.min(12, grade + 6));
      const dividend = d * q;
      out.push(make(`g${grade}_q${i}`, grade, tier, "division", `${dividend} ÷ ${d} = ?`, String(q), [String(q + 1), String(Math.max(0, q - 1)), String(q + 2), String(Math.max(0, q - 2))], "Use inverse of multiplication."));
    } else if (type === 4) {
      const p = rng.int(20, 120);
      const percent = rng.pick([10, 20, 25, 50]);
      const c = Math.round((p * percent) / 100);
      out.push(make(`g${grade}_q${i}`, grade, tier, "percent", `${percent}% of ${p} = ?`, String(c), [String(c + 2), String(c - 2), String(c + 5), String(Math.max(0, c - 5))], "Convert percent to fraction and multiply."));
    } else {
      const x1 = rng.int(-2, 4);
      const y1 = rng.int(-2, 4);
      const x2 = x1 + rng.int(1, 5);
      const y2 = y1 + rng.int(1, 5);
      const num = y2 - y1;
      const den = x2 - x1;
      const c = `${num}/${den}`;
      out.push(make(`g${grade}_q${i}`, grade, tier, "slope", `Slope between (${x1},${y1}) and (${x2},${y2})?`, c, [`${den}/${num}`, `${num + 1}/${den}`, `${num}/${den + 1}`, `${num + 2}/${den}`], "Slope is rise over run."));
    }
  }

  return out;
}

export function totalQuestionsForGrade(grade: Grade): number {
  return totalForGrade(grade);
}
