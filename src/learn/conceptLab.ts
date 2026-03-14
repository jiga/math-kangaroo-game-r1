import type { CoachPack, QuestionInstance, VisualAssetSpec, SkillId } from "../domain/types";
import { renderLessonScene } from "../render/visualQuestionRenderer";

type ChoiceStepDef = {
  prompt: string;
  options: [string, string, string];
  correctIndex: number;
  success: string;
  wrong: string;
  visual?: VisualAssetSpec | ((question: QuestionInstance) => VisualAssetSpec);
};

type LessonBlueprint = {
  objective: string;
  intro: string;
  trap: string;
  tipSheet: [string, string];
  quickCheck: ChoiceStepDef;
  transfer: ChoiceStepDef;
};

type LessonOverride = Partial<Omit<LessonBlueprint, "quickCheck" | "transfer" | "tipSheet">> & {
  tipSheet?: [string, string];
  quickCheck?: Partial<ChoiceStepDef>;
  transfer?: Partial<ChoiceStepDef>;
};

export type ConceptLabMode = "learn" | "remediation";

export type ConceptLabStep = {
  id: string;
  title: string;
  kind: "info" | "check";
  body: string;
  objective: string;
  visualSvg: string;
  visualAlt: string;
  speakText: string;
  prompt?: string;
  options?: [string, string, string];
  correctIndex?: number;
  successText?: string;
  wrongText?: string;
  maxAttempts?: number;
};

export type ConceptLabFlow = {
  mode: ConceptLabMode;
  steps: ConceptLabStep[];
  summary: string;
};

function withDefaultVisual(
  visual: VisualAssetSpec | ((question: QuestionInstance) => VisualAssetSpec) | undefined,
  question: QuestionInstance,
  seed: number,
  fallback: VisualAssetSpec
): VisualAssetSpec {
  if (typeof visual === "function") return visual(question);
  if (visual) return visual;
  return fallback ?? renderLessonScene(question.skillId, seed);
}

function mergeChoice(base: ChoiceStepDef, override?: Partial<ChoiceStepDef>): ChoiceStepDef {
  return {
    prompt: override?.prompt || base.prompt,
    options: (override?.options as [string, string, string]) || base.options,
    correctIndex: override?.correctIndex ?? base.correctIndex,
    success: override?.success || base.success,
    wrong: override?.wrong || base.wrong,
    visual: override?.visual || base.visual
  };
}

const DEFAULT_BLUEPRINT: LessonBlueprint = {
  objective: "Use structure first, then compute only what matters.",
  intro: "Start by naming the quantities, the rule, and the target. Contest math gets easier when the structure is clear.",
  trap: "Many misses come from solving too fast before identifying what stays the same or what the question is really asking.",
  tipSheet: ["Rewrite the target in your own words.", "Cross out impossible choices before calculating."],
  quickCheck: {
    prompt: "Which move should come first?",
    options: ["Name the rule or target", "Guess from the choices", "Compute every detail"],
    correctIndex: 0,
    success: "Right. Start by naming the rule or target.",
    wrong: "First decide what the question is asking and what rule connects the numbers."
  },
  transfer: {
    prompt: "What is the fastest safe move on a hard contest question?",
    options: ["Spot structure and eliminate choices", "Do every calculation twice", "Pick the biggest number"],
    correctIndex: 0,
    success: "Exactly. Structure and elimination save time.",
    wrong: "On contest questions, structure and elimination usually save the most time."
  }
};

function genericBlueprint(question: QuestionInstance, coach: CoachPack): LessonBlueprint {
  const leadTag = question.strategyTags[0] || "spot the pattern";
  const followTag = question.strategyTags[1] || "check one small step";
  return {
    objective: `Use ${leadTag} to solve ${question.familyId.replaceAll("_", " ")}.`,
    intro: `${coach.hint} Start by deciding what must stay true, what can change, and which quantity you actually need.`,
    trap: question.trapWarning || coach.errorDiagnosis,
    tipSheet: [leadTag, followTag],
    quickCheck: {
      prompt: `Which habit best matches this family?`,
      options: [leadTag, "Compute every number immediately", "Ignore the diagram and read only the choices"],
      correctIndex: 0,
      success: `Yes. ${leadTag} is the right opening move here.`,
      wrong: `Use ${leadTag} first, then compute only what survives.`
    },
    transfer: {
      prompt: `What is the best next habit after you use ${leadTag}?`,
      options: [followTag, "Restart from scratch", "Pick the longest answer"],
      correctIndex: 0,
      success: `Correct. ${followTag} keeps the work clean.`,
      wrong: `${followTag} is the steady follow-up move after the first insight.`
    }
  };
}

