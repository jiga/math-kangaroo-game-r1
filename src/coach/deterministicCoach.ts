import type { CoachPack, QuestionInstance, SkillId } from "../domain/types";

const DEFAULT_COACH: CoachPack = {
  hint: "Circle the key numbers and restate what the question asks.",
  errorDiagnosis: "You likely mixed steps. Solve one small step, then check choices.",
  speedTactic: "Eliminate impossible options before computing.",
  miniExample: "Example: If you need half of 8, split into two equal groups -> 4."
};

const SKILL_COACH: Record<SkillId, CoachPack> = {
  counting_ordering: {
    hint: "Point-count in groups of 2 or 5.",
    errorDiagnosis: "Common miss: skipping an object while counting.",
    speedTactic: "Mark every 5th object mentally to avoid recounting.",
    miniExample: "10 dots in two rows of 5 -> 5 + 5 = 10."
  },
  compare_number_region: {
    hint: "Compare by place value first, then by ones.",
    errorDiagnosis: "Common miss: comparing digit count incorrectly.",
    speedTactic: "For regions, compare by equal unit squares.",
    miniExample: "38 vs 42 -> tens 3 < 4, so 42 is larger."
  },
  ordinal_numbers: {
    hint: "Ordinal means position: 1st, 2nd, 3rd...",
    errorDiagnosis: "Common miss: treating ordinal as quantity.",
    speedTactic: "Track position with fingers while reading sequence.",
    miniExample: "In A,B,C,D,E the 4th is D."
  },
  place_value: {
    hint: "Break number into tens and ones.",
    errorDiagnosis: "Common miss: swapping tens and ones.",
    speedTactic: "Use 34 = 3 tens + 4 ones immediately.",
    miniExample: "47 has 4 tens and 7 ones."
  },
  single_digit_add_sub: {
    hint: "Use make-10 strategy first.",
    errorDiagnosis: "Common miss: dropping a carry/borrow.",
    speedTactic: "For 8+7 do 8+2+5.",
    miniExample: "9 + 6 = (9 + 1) + 5 = 15."
  },
  number_line: {
    hint: "Move right for plus, left for minus.",
    errorDiagnosis: "Common miss: moving in wrong direction.",
    speedTactic: "Count jumps, not all numbers.",
    miniExample: "Start 6, +3 -> 7,8,9."
  },
  fractions_words: {
    hint: "Half means 1 of 2 equal parts.",
    errorDiagnosis: "Common miss: parts are not equal.",
    speedTactic: "Say fraction as 'selected equal parts/total equal parts'.",
    miniExample: "Quarter of 12 -> 12 / 4 = 3."
  },
  sorting_classifying: {
    hint: "Choose one rule only for sorting.",
    errorDiagnosis: "Common miss: mixing two different rules.",
    speedTactic: "Write the rule in one short phrase.",
    miniExample: "Sort by color only: all red together."
  },
  measurement_small: {
    hint: "Convert to same unit first.",
    errorDiagnosis: "Common miss: comparing different units directly.",
    speedTactic: "Remember 1 m=100 cm, 1 kg=1000 g, 1 L=1000 mL.",
    miniExample: "90 cm < 1 m because 1 m=100 cm."
  },
  patterns: {
    hint: "Find the repeating or growing rule.",
    errorDiagnosis: "Common miss: using a different rule at each step.",
    speedTactic: "Check first two jumps; if equal, continue same jump.",
    miniExample: "3,6,9,12 adds +3 each time."
  },
  perimeter_broken_lines: {
    hint: "Perimeter means all outer sides added.",
    errorDiagnosis: "Common miss: using area instead of perimeter.",
    speedTactic: "Trace edge once with finger while summing.",
    miniExample: "Sides 2,3,2,3 -> perimeter 10."
  },
  relative_position: {
    hint: "Use anchor words: left/right, above/below, inside/outside.",
    errorDiagnosis: "Common miss: viewpoint confusion.",
    speedTactic: "Pick one reference object and compare everything to it.",
    miniExample: "If cat is left of dog, dog is right of cat."
  },
  shape_properties: {
    hint: "Count sides and corners first.",
    errorDiagnosis: "Common miss: confusing rectangle and square properties.",
    speedTactic: "Triangle=3, square=4 equal sides, rectangle=opposite equal.",
    miniExample: "Pentagon has 5 sides."
  },
  maze_shape_puzzles: {
    hint: "Try shortest path and mark dead ends mentally.",
    errorDiagnosis: "Common miss: revisiting blocked branch.",
    speedTactic: "Check finish proximity before long detours.",
    miniExample: "At split, choose path that keeps moving toward goal."
  },
  cube_cuboid_visualization: {
    hint: "Imagine folding/unfolding one face at a time.",
    errorDiagnosis: "Common miss: opposite faces mistaken as adjacent.",
    speedTactic: "Track one corner through rotation.",
    miniExample: "A cube has 6 faces, 8 vertices."
  },
  likelihood_vocabulary: {
    hint: "Impossible=0 chance, certain=always.",
    errorDiagnosis: "Common miss: mixing 'less likely' and 'unlikely'.",
    speedTactic: "Compare favorable outcomes to total quickly.",
    miniExample: "Rolling 7 on a die is impossible."
  },
  pictographs_bar_graphs: {
    hint: "Read legend before counting symbols.",
    errorDiagnosis: "Common miss: each icon may represent more than 1.",
    speedTactic: "Multiply icon count by legend value once.",
    miniExample: "4 icons with value 2 each -> 8 total."
  },
  venn_diagrams_easy: {
    hint: "Start from overlap first, then unique parts.",
    errorDiagnosis: "Common miss: double-counting overlap.",
    speedTactic: "Total = A only + both + B only.",
    miniExample: "3 + 2 + 4 = 9 in union."
  },
  calendar: {
    hint: "Use day cycle of 7 and month cycle of 12.",
    errorDiagnosis: "Common miss: off-by-one when counting days ahead.",
    speedTactic: "Count jumps, not start day twice.",
    miniExample: "After Tuesday comes Wednesday."
  },
  money_small: {
    hint: "Convert all coins to cents first.",
    errorDiagnosis: "Common miss: confusing nickels and dimes.",
    speedTactic: "Group to 10s and 25s when possible.",
    miniExample: "2 nickels + 1 dime = 20 cents."
  },
  clock_full_half: {
    hint: "Half hour means :30.",
    errorDiagnosis: "Common miss: hour hand position at :30.",
    speedTactic: "For full hours read only short hand.",
    miniExample: "3:30 is half past 3."
  },
  symmetry_rotation: {
    hint: "Mirror means flip across line.",
    errorDiagnosis: "Common miss: rotating when reflection is needed.",
    speedTactic: "Check each point distance to axis is equal.",
    miniExample: "A reflected shape has reversed left-right order."
  },
  prealgebra_balance: {
    hint: "Equal sign means both sides same value.",
    errorDiagnosis: "Common miss: changing one side only.",
    speedTactic: "Undo operations from outside in.",
    miniExample: "If x+3=8, then x=5."
  }
};

export function getDeterministicCoach(question: QuestionInstance, correct: boolean): CoachPack {
  const base = SKILL_COACH[question.skillId] || DEFAULT_COACH;
  const strategyLine = question.strategyTags.length
    ? `Use this move: ${question.strategyTags.slice(0, 2).join(", ")}.`
    : base.hint;
  const diagnosisLine = question.trapWarning
    ? `Watch the trap: ${question.trapWarning}`
    : base.errorDiagnosis;
  const exampleLine =
    question.explanation.length <= 160 ? question.explanation : base.miniExample;

  if (correct) {
    return {
      hint: strategyLine,
      errorDiagnosis: "Correct strategy. Repeat the same pattern on similar questions.",
      speedTactic: base.speedTactic,
      miniExample: exampleLine
    };
  }
  return {
    hint: strategyLine,
    errorDiagnosis: diagnosisLine,
    speedTactic: base.speedTactic,
    miniExample: exampleLine
  };
}
