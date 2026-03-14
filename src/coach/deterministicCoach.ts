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

function humanizeSkill(skillId: SkillId): string {
  return skillId.replaceAll("_", " ");
}

function genericCoach(question: QuestionInstance): CoachPack {
  const lead = question.strategyTags[0] || "spot the rule";
  const next = question.strategyTags[1] || "check one small step";
  return {
    hint: `Start with ${lead}. Name the target before you calculate.`,
    errorDiagnosis: question.trapWarning || `Common miss in ${humanizeSkill(question.skillId)}: rushing before the structure is clear.`,
    speedTactic: `Use ${lead}, then ${next}. Cross out impossible choices before doing extra work.`,
    miniExample: question.explanation.length <= 160 ? question.explanation : `Example move: ${lead}, then ${next}.`
  };
}

const FAMILY_OVERRIDES: Partial<Record<string, Partial<CoachPack>>> = {
  exclusion_shelf: {
    hint: "Cross out every choice that contains a forbidden object.",
    errorDiagnosis: "Common miss: checking what is present but forgetting the word no.",
    speedTactic: "Turn each no-word into a quick checklist and eliminate choices fast.",
    miniExample: "No rabbits and no robots means any shelf with either one is out."
  },
  multi_step_remaining: {
    hint: "Find the starting total, remove each group, then check what is left.",
    errorDiagnosis: "Common miss: taking half of the wrong group or skipping one removal.",
    speedTactic: "Write remove, remove, half, then left so the steps stay in order.",
    miniExample: "12 fruits minus 2 pears minus 4 apples leaves 6. Half the oranges were removed, so 3 oranges stay."
  },
  equal_pairs_weights: {
    hint: "Pair the lightest with the heaviest and test equal sums.",
    errorDiagnosis: "Common miss: looking at single weights instead of pair totals.",
    speedTactic: "On sorted weights, test end pairs before trying random pairs.",
    miniExample: "6+12 and 8+10 both make 18, so 11 is left over."
  },
  before_after_number: {
    speedTactic: "Before is minus 1. After is plus 1. Decide the direction first.",
    miniExample: "Before 14 is 13. After 14 is 15."
  },
  smallest_number: {
    speedTactic: "For 2-digit numbers, compare tens first. Only use ones if tens tie.",
    miniExample: "32 is smaller than 47 because 3 tens is less than 4 tens."
  },
  move_to_front: {
    speedTactic: "Rewrite the new order mentally before counting places.",
    miniExample: "If Zoe moves to the front, everyone else shifts back one place."
  },
  expanded_form: {
    speedTactic: "Build the tens first, then add the ones.",
    miniExample: "3 tens and 4 ones means 30 + 4 = 34."
  },
  make_ten_bridge: {
    speedTactic: "Break the second number so the first part makes 10.",
    miniExample: "8 + 6 becomes 8 + 2 + 4 = 14."
  },
  number_between: {
    speedTactic: "The middle number is one jump after the first and one jump before the last.",
    miniExample: "Between 12 and 14 is 13."
  },
  equal_shares_story: {
    speedTactic: "Equal shares means split into same-size groups.",
    miniExample: "12 stickers shared by 3 children gives 4 each."
  },
  belongs_to_group: {
    speedTactic: "Test each choice against the rule one word at a time.",
    miniExample: "If the rule says red or square, a red circle still works."
  },
  length_difference: {
    speedTactic: "How many longer means subtract, not add.",
    miniExample: "14 cm and 9 cm differ by 5 cm."
  },
  repeat_number_pattern: {
    speedTactic: "Find the full repeat block, then start it again.",
    miniExample: "4, 7, 4, 7 repeats, so the next term is 4."
  },
  compare_path_lengths: {
    speedTactic: "Total each path first; compare only the totals.",
    miniExample: "3 + 4 = 7 and 2 + 6 = 8, so the second path is longer."
  },
  between_objects: {
    speedTactic: "Find the two named objects, then look only at the space between them.",
    miniExample: "In Mia, Ben, Ava, Leo, the one between Ben and Leo is Ava."
  },
  equal_sides_shape: {
    speedTactic: "Match every property in the question, not just one of them.",
    miniExample: "A square has 4 corners and 4 equal sides."
  },
  right_turns_only: {
    speedTactic: "Ignore left turns completely and count only the right turns.",
    miniExample: "If the path turns right twice and left once, the answer is 2."
  },
  hidden_marks_total: {
    speedTactic: "Hidden equals total minus visible.",
    miniExample: "5 marked faces total and 3 visible means 2 are hidden."
  },
  most_likely_color: {
    speedTactic: "Most likely means the color with the biggest count.",
    miniExample: "If red has 5 marbles and blue has 2, red is most likely."
  },
  total_all_rows: {
    speedTactic: "Read the legend once, convert each row, then add the row totals.",
    miniExample: "3 stars worth 2 each means 6 in that row."
  },
  outside_both: {
    speedTactic: "Add what is inside the circles, then subtract from the total.",
    miniExample: "If 8 children are shown inside and 11 total, then 3 are outside both."
  },
  weekday_after_days: {
    speedTactic: "Use the 7-day loop and count jumps, not the start day twice.",
    miniExample: "Two days after Monday is Wednesday."
  },
  change_from_coin: {
    speedTactic: "Change is pay amount minus cost.",
    miniExample: "25 cents minus 18 cents leaves 7 cents."
  },
  hour_later: {
    speedTactic: "One hour later keeps the minutes the same.",
    miniExample: "4:30 becomes 5:30 one hour later."
  },
  letter_vertical_symmetry: {
    speedTactic: "Imagine folding the letter down the middle.",
    miniExample: "A has matching left and right halves."
  },
  missing_subtrahend: {
    speedTactic: "Turn subtraction into the matching addition fact.",
    miniExample: "9 - box = 4 means box + 4 = 9, so box = 5."
  }
};

export function getDeterministicCoach(question: QuestionInstance, correct: boolean): CoachPack {
  const base = SKILL_COACH[question.skillId] || genericCoach(question) || DEFAULT_COACH;
  const family = FAMILY_OVERRIDES[question.familyId] || {};
  const strategyLine = question.strategyTags.length
    ? `Use this move: ${question.strategyTags.slice(0, 2).join(", ")}.`
    : family.hint || base.hint;
  const diagnosisLine = question.trapWarning
    ? `Watch the trap: ${question.trapWarning}`
    : family.errorDiagnosis || base.errorDiagnosis;
  const exampleLine =
    question.explanation.length <= 160 ? question.explanation : family.miniExample || base.miniExample;

  if (correct) {
    return {
      hint: strategyLine,
      errorDiagnosis: "Correct strategy. Repeat the same pattern on similar questions.",
      speedTactic: family.speedTactic || base.speedTactic,
      miniExample: exampleLine
    };
  }
  return {
    hint: strategyLine,
    errorDiagnosis: diagnosisLine,
    speedTactic: family.speedTactic || base.speedTactic,
    miniExample: exampleLine
  };
}