const SKILL_BLUEPRINTS: Record<SkillId, LessonBlueprint> = {
  counting_ordering: {
    objective: "Count in order without losing your place.",
    intro: "Count equal groups first, then extras. In sequences, keep one rule the whole way.",
    trap: "Children often restart the count or change the rule halfway through a pattern.",
    tipSheet: ["Circle or tap each item once.", "For number patterns, say the jump out loud."],
    quickCheck: {
      prompt: "What is 2 more than 8?",
      options: ["9", "10", "11"],
      correctIndex: 1,
      success: "Correct. Two more than 8 is 10.",
      wrong: "Count on: 8, 9, 10. The answer is 10."
    },
    transfer: {
      prompt: "Complete the rule: 4, 6, 8, __",
      options: ["9", "10", "12"],
      correctIndex: 1,
      success: "Correct. The rule is +2 each time.",
      wrong: "The jump is +2, so after 8 comes 10."
    }
  },
  compare_number_region: {
    objective: "Compare by size, place value, or area.",
    intro: "When two numbers have tens, compare tens before ones. When two pictures have equal-sized parts, count the parts.",
    trap: "A larger last digit does not beat a larger tens digit. In pictures, compare equal units, not just width.",
    tipSheet: ["Tens decide before ones.", "Count unit squares or equal pieces."],
    quickCheck: {
      prompt: "Which number is greater?",
      options: ["38", "41", "They are equal"],
      correctIndex: 1,
      success: "Correct. 41 has 4 tens, which is more than 3 tens.",
      wrong: "Compare the tens digits first: 4 tens beats 3 tens."
    },
    transfer: {
      prompt: "Which picture has more equal squares?",
      options: ["Picture A", "Picture B", "Same amount"],
      correctIndex: 2,
      success: "Correct. If both have the same number of equal squares, the area is the same.",
      wrong: "Count equal squares, not just how wide the picture looks."
    }
  },
  ordinal_numbers: {
    objective: "Use position words correctly.",
    intro: "Ordinal numbers tell place: first, second, third. Start counting from the side named in the question.",
    trap: "Children often count from the front when the clue says from the end.",
    tipSheet: ["Touch each object once while counting positions.", "Underline from the front or from the end."],
    quickCheck: {
      prompt: "Which word means position?",
      options: ["three", "third", "more"],
      correctIndex: 1,
      success: "Correct. Third tells position.",
      wrong: "Third is a position word. Three is just how many."
    },
    transfer: {
      prompt: "In A B C D, who is 2nd from the end?",
      options: ["B", "C", "D"],
      correctIndex: 1,
      success: "Correct. From the end: D is 1st, C is 2nd.",
      wrong: "Count from the end: D, then C."
    }
  },
  place_value: {
    objective: "Read what each digit is worth.",
    intro: "A digit's value depends on its place. Tens are groups of 10; ones are single units.",
    trap: "Children sometimes read the digits separately without using place value.",
    tipSheet: ["Say the number as tens and ones.", "Ask: what job does each digit do?"],
    quickCheck: {
      prompt: "What number is 3 tens and 4 ones?",
      options: ["34", "43", "7"],
      correctIndex: 0,
      success: "Correct. 3 tens = 30 and 4 ones = 4, so 34.",
      wrong: "Build the number: 30 plus 4 makes 34."
    },
    transfer: {
      prompt: "What is the value of the 5 in 58?",
      options: ["5", "50", "8"],
      correctIndex: 1,
      success: "Correct. The 5 is in the tens place, so it means 50.",
      wrong: "In 58, the 5 stands for 5 tens, which is 50."
    }
  },
  single_digit_add_sub: {
    objective: "Choose the right operation fast and check the fact family.",
    intro: "In story problems, decide whether the amount is joining, leaving, or missing. Then use the matching fact family.",
    trap: "Children often use the wrong sign because they react to a number instead of the story action.",
    tipSheet: ["Use make-10 when numbers are close to 10.", "For a missing part, subtract whole minus known part."],
    quickCheck: {
      prompt: "What is the missing part? 9 = 5 + __",
      options: ["3", "4", "5"],
      correctIndex: 1,
      success: "Correct. 5 and 4 make 9.",
      wrong: "Use the fact family: 9 - 5 = 4."
    },
    transfer: {
      prompt: "Which action means subtract?",
      options: ["got 3 more", "gave away 3", "put together"],
      correctIndex: 1,
      success: "Correct. Gave away means the amount gets smaller.",
      wrong: "Subtract when the story loses or gives away items."
    }
  },
  number_line: {
    objective: "Use direction and distance correctly on a number line.",
    intro: "Right means add and left means subtract. To find the gap, count spaces or subtract end minus start.",
    trap: "Children often count both endpoints when they should count the spaces between.",
    tipSheet: ["Draw the jump direction first.", "Gap means spaces between, not both ends."],
    quickCheck: {
      prompt: "Start at 7 and jump right 3. Where do you land?",
      options: ["4", "10", "11"],
      correctIndex: 1,
      success: "Correct. Right means add 3, so 7 + 3 = 10.",
      wrong: "Jumping right adds. 7 plus 3 lands on 10."
    },
    transfer: {
      prompt: "How far is it from 5 to 9 on a number line?",
      options: ["3", "4", "5"],
      correctIndex: 1,
      success: "Correct. The gap is 4.",
      wrong: "Count the spaces: 6, 7, 8, 9. That is 4 jumps."
    }
  },
  fractions_words: {
    objective: "Link fraction words to equal parts.",
    intro: "Half, third, and quarter only make sense when the whole is split into equal parts.",
    trap: "Children may pick a fraction word just from the number of pieces, even if the pieces are not equal.",
    tipSheet: ["Check equal parts before naming the fraction.", "Build the whole by repeating one equal part."],
    quickCheck: {
      prompt: "If a pizza is cut into 4 equal parts, one part is called...",
      options: ["one half", "one third", "one quarter"],
      correctIndex: 2,
      success: "Correct. Four equal parts means each part is one quarter.",
      wrong: "Quarter means one of 4 equal parts."
    },
    transfer: {
      prompt: "If one third is 2 cookies, how many cookies make the whole?",
      options: ["4", "6", "8"],
      correctIndex: 1,
      success: "Correct. Three equal parts of 2 make 6.",
      wrong: "One third means 3 equal groups. 3 groups of 2 make 6."
    }
  },
  sorting_classifying: {
    objective: "Use one clear rule at a time.",
    intro: "Look for the single rule that the group follows, then test each choice against that same rule.",
    trap: "Children sometimes switch rules halfway through and count items that do not match.",
    tipSheet: ["Say the rule before you choose.", "Cross out anything that breaks the rule."],
    quickCheck: {
      prompt: "Which one does not belong with red triangle, red square, red circle?",
      options: ["red rectangle", "blue triangle", "red oval"],
      correctIndex: 1,
      success: "Correct. The rule is red shapes, and blue triangle breaks it.",
      wrong: "The shared rule is color red. Only blue triangle breaks it."
    },
    transfer: {
      prompt: "If the rule is 'only animals', which choice fits?",
      options: ["cat", "ball", "chair"],
      correctIndex: 0,
      success: "Correct. Cat is the only animal.",
      wrong: "Use one rule only. Cat matches the rule."
    }
  },
  measurement_small: {
    objective: "Use the correct unit and compare like with like.",
    intro: "Length, weight, and capacity use different units. Compare measurements only after they use the same unit.",
    trap: "A bigger number is not bigger if the units are different.",
    tipSheet: ["Ask: am I measuring length, weight, or liquid?", "Convert before comparing different units."],
    quickCheck: {
      prompt: "Which is longer?",
      options: ["1 meter", "80 centimeters", "same length"],
      correctIndex: 0,
      success: "Correct. 1 meter is 100 centimeters, which is longer than 80 cm.",
      wrong: "Convert first: 1 meter = 100 centimeters."
    },
    transfer: {
      prompt: "Which unit is best for a pencil?",
      options: ["centimeters", "kilograms", "liters"],
      correctIndex: 0,
      success: "Correct. A pencil is measured by length, so centimeters fit.",
      wrong: "Use a length unit for a pencil. Centimeters measure length."
    }
  },
  patterns: {
    objective: "Find one rule and continue it.",
    intro: "A good pattern repeats or grows by one clear rule. Look at more than one step before deciding.",
    trap: "Children often guess from the last item instead of the whole rule.",
    tipSheet: ["Check at least two jumps before answering.", "Say the repeating block or growth rule aloud."],
    quickCheck: {
      prompt: "What comes next? circle, square, circle, square, __",
      options: ["circle", "triangle", "square"],
      correctIndex: 0,
      success: "Correct. The block repeats circle, square.",
      wrong: "Find the repeating block: circle, square. Then it starts again with circle."
    },
    transfer: {
      prompt: "What comes next? 5, 8, 11, __",
      options: ["12", "14", "15"],
      correctIndex: 1,
      success: "Correct. The pattern adds 3 each time.",
      wrong: "Check the jump: +3, +3, so the next number is 14."
    }
  },
  perimeter_broken_lines: {
    objective: "Trace the whole outside and add every segment once.",
    intro: "Perimeter means the full distance around or along the path. Walk every segment and keep a running total.",
    trap: "Children often stop after two sides or confuse perimeter with area.",
    tipSheet: ["Trace with a finger so no side is skipped.", "For rectangles, count two lengths and two widths."],
    quickCheck: {
      prompt: "A path has lengths 3, 2, and 4. What is the total?",
      options: ["7", "8", "9"],
      correctIndex: 2,
      success: "Correct. 3 + 2 + 4 = 9.",
      wrong: "Add every segment once: 3 + 2 + 4 = 9."
    },
    transfer: {
      prompt: "A rectangle has sides 5 and 2. What is the perimeter?",
      options: ["7", "10", "14"],
      correctIndex: 2,
      success: "Correct. 5 + 2 + 5 + 2 = 14.",
      wrong: "Perimeter uses all 4 sides: 5 + 2 + 5 + 2 = 14."
    }
  },
  relative_position: {
    objective: "Use position words exactly as written.",
    intro: "Words like between, above, below, inside, and outside each tell a different location.",
    trap: "Children often answer from memory of the picture instead of the exact position word.",
    tipSheet: ["Underline the position word.", "Turn the clues into a quick line or stack picture."],
    quickCheck: {
      prompt: "Who is between A and C?",
      options: ["A", "B", "C"],
      correctIndex: 1,
      success: "Correct. B is between A and C.",
      wrong: "Between means in the middle. B is in the middle."
    },
    transfer: {
      prompt: "If the cat is inside the box, where is the cat?",
      options: ["inside", "under", "behind"],
      correctIndex: 0,
      success: "Correct. The clue already says inside.",
      wrong: "Use the exact clue word. The cat is inside."
    }
  },
  shape_properties: {
    objective: "Match shapes to sides, corners, and descriptions.",
    intro: "Read every shape clue. Count sides or corners only after you know which property the question asks for.",
    trap: "Children mix up sides and corners, or pick from memory without checking the exact property.",
    tipSheet: ["Edges are sides. Turning points are corners.", "Read the full description before choosing."],
    quickCheck: {
      prompt: "How many corners does a triangle have?",
      options: ["2", "3", "4"],
      correctIndex: 1,
      success: "Correct. A triangle has 3 corners.",
      wrong: "Triangle means 3 corners and 3 sides."
    },
    transfer: {
      prompt: "Which shape has 4 equal sides?",
      options: ["square", "triangle", "circle"],
      correctIndex: 0,
      success: "Correct. A square has 4 equal sides.",
      wrong: "A square has 4 equal sides and 4 corners."
    }
  },
  maze_shape_puzzles: {
    objective: "Track moves and compare possible paths.",
    intro: "For route puzzles, count turns or steps carefully. For shape puzzles, picture how pieces fit before choosing.",
    trap: "Children often count only left turns or only the last move.",
    tipSheet: ["Mark each turn as you go.", "Shorter path means fewer steps, not fewer pictures."],
    quickCheck: {
      prompt: "A path has 2 left turns and 1 right turn. How many turns in all?",
      options: ["2", "3", "4"],
      correctIndex: 1,
      success: "Correct. 2 + 1 = 3 turns.",
      wrong: "Count all the turns together: 2 left and 1 right makes 3."
    },
    transfer: {
      prompt: "Which path is shorter? 4 steps or 6 steps?",
      options: ["4-step path", "6-step path", "same length"],
      correctIndex: 0,
      success: "Correct. Fewer steps means a shorter path.",
      wrong: "Shorter means the smaller step total."
    }
  },
  cube_cuboid_visualization: {
    objective: "Use standard cube facts and count visible marks once.",
    intro: "A cube has 6 faces, 12 edges, and 8 corners. In pictures, count each visible mark once.",
    trap: "Children may double-count marks or forget to start from 6 faces when finding hidden faces.",
    tipSheet: ["Memorize 6 faces, 12 edges, 8 corners.", "Scan visible marks left to right."],
    quickCheck: {
      prompt: "How many faces does a cube have?",
      options: ["4", "6", "8"],
      correctIndex: 1,
      success: "Correct. A cube has 6 faces.",
      wrong: "Memorize this cube fact: 6 faces."
    },
    transfer: {
      prompt: "If 3 faces are showing, how many are hidden?",
      options: ["2", "3", "4"],
      correctIndex: 1,
      success: "Correct. 6 total faces minus 3 visible faces leaves 3 hidden faces.",
      wrong: "Start from 6 faces total. 6 - 3 = 3 hidden faces."
    }
  },
  likelihood_vocabulary: {
    objective: "Match events to the right chance words.",
    intro: "Chance words tell how likely something is: impossible, unlikely, equally likely, likely, certain.",
    trap: "More likely does not mean always, and impossible means zero chance.",
    tipSheet: ["Compare how many favorable outcomes there are.", "Equal counts mean equal chance."],
    quickCheck: {
      prompt: "A bag has 5 red and 5 blue marbles. Picking red is...",
      options: ["certain", "equally likely", "impossible"],
      correctIndex: 1,
      success: "Correct. Equal counts mean equally likely.",
      wrong: "Equal numbers give equal chance."
    },
    transfer: {
      prompt: "A bag has only green marbles. Picking green is...",
      options: ["likely", "certain", "unlikely"],
      correctIndex: 1,
      success: "Correct. If every marble is green, green is certain.",
      wrong: "Certain means it must happen every time."
    }
  },
  pictographs_bar_graphs: {
    objective: "Read the legend, then count or multiply each row.",
    intro: "A pictograph can hide the value in the legend. Read the legend before you compare rows or totals.",
    trap: "Children often count the icons but forget that each icon may stand for more than 1.",
    tipSheet: ["Legend first, rows second.", "For more or fewer, compare totals after converting."],
    quickCheck: {
      prompt: "If 1 star means 2, then 3 stars mean...",
      options: ["3", "5", "6"],
      correctIndex: 2,
      success: "Correct. 3 groups of 2 make 6.",
      wrong: "Use the legend: each star is 2, so 3 stars are 6."
    },
    transfer: {
      prompt: "Which row has the most data?",
      options: ["the row with 2 stars", "the row with 4 stars", "the row with 3 stars"],
      correctIndex: 1,
      success: "Correct. The row with 4 stars has the most.",
      wrong: "Most means the largest total. Compare every row."
    }
  },
  venn_diagrams_easy: {
    objective: "Know the three Venn regions: left only, both, right only.",
    intro: "The middle overlap means both sets. 'Exactly one' means the two outside parts only.",
    trap: "Children often count the middle overlap when the question says exactly one.",
    tipSheet: ["Both means the middle only.", "Exactly one means outside the overlap."],
    quickCheck: {
      prompt: "In a Venn diagram, where do items in both sets go?",
      options: ["left only", "middle overlap", "outside both"],
      correctIndex: 1,
      success: "Correct. Both sets share the middle overlap.",
      wrong: "Both means the overlap in the middle."
    },
    transfer: {
      prompt: "If A only is 2 and B only is 3, how many are in exactly one set?",
      options: ["3", "5", "7"],
      correctIndex: 1,
      success: "Correct. Exactly one is A only plus B only, so 2 + 3 = 5.",
      wrong: "Exactly one does not include the overlap. Add the two outside parts only."
    }
  },
  calendar: {
    objective: "Move forward or backward on the day or month cycle.",
    intro: "Days repeat every 7. Months follow a fixed order. Before and after are opposite directions.",
    trap: "Children often count the starting day twice, or move in the wrong direction for ago/before.",
    tipSheet: ["Mark start, then move the number of jumps.", "Ago/before means backward."],
    quickCheck: {
      prompt: "If today is Monday, what day is 2 days later?",
      options: ["Tuesday", "Wednesday", "Thursday"],
      correctIndex: 1,
      success: "Correct. Monday -> Tuesday -> Wednesday.",
      wrong: "Do not count Monday twice. Two days later is Wednesday."
    },
    transfer: {
      prompt: "Which month comes after April?",
      options: ["March", "May", "June"],
      correctIndex: 1,
      success: "Correct. May comes after April.",
      wrong: "Use the month order: April, then May."
    }
  },
  money_small: {
    objective: "Convert coins to cents and compare totals.",
    intro: "Pennies are 1, nickels are 5, and dimes are 10. First convert every coin to cents, then add or compare.",
    trap: "Children sometimes count the number of coins instead of their value.",
    tipSheet: ["Group dimes and nickels first.", "Enough means equal to or more than."],
    quickCheck: {
      prompt: "What is the value of 1 dime and 1 nickel?",
      options: ["11 cents", "15 cents", "20 cents"],
      correctIndex: 1,
      success: "Correct. 10 + 5 = 15 cents.",
      wrong: "A dime is 10 and a nickel is 5, so together they are 15."
    },
    transfer: {
      prompt: "A toy costs 12 cents. Do 2 nickels and 2 pennies give enough?",
      options: ["yes", "no", "only if you add a dime"],
      correctIndex: 0,
      success: "Correct. 10 + 2 = 12, so it is enough.",
      wrong: "Enough means equal or more. 2 nickels and 2 pennies make exactly 12."
    }
  },
  clock_full_half: {
    objective: "Translate between words and clock times.",
    intro: "Full hour means :00 and half past means :30. When you move 30 minutes from :30, the hour changes.",
    trap: "Children often keep the same hour when moving from :30 to the next full hour.",
    tipSheet: ["Say :00 = full hour and :30 = half past.", "Watch when the hour hand moves to the next hour."],
    quickCheck: {
      prompt: "Half past 4 is...",
      options: ["4:00", "4:30", "5:30"],
      correctIndex: 1,
      success: "Correct. Half past 4 means 4:30.",
      wrong: "Half past means :30."
    },
    transfer: {
      prompt: "What time is 30 minutes after 6:30?",
      options: ["6:60", "7:00", "7:30"],
      correctIndex: 1,
      success: "Correct. Thirty minutes after 6:30 is 7:00.",
      wrong: "From :30, one more half-hour reaches the next full hour."
    }
  },
  symmetry_rotation: {
    objective: "Check whether both halves match after folding or turning.",
    intro: "A line of symmetry makes two matching halves. Rotation changes direction, but shape parts stay connected.",
    trap: "Children may compare only one side of the figure or forget to reflect across the line.",
    tipSheet: ["Imagine folding on the symmetry line.", "For rotations, track where one point moves."],
    quickCheck: {
      prompt: "Which letter has a vertical line of symmetry?",
      options: ["F", "H", "R"],
      correctIndex: 1,
      success: "Correct. H matches on both sides of a vertical fold.",
      wrong: "Imagine folding the letter in half. H matches on both sides."
    },
    transfer: {
      prompt: "A shape has one vertical line of symmetry. How many matching halves does it make?",
      options: ["1", "2", "4"],
      correctIndex: 1,
      success: "Correct. One line of symmetry makes 2 matching halves.",
      wrong: "The fold line splits the figure into 2 matching halves."
    }
  },
  prealgebra_balance: {
    objective: "Keep both sides equal.",
    intro: "A balance puzzle says both sides have the same value. Replace equal groups before you solve.",
    trap: "Children may add everything together instead of using the equality.",
    tipSheet: ["Write what one box or shape is worth.", "Replace equal groups before counting leftover items."],
    quickCheck: {
      prompt: "If 1 box equals 2 balls, then 2 boxes equal...",
      options: ["2 balls", "3 balls", "4 balls"],
      correctIndex: 2,
      success: "Correct. Two boxes are double, so 4 balls.",
      wrong: "If one box is worth 2 balls, then two boxes are worth 4 balls."
    },
    transfer: {
      prompt: "A box balances 3 counters. How many counters balance 2 boxes?",
      options: ["5", "6", "8"],
      correctIndex: 1,
      success: "Correct. Two groups of 3 counters make 6.",
      wrong: "Each box is 3 counters, so two boxes are 6 counters."
    }
  }
};

const FAMILY_OVERRIDES: Partial<Record<string, LessonOverride>> = {
  exclusion_shelf: {
    intro: "Filter questions work by crossing out choices that break the rule. One forbidden object makes the whole choice wrong.",
    trap: "Do not hunt for the best-looking choice. Eliminate every choice that contains even one forbidden item.",
    tipSheet: ["Cross out forbidden items one by one.", "Only one fully clean choice can survive."],
    quickCheck: {
      prompt: "The rule is 'no stars'. Which choice works?",
      options: ["circle and star", "triangle only", "square and star"],
      correctIndex: 1,
      success: "Correct. Triangle only is the only choice with no star.",
      wrong: "Any choice with a star is out. Triangle only is clean."
    }
  },
  multi_step_remaining: {
    intro: "Multi-step remaining questions must be solved in order. Do the first removal, then the second action.",
    trap: "The fraction action usually happens after some items are already removed.",
    tipSheet: ["Write what remains after each step.", "Do not use the fraction until you know the new total."],
    quickCheck: {
      prompt: "There are 10 oranges. 4 are taken away. Then half of the rest go away. How many stay?",
      options: ["2", "3", "6"],
      correctIndex: 1,
      success: "Correct. After 4 are taken, 6 remain. Half of 6 go away, so 3 stay.",
      wrong: "Go in order: 10 - 4 = 6, then half of 6 go away, leaving 3."
    },
    transfer: {
      prompt: "There are 8 apples. 2 are eaten. Then half of the rest are shared. How many are left?",
      options: ["3", "4", "6"],
      correctIndex: 0,
      success: "Correct. 8 - 2 = 6, then half of 6 is 3 left.",
      wrong: "First find what remains, then apply the half step."
    }
  },
  equal_pairs_weights: {
    intro: "Balance questions compare equal pairs first. Replace one hidden object with what it balances.",
    trap: "Do not add every item in the picture before using the equal-pair clue.",
    tipSheet: ["Turn the picture into 'one box = ...'.", "Use the equality before counting leftovers."],
    quickCheck: {
      prompt: "If one teddy weighs the same as 2 balls, two teddies weigh the same as...",
      options: ["2 balls", "3 balls", "4 balls"],
      correctIndex: 2,
      success: "Correct. Double both sides: 2 teddies match 4 balls.",
      wrong: "Keep both sides equal. Double the 2 balls to 4 balls."
    },
    transfer: {
      prompt: "A toy equals 3 cubes. A toy and 2 more cubes weigh the same as...",
      options: ["3 cubes", "5 cubes", "6 cubes"],
      correctIndex: 1,
      success: "Correct. Replace the toy with 3 cubes, then add 2 more to get 5.",
      wrong: "Replace the hidden value first, then count the total."
    }
  },
  region_area_compare: {
    quickCheck: {
      prompt: "Two shapes are made of equal squares. Which matters most?",
      options: ["number of equal squares", "outline color", "which one looks wider"],
      correctIndex: 0,
      success: "Correct. Equal-square area is decided by how many equal squares each shape has.",
      wrong: "Count equal squares. Color and apparent width do not decide area."
    }
  },
  broken_line_total: {
    transfer: {
      prompt: "A broken line has segments 2, 5, and 3. What is the total length?",
      options: ["8", "10", "12"],
      correctIndex: 1,
      success: "Correct. Add every segment once: 2 + 5 + 3 = 10.",
      wrong: "Trace the full path and add all three segments."
    }
  },
  turn_count: {
    quickCheck: {
      prompt: "A route has 3 left turns and 2 right turns. How many turns in all?",
      options: ["3", "5", "6"],
      correctIndex: 1,
      success: "Correct. All turns count, so 3 + 2 = 5.",
      wrong: "Add left and right turns together."
    }
  },
  legend_total: {
    intro: "In pictographs, the legend changes the value of every picture. Read it before counting the total.",
    quickCheck: {
      prompt: "If 1 picture = 5 votes, then 4 pictures = ...",
      options: ["9", "20", "25"],
      correctIndex: 1,
      success: "Correct. Four groups of 5 make 20.",
      wrong: "Use the legend as multiplication: 4 groups of 5 = 20."
    }
  },
  exactly_one_set: {
    transfer: {
      prompt: "In a Venn diagram, A only = 4 and B only = 1. Exactly one set means...",
      options: ["4", "5", "6"],
      correctIndex: 1,
      success: "Correct. Exactly one means A only plus B only, so 5.",
      wrong: "Leave out the overlap and add only the two outside parts."
    }
  },
  coin_total: {
    quickCheck: {
      prompt: "What is 2 dimes and 1 penny worth?",
      options: ["12 cents", "21 cents", "22 cents"],
      correctIndex: 1,
      success: "Correct. Two dimes are 20 cents and one penny is 1 cent, so 21.",
      wrong: "Count coin value, not the number of coins. 20 + 1 = 21."
    }
  },
  half_hour_later: {
    transfer: {
      prompt: "What time is 30 minutes after 3:30?",
      options: ["4:00", "4:30", "3:60"],
      correctIndex: 0,
      success: "Correct. One half-hour after 3:30 is 4:00.",
      wrong: "From :30, another 30 minutes reaches the next full hour."
    }
  },
  hidden_faces: {
    transfer: {
      prompt: "If 4 faces of a cube are hidden, how many faces are showing?",
      options: ["2", "4", "6"],
      correctIndex: 0,
      success: "Correct. A cube has 6 faces total, so 6 - 4 = 2 are showing.",
      wrong: "Start with 6 total faces, then subtract hidden faces."
    }
  },
  outside_both: {
    intro: "Some Venn questions ask about items outside both circles. That means not in A and not in B.",
    quickCheck: {
      prompt: "If an item is outside both circles, which set is it in?",
      options: ["A", "B", "neither"],
      correctIndex: 2,
      success: "Correct. Outside both means in neither set.",
      wrong: "Outside both circles means in neither set."
    }
  },
  change_from_coin: {
    quickCheck: {
      prompt: "A toy costs 7 cents. You pay with a dime. What is the change?",
      options: ["2 cents", "3 cents", "17 cents"],
      correctIndex: 1,
      success: "Correct. 10 - 7 = 3 cents change.",
      wrong: "Change means money back, so subtract cost from the amount paid."
    }
  },
  hour_later: {
    transfer: {
      prompt: "What time is 1 hour after 5:00?",
      options: ["5:30", "6:00", "6:30"],
      correctIndex: 1,
      success: "Correct. One hour later keeps the minutes the same and adds 1 to the hour.",
      wrong: "Add 1 hour and keep :00 the same."
    }
  },
  missing_subtrahend: {
    quickCheck: {
      prompt: "What number is missing? 9 - __ = 4",
      options: ["4", "5", "13"],
      correctIndex: 1,
      success: "Correct. 9 - 5 = 4.",
      wrong: "Use the fact family or count up from 4 to 9."
    }
  }
};

function buildInfoStep(
  id: string,
  title: string,
  body: string,
  objective: string,
  visual: VisualAssetSpec,
  speakText: string
): ConceptLabStep {
  return {
    id,
    title,
    kind: "info",
    body,
    objective,
    visualSvg: visual.svg,
    visualAlt: visual.altText,
    speakText
  };
}

function buildCheckStep(
  id: string,
  title: string,
  body: string,
  objective: string,
  choice: ChoiceStepDef,
  visual: VisualAssetSpec,
  speakText: string
): ConceptLabStep {
  return {
    id,
    title,
    kind: "check",
    body,
    objective,
    visualSvg: visual.svg,
    visualAlt: visual.altText,
    speakText,
    prompt: choice.prompt,
    options: choice.options,
    correctIndex: choice.correctIndex,
    successText: choice.success,
    wrongText: choice.wrong,
    maxAttempts: 2
  };
}

function lessonFor(question: QuestionInstance, coach: CoachPack): LessonBlueprint {
  const base = SKILL_BLUEPRINTS[question.skillId] || genericBlueprint(question, coach) || DEFAULT_BLUEPRINT;
  const override = FAMILY_OVERRIDES[question.familyId];
  if (!override) return base;
  return {
    objective: override.objective || base.objective,
    intro: override.intro || base.intro,
    trap: override.trap || base.trap,
    tipSheet: override.tipSheet || base.tipSheet,
    quickCheck: mergeChoice(base.quickCheck, override.quickCheck),
    transfer: mergeChoice(base.transfer, override.transfer)
  };
}

export function buildConceptLab(question: QuestionInstance, coach: CoachPack, mode: ConceptLabMode): ConceptLabFlow {
  const lesson = lessonFor(question, coach);
  const conceptVisual = renderLessonScene(question.skillId, 1);
  const questionVisual = question.visualAssetSpec || renderLessonScene(question.skillId, 2);
  const speedVisual = renderLessonScene(question.skillId, 3);
  const quickVisual = withDefaultVisual(lesson.quickCheck.visual, question, 4, questionVisual);
  const transferVisual = withDefaultVisual(lesson.transfer.visual, question, 5, speedVisual);

  if (mode === "remediation") {
    return {
      mode,
      summary: `Fix the mistake, then solve one tiny follow-up in ${question.familyId.replaceAll("_", " ")}.`,
      steps: [
        buildInfoStep(
          "fix",
          "Fix The Miss",
          `${question.explanation}\n\nTrap to avoid: ${question.trapWarning || coach.errorDiagnosis}`,
          lesson.objective,
          questionVisual,
          `${question.explanation} Trap to avoid: ${question.trapWarning || coach.errorDiagnosis}`
        ),
        buildCheckStep(
          "retry",
          "Try One",
          `${coach.speedTactic}\nTip: ${lesson.tipSheet[0]}`,
          lesson.objective,
          lesson.transfer,
          transferVisual,
          `${lesson.transfer.prompt} ${lesson.tipSheet[0]}`
        )
      ]
    };
  }

  return {
    mode,
    summary: `Learn the pattern, avoid the trap, then solve the question on your own.`,
    steps: [
      buildInfoStep(
        "strategy",
        "Big Idea",
        `${lesson.intro}\n\nToday's move: ${coach.hint}`,
        lesson.objective,
        conceptVisual,
        `${lesson.intro} Today's move: ${coach.hint}`
      ),
      buildCheckStep(
        "check",
        "Quick Check",
        `Focus: ${question.strategyTags.slice(0, 2).join(" and ")}.`,
        lesson.objective,
        lesson.quickCheck,
        quickVisual,
        `${lesson.quickCheck.prompt} ${lesson.tipSheet[0]}`
      ),
      buildInfoStep(
        "trap",
        "Trap To Avoid",
        `${lesson.trap}\n\nSpeed trick: ${coach.speedTactic}\nTip bank: ${lesson.tipSheet[0]} ${lesson.tipSheet[1]}`,
        lesson.objective,
        questionVisual,
        `${lesson.trap} Speed trick: ${coach.speedTactic}`
      ),
      buildCheckStep(
        "transfer",
        "Try One",
        `${coach.miniExample}\nNow do one on your own.`,
        lesson.objective,
        lesson.transfer,
        transferVisual,
        `${lesson.transfer.prompt} ${lesson.tipSheet[1]}`
      )
    ]
  };
}

export function allSkillBlueprints(): SkillId[] {
  return Object.keys(SKILL_BLUEPRINTS) as SkillId[];
}
