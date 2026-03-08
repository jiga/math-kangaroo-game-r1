import type {
  GenerationContext,
  PointTier,
  QuestionFormat,
  QuestionInstance,
  QuestionTemplate,
  SkillId,
  VisualAssetSpec
} from "../../domain/types";
import {
  renderBrokenLine,
  renderCube,
  renderMaze,
  renderPictograph,
  renderRegionCompare,
  renderSymmetry,
  renderVenn
} from "../../render/visualQuestionRenderer";
import { SeededRng, hashQuestion, shuffledOptions } from "./helpers";

type DraftQuestion = {
  prompt: string;
  correct: string;
  distractors: string[];
  explanation: string;
  strategyTags: string[];
  trapWarning?: string;
  format?: QuestionFormat;
  visualAssetSpec?: VisualAssetSpec;
};

type QuestionFamily = {
  familyId: string;
  format?: QuestionFormat;
  generate: (ctx: GenerationContext, rng: SeededRng) => DraftQuestion;
};

function numericDistractors(correct: number, offsets: number[], min = 0): string[] {
  const out: string[] = [];
  const seen = new Set<string>([String(correct)]);

  for (const offset of offsets) {
    const value = Math.max(min, correct + offset);
    const text = String(value);
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }

  let step = 1;
  while (out.length < 4) {
    for (const delta of [step, -step]) {
      const value = Math.max(min, correct + delta);
      const text = String(value);
      if (!seen.has(text)) {
        seen.add(text);
        out.push(text);
        if (out.length === 4) break;
      }
    }
    step += 1;
  }

  return out.slice(0, 4);
}

function textDistractors(correct: string, options: string[]): string[] {
  const seen = new Set<string>([correct]);
  const out: string[] = [];
  for (const option of options) {
    if (!seen.has(option)) {
      seen.add(option);
      out.push(option);
    }
    if (out.length === 4) break;
  }
  const fallbacks = ["none", "all", "cannot tell", "another choice", "not here"];
  for (const fallback of fallbacks) {
    if (out.length === 4) break;
    if (!seen.has(fallback)) {
      seen.add(fallback);
      out.push(fallback);
    }
  }
  while (out.length < 4) {
    out.push(`option ${out.length + 1}`);
  }
  return out;
}

function ordinalWord(value: number): string {
  if (value % 10 === 1 && value % 100 !== 11) return `${value}st`;
  if (value % 10 === 2 && value % 100 !== 12) return `${value}nd`;
  if (value % 10 === 3 && value % 100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function tierNumber(rng: SeededRng, pointTier: PointTier, low: number, mid: number, high: number): number {
  if (pointTier === 3) return rng.int(low, mid);
  if (pointTier === 4) return rng.int(mid, high);
  return rng.int(high, high + Math.max(2, Math.floor((high - low) / 2)));
}

function toQuestion(ctx: GenerationContext, skillId: SkillId, familyId: string, draft: DraftQuestion): QuestionInstance {
  const rng = new SeededRng(ctx.variantSeed ^ 0x9e3779b9);
  const packed = shuffledOptions(String(draft.correct), draft.distractors.map(String), rng);
  return {
    id: `${ctx.templateId}:${ctx.variantSeed}`,
    grade: ctx.grade,
    pointTier: ctx.pointTier,
    skillId,
    familyId,
    format: draft.format || "text",
    prompt: draft.prompt,
    options: packed.options,
    answerIndex: packed.answerIndex,
    explanation: draft.explanation,
    visualAssetSpec: draft.visualAssetSpec,
    coachPackId: skillId,
    strategyTags: draft.strategyTags,
    trapWarning: draft.trapWarning,
    variantKey: hashQuestion([ctx.templateId, ctx.variantSeed, familyId, draft.prompt, draft.correct])
  };
}

const FAMILY_LIBRARY: Record<SkillId, QuestionFamily[]> = {
  counting_ordering: [
    {
      familyId: "forward_sequence",
      generate: (ctx, rng) => {
        const start = rng.int(1, ctx.grade === 1 ? 16 : 24);
        const step = ctx.pointTier === 5 ? 2 : 1;
        const correct = start + step * 3;
        return {
          prompt: `What number comes next? ${start}, ${start + step}, ${start + step * 2}, ?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [step, -step, step * 2, -step * 2]),
          explanation: `The rule is +${step} each time, so the next number is ${correct}.`,
          strategyTags: ["find the step", "check every jump"],
          trapWarning: "Do not switch rules in the middle of the sequence."
        };
      }
    },
    {
      familyId: "backward_sequence",
      generate: (ctx, rng) => {
        const start = tierNumber(rng, ctx.pointTier, 8, 18, 28);
        const step = ctx.pointTier === 5 ? 2 : 1;
        const correct = start - step * 2;
        return {
          prompt: `Count backward. Fill the blank: ${start}, ${start - step}, ?, ${start - step * 3}`,
          correct: String(correct),
          distractors: numericDistractors(correct, [step, -step, step * 2, -step * 2]),
          explanation: `Counting backward means subtract ${step} each time, so the missing number is ${correct}.`,
          strategyTags: ["look for minus one or minus two", "say the numbers aloud"],
          trapWarning: "Backward patterns decrease, not increase."
        };
      }
    },
    {
      familyId: "grouped_count",
      generate: (ctx, rng) => {
        const groups = tierNumber(rng, ctx.pointTier, 3, 5, 7);
        const size = ctx.pointTier === 5 ? 5 : 2;
        const extra = rng.int(0, 3);
        const correct = groups * size + extra;
        return {
          prompt: `There are ${groups} groups of ${size} stars and ${extra} extra star(s). How many stars are there in all?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [size, -size, extra + 1, -(extra + 1)]),
          explanation: `${groups} groups of ${size} make ${groups * size}. Then add ${extra} more to get ${correct}.`,
          strategyTags: ["count in equal groups", "add extras at the end"],
          trapWarning: "Count every full group before adding the leftovers."
        };
      }
    }
  ],
  compare_number_region: [
    {
      familyId: "compare_numbers",
      generate: (ctx, rng) => {
        const a = tierNumber(rng, ctx.pointTier, 4, 18, 45);
        const b = tierNumber(rng, ctx.pointTier, 3, 17, 44);
        const correct = a === b ? "Equal" : a > b ? String(a) : String(b);
        return {
          prompt: `Which is greater: ${a} or ${b}?`,
          correct,
          distractors: textDistractors(correct, [String(a), String(b), "Equal", "Cannot tell", String(Math.max(a, b) + 1)]),
          explanation: a === b ? "Both numbers are the same." : `Compare the tens first. ${Math.max(a, b)} is greater.`,
          strategyTags: ["compare tens first", "then compare ones"],
          trapWarning: "Do not look only at the last digit."
        };
      }
    },
    {
      familyId: "place_value_compare",
      generate: (ctx, rng) => {
        const tensA = rng.int(1, ctx.grade === 1 ? 6 : 9);
        const onesA = rng.int(0, 9);
        const tensB = rng.int(1, ctx.grade === 1 ? 6 : 9);
        const onesB = rng.int(0, 9);
        const a = tensA * 10 + onesA;
        const b = tensB * 10 + onesB;
        const correct =
          a === b ? "Equal" : a > b ? `${a} is greater` : `${b} is greater`;
        return {
          prompt: `Which statement is true about ${a} and ${b}?`,
          correct,
          distractors: textDistractors(correct, [
            `${a} is greater`,
            `${b} is greater`,
            "Equal",
            "Cannot tell"
          ]),
          explanation:
            a === b
              ? `${a} and ${b} are equal.`
              : `Compare tens first. That tells which number is greater.`,
          strategyTags: ["compare place value", "tens decide first"],
          trapWarning: "A bigger ones digit cannot beat a bigger tens digit."
        };
      }
    },
    {
      familyId: "region_area_compare",
      format: "svg",
      generate: (ctx, rng) => {
        const widthA = tierNumber(rng, ctx.pointTier, 42, 58, 74);
        const widthB = tierNumber(rng, ctx.pointTier, 36, 56, 72);
        const correct = widthA === widthB ? "Equal" : widthA > widthB ? "A" : "B";
        return {
          prompt: "Which region has the greater area?",
          correct,
          distractors: textDistractors(correct, ["A", "B", "Equal", "Cannot tell"]),
          explanation:
            widthA === widthB
              ? "The rectangles have the same height and width, so the areas are equal."
              : "The rectangles have the same height, so the wider one has the greater area.",
          strategyTags: ["compare same-height shapes", "look at width"],
          trapWarning: "When heights match, only the widths decide.",
          format: "svg",
          visualAssetSpec: renderRegionCompare(widthA, widthB)
        };
      }
    }
  ],
  ordinal_numbers: [
    {
      familyId: "from_start",
      generate: (_ctx, rng) => {
        const letters = ["A", "B", "C", "D", "E", "F"];
        const index = rng.int(1, letters.length);
        const correct = letters[index - 1];
        return {
          prompt: `In ${letters.join(", ")}, which letter is ${ordinalWord(index)} from the start?`,
          correct,
          distractors: textDistractors(correct, letters),
          explanation: `${correct} is in position ${index}.`,
          strategyTags: ["count positions", "start at the front"],
          trapWarning: "Ordinal words mean position, not how many."
        };
      }
    },
    {
      familyId: "from_end",
      generate: (_ctx, rng) => {
        const animals = ["cat", "dog", "fox", "hen", "pig"];
        const fromEnd = rng.int(1, animals.length);
        const correct = animals[animals.length - fromEnd];
        return {
          prompt: `In the line ${animals.join(", ")}, who is ${ordinalWord(fromEnd)} from the end?`,
          correct,
          distractors: textDistractors(correct, animals),
          explanation: `Count from the end of the line. ${correct} is ${ordinalWord(fromEnd)} from the end.`,
          strategyTags: ["count from the correct side", "touch each item once"],
          trapWarning: "Do not count from the front when the question says from the end."
        };
      }
    },
    {
      familyId: "race_places",
      generate: (_ctx, rng) => {
        const runners = ["Mia", "Leo", "Ana", "Ben", "Zoe"];
        const place = rng.int(1, runners.length);
        const correct = runners[place - 1];
        return {
          prompt: `${runners.join(", ")} finished in that order. Who finished ${ordinalWord(place)}?`,
          correct,
          distractors: textDistractors(correct, runners),
          explanation: `The list is already in finish order, so the ${ordinalWord(place)} runner is ${correct}.`,
          strategyTags: ["use the given order", "count places carefully"],
          trapWarning: "Do not reorder the list unless the question tells you to."
        };
      }
    }
  ],
  place_value: [
    {
      familyId: "tens_and_ones",
      generate: (ctx, rng) => {
        const tens = tierNumber(rng, ctx.pointTier, 1, 5, 8);
        const ones = rng.int(0, 9);
        const n = tens * 10 + ones;
        const askTens = (ctx.variantSeed & 1) === 0;
        const correct = askTens ? tens : ones;
        return {
          prompt: askTens ? `How many tens are in ${n}?` : `How many ones are in ${n}?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2]),
          explanation: `${n} is ${tens} tens and ${ones} ones.`,
          strategyTags: ["split into tens and ones", "read each digit's job"],
          trapWarning: "The tens digit and ones digit do different jobs."
        };
      }
    },
    {
      familyId: "compose_number",
      generate: (ctx, rng) => {
        const tens = tierNumber(rng, ctx.pointTier, 1, 5, 9);
        const ones = rng.int(0, 9);
        const correct = tens * 10 + ones;
        return {
          prompt: `Which number has ${tens} tens and ${ones} ones?`,
          correct: String(correct),
          distractors: textDistractors(String(correct), [
            String(ones * 10 + tens),
            String(tens * 10),
            String(ones),
            String(correct + 1),
            String(Math.max(0, correct - 1))
          ]),
          explanation: `${tens} tens is ${tens * 10}. Add ${ones} ones to get ${correct}.`,
          strategyTags: ["build from tens", "then add ones"],
          trapWarning: "Do not swap the tens digit and ones digit."
        };
      }
    },
    {
      familyId: "digit_value",
      generate: (_ctx, rng) => {
        const tens = rng.int(2, 9);
        const ones = rng.int(1, 9);
        const n = tens * 10 + ones;
        const askTensDigit = rng.int(0, 1) === 0;
        const correct = askTensDigit ? tens * 10 : ones;
        return {
          prompt: askTensDigit ? `What is the value of the digit ${tens} in ${n}?` : `What is the value of the digit ${ones} in ${n}?`,
          correct: String(correct),
          distractors: textDistractors(String(correct), [String(tens), String(ones), String(n), String(tens * 10 + ones * 10)]),
          explanation: askTensDigit ? `The digit ${tens} is in the tens place, so its value is ${tens * 10}.` : `The digit ${ones} is in the ones place, so its value is ${ones}.`,
          strategyTags: ["value depends on place", "digit and value are not the same"],
          trapWarning: "A digit's value changes with its place."
        };
      }
    }
  ],
  single_digit_add_sub: [
    {
      familyId: "fact_fluency",
      generate: (ctx, rng) => {
        const a = tierNumber(rng, ctx.pointTier, 1, 6, 9);
        const b = tierNumber(rng, ctx.pointTier, 1, 5, 9);
        const add = (ctx.variantSeed & 1) === 0;
        const left = add ? a : Math.max(a, b);
        const right = add ? b : Math.min(a, b);
        const correct = add ? left + right : left - right;
        return {
          prompt: add ? `${left} + ${right} = ?` : `${left} - ${right} = ?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2]),
          explanation: add ? `Add ${left} and ${right} to get ${correct}.` : `Subtract ${right} from ${left} to get ${correct}.`,
          strategyTags: ["use known facts", "check the sign"],
          trapWarning: "Read whether it is plus or minus before solving."
        };
      }
    },
    {
      familyId: "missing_part",
      generate: (_ctx, rng) => {
        const whole = rng.int(6, 18);
        const part = rng.int(1, whole - 2);
        const correct = whole - part;
        return {
          prompt: `${part} + ? = ${whole}. What is the missing number?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2]),
          explanation: `The missing part is ${whole} - ${part} = ${correct}.`,
          strategyTags: ["think of the fact family", "subtract to find the missing part"],
          trapWarning: "The missing number is not always the bigger number you see."
        };
      }
    },
    {
      familyId: "story_problem",
      generate: (ctx, rng) => {
        const start = tierNumber(rng, ctx.pointTier, 3, 7, 12);
        const change = rng.int(1, 6);
        const add = rng.int(0, 1) === 0;
        const correct = add ? start + change : start - Math.min(change, start - 1);
        const actualChange = add ? change : start - correct;
        return {
          prompt: add
            ? `Lina had ${start} stickers and got ${actualChange} more. How many stickers does she have now?`
            : `Lina had ${start} stickers and gave away ${actualChange}. How many stickers does she have now?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [actualChange, -actualChange, 1, -1]),
          explanation: add ? `This is a join story: ${start} + ${actualChange} = ${correct}.` : `This is a take-away story: ${start} - ${actualChange} = ${correct}.`,
          strategyTags: ["picture the story", "choose plus or minus from the action word"],
          trapWarning: "Words like got and gave away tell you whether to add or subtract."
        };
      }
    },
    {
      familyId: "multi_step_remaining",
      generate: (_ctx, rng) => {
        const oranges = rng.pick([4, 6, 8]);
        const pears = rng.int(1, 3);
        const apples = rng.int(2, 4);
        const total = pears + apples + oranges;
        const correct = oranges / 2;
        return {
          prompt: `There are ${total} pieces of fruit. ${pears} pears and ${apples} apples are removed, then half of the oranges are removed. How many oranges are left?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
          explanation: `After removing pears and apples, ${oranges} oranges remain. Half of ${oranges} is removed, so ${correct} oranges are left.`,
          strategyTags: ["remove the non-oranges first", "then take half of the oranges"],
          trapWarning: "Half of the oranges are removed, not all of them."
        };
      }
    }
  ],
  number_line: [
    {
      familyId: "jump_direction",
      generate: (ctx, rng) => {
        const start = tierNumber(rng, ctx.pointTier, 3, 9, 15);
        const jump = rng.int(1, ctx.pointTier === 5 ? 6 : 4);
        const add = rng.int(0, 1) === 0;
        const correct = add ? start + jump : start - jump;
        return {
          prompt: add
            ? `Start at ${start} on a number line and jump right ${jump}. Where do you land?`
            : `Start at ${start} on a number line and jump left ${jump}. Where do you land?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, jump, -jump], 0),
          explanation: add ? `Right on a number line means add ${jump}.` : `Left on a number line means subtract ${jump}.`,
          strategyTags: ["right means plus", "left means minus"],
          trapWarning: "Do not jump in the wrong direction."
        };
      }
    },
    {
      familyId: "missing_start",
      generate: (_ctx, rng) => {
        const jump = rng.int(1, 5);
        const end = rng.int(6, 20);
        const add = rng.int(0, 1) === 0;
        const correct = add ? end - jump : end + jump;
        return {
          prompt: add
            ? `A jump of ${jump} to the right lands on ${end}. Where did the jump start?`
            : `A jump of ${jump} to the left lands on ${end}. Where did the jump start?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, jump, -jump], 0),
          explanation: `Work backward: ${add ? `${end} - ${jump}` : `${end} + ${jump}`} = ${correct}.`,
          strategyTags: ["work backward", "undo the jump"],
          trapWarning: "To find the start, reverse the direction."
        };
      }
    },
    {
      familyId: "distance_between",
      generate: (_ctx, rng) => {
        const a = rng.int(1, 12);
        const b = a + rng.int(2, 8);
        const correct = b - a;
        return {
          prompt: `How many jumps of 1 are needed to go from ${a} to ${b} on a number line?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
          explanation: `The distance is ${b} - ${a} = ${correct}.`,
          strategyTags: ["count the gap", "subtract end minus start"],
          trapWarning: "Count spaces between the numbers, not both endpoints."
        };
      }
    }
  ],
  fractions_words: [
    {
      familyId: "fraction_of_total",
      generate: (ctx, rng) => {
        const choices = [
          { word: "half", parts: 2 },
          { word: "third", parts: 3 },
          { word: "quarter", parts: 4 }
        ] as const;
        const pick = choices[(ctx.variantSeed + ctx.grade) % choices.length];
        const total = pick.parts * tierNumber(rng, ctx.pointTier, 2, 4, 6);
        const correct = total / pick.parts;
        return {
          prompt: `What is one ${pick.word} of ${total}?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, correct, -correct], 1),
          explanation: `${pick.word} means split into ${pick.parts} equal parts. ${total} ÷ ${pick.parts} = ${correct}.`,
          strategyTags: ["fraction words mean equal parts", "divide the whole evenly"],
          trapWarning: "Fractions only work with equal parts."
        };
      }
    },
    {
      familyId: "whole_from_fraction",
      generate: (_ctx, rng) => {
        const parts = rng.pick([2, 4]);
        const piece = rng.int(2, 6);
        const word = parts === 2 ? "half" : "quarter";
        const correct = piece * parts;
        return {
          prompt: `One ${word} of a ribbon is ${piece} cm. How long is the whole ribbon?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [piece, -piece, 2, -2], 1),
          explanation: `If one ${word} is ${piece}, then ${parts} equal parts make the whole: ${piece} × ${parts} = ${correct}.`,
          strategyTags: ["build the whole from equal parts", "multiply repeated parts"],
          trapWarning: "A whole has all equal parts, not just one part."
        };
      }
    },
    {
      familyId: "name_the_fraction",
      generate: (_ctx, rng) => {
        const parts = rng.pick([2, 3, 4]);
        const correct = parts === 2 ? "half" : parts === 3 ? "third" : "quarter";
        return {
          prompt: `A cake is cut into ${parts} equal pieces. What is one piece called?`,
          correct,
          distractors: textDistractors(correct, ["half", "third", "quarter", "whole", "double"]),
          explanation: `When a whole is cut into ${parts} equal pieces, one piece is called one ${correct}.`,
          strategyTags: ["match the fraction word to the number of equal parts", "say the whole is split evenly"],
          trapWarning: "The number of pieces decides the fraction word."
        };
      }
    }
  ],
  sorting_classifying: [
    {
      familyId: "count_by_rule",
      generate: (_ctx, rng) => {
        const pets = ["cat", "dog", "fish", "cat", "bird", "dog", "cat"];
        const target = rng.pick(["cat", "dog", "fish", "bird"]);
        const correct = pets.filter((pet) => pet === target).length;
        return {
          prompt: `List: ${pets.join(", ")}. How many are ${target}s?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
          explanation: `Count only the ${target}s. There are ${correct}.`,
          strategyTags: ["use one sorting rule", "ignore everything else"],
          trapWarning: "Count only the matching objects."
        };
      }
    },
    {
      familyId: "odd_one_out",
      generate: (_ctx, rng) => {
        const sets = [
          { items: ["triangle", "square", "circle", "rectangle"], correct: "circle", reason: "It has no straight sides." },
          { items: ["penny", "nickel", "dime", "button"], correct: "button", reason: "It is not money." },
          { items: ["red", "blue", "green", "cat"], correct: "cat", reason: "It is not a color." }
        ];
        const pick = sets[rng.int(0, sets.length - 1)];
        return {
          prompt: `Which item does not belong: ${pick.items.join(", ")}?`,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, pick.items),
          explanation: pick.reason,
          strategyTags: ["find the shared rule", "spot the one that breaks it"],
          trapWarning: "Do not pick the item you like best; pick the one that breaks the rule."
        };
      }
    },
    {
      familyId: "same_attribute",
      generate: (_ctx, rng) => {
        const prompts = [
          { prompt: "Which pair has the same shape?", correct: "square and square", pool: ["square and square", "square and circle", "triangle and square", "circle and triangle", "rectangle and circle"] },
          { prompt: "Which pair has the same color?", correct: "red and red", pool: ["red and red", "red and blue", "green and yellow", "blue and green", "yellow and red"] }
        ];
        const pick = prompts[rng.int(0, prompts.length - 1)];
        return {
          prompt: pick.prompt,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, pick.pool),
          explanation: `Only ${pick.correct} matches the rule.`,
          strategyTags: ["check one attribute at a time", "same means exactly matching"],
          trapWarning: "Do not mix two different rules."
        };
      }
    },
    {
      familyId: "exclusion_shelf",
      generate: (_ctx, rng) => {
        const promptSet = rng.pick([
          {
            prompt: "There are no turtles, no rabbits, and no robots on the shelf. Which shelf could it be?",
            correct: "bear, cat, dog",
            pool: [
              "bear, cat, dog",
              "bear, rabbit, dog",
              "turtle, cat, dog",
              "bear, robot, dog",
              "rabbit, robot, turtle"
            ]
          },
          {
            prompt: "There are no fish, no birds, and no cars in the box. Which group could be in the box?",
            correct: "ball, doll, bear",
            pool: [
              "ball, doll, bear",
              "ball, fish, bear",
              "bird, doll, bear",
              "car, doll, ball",
              "fish, bird, car"
            ]
          }
        ]);
        return {
          prompt: promptSet.prompt,
          correct: promptSet.correct,
          distractors: textDistractors(promptSet.correct, promptSet.pool),
          explanation: `The correct choice avoids every forbidden item.`,
          strategyTags: ["cross out forbidden items", "keep only the choice with none of them"],
          trapWarning: "A single forbidden item makes the whole option wrong."
        };
      }
    }
  ],
  measurement_small: [
    {
      familyId: "unit_compare",
      generate: (ctx, rng) => {
        const kind = (ctx.variantSeed + ctx.grade) % 3;
        if (kind === 0) {
          const cm = tierNumber(rng, ctx.pointTier, 40, 85, 98);
          return {
            prompt: `Which is longer: 1 meter or ${cm} centimeters?`,
            correct: "1 meter",
            distractors: textDistractors("1 meter", [`${cm} centimeters`, "They are equal", "Cannot tell", "1 centimeter"]),
            explanation: "1 meter is 100 centimeters, so it is longer.",
            strategyTags: ["convert to the same unit", "remember 1 m = 100 cm"],
            trapWarning: "Do not compare different units without converting."
          };
        }
        if (kind === 1) {
          const grams = tierNumber(rng, ctx.pointTier, 350, 780, 980);
          return {
            prompt: `Which is heavier: 1 kilogram or ${grams} grams?`,
            correct: "1 kilogram",
            distractors: textDistractors("1 kilogram", [`${grams} grams`, "They are equal", "Cannot tell", "1 gram"]),
            explanation: "1 kilogram is 1000 grams, so it is heavier.",
            strategyTags: ["convert to the same unit", "remember 1 kg = 1000 g"],
            trapWarning: "A bigger number is not bigger unless the units match."
          };
        }
        const ml = tierNumber(rng, ctx.pointTier, 420, 760, 960);
        return {
          prompt: `Which holds more: 1 liter or ${ml} milliliters?`,
          correct: "1 liter",
          distractors: textDistractors("1 liter", [`${ml} milliliters`, "They are equal", "Cannot tell", "1 milliliter"]),
          explanation: "1 liter is 1000 milliliters, so it holds more.",
          strategyTags: ["convert to the same unit", "remember 1 L = 1000 mL"],
          trapWarning: "Do not compare liters and milliliters as if they were the same unit."
        };
      }
    },
    {
      familyId: "best_unit",
      generate: (_ctx, rng) => {
        const cases = [
          { prompt: "Which unit is best to measure the length of a pencil?", correct: "centimeters", pool: ["centimeters", "meters", "kilograms", "liters", "days"] },
          { prompt: "Which unit is best to measure the weight of an apple?", correct: "grams", pool: ["grams", "liters", "meters", "weeks", "centimeters"] },
          { prompt: "Which unit is best to measure a bottle of juice?", correct: "milliliters", pool: ["milliliters", "meters", "kilograms", "minutes", "centimeters"] }
        ];
        const pick = cases[rng.int(0, cases.length - 1)];
        return {
          prompt: pick.prompt,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, pick.pool),
          explanation: `${pick.correct} is the sensible unit for that object.`,
          strategyTags: ["match the object to the unit", "think about what is being measured"],
          trapWarning: "Pick a length unit for length, a weight unit for weight, and a capacity unit for liquids."
        };
      }
    },
    {
      familyId: "same_unit_sum",
      generate: (_ctx, rng) => {
        const a = rng.int(8, 30);
        const b = rng.int(6, 28);
        const unit = rng.pick(["cm", "g", "mL"]);
        const correct = a + b;
        return {
          prompt: `A ribbon is ${a} ${unit} long and another ribbon is ${b} ${unit} long. How long are they together?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, a - b, b - a], 0),
          explanation: `The units already match, so add: ${a} + ${b} = ${correct}.`,
          strategyTags: ["check whether units already match", "then add or subtract"],
          trapWarning: "Do not convert when both measurements already use the same unit."
        };
      }
    }
  ],
  patterns: [
    {
      familyId: "growing_number_pattern",
      generate: (ctx, rng) => {
        const step = tierNumber(rng, ctx.pointTier, 1, 3, 5);
        const start = tierNumber(rng, ctx.pointTier, 1, 7, 16);
        const correct = start + step * 3;
        return {
          prompt: `Find the rule and the next number: ${start}, ${start + step}, ${start + step * 2}, ?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [step, -step, 1, -1]),
          explanation: `The pattern adds ${step} each time, so the next number is ${correct}.`,
          strategyTags: ["compare two jumps", "continue the same rule"],
          trapWarning: "A pattern should use one clear rule."
        };
      }
    },
    {
      familyId: "repeating_shape_pattern",
      generate: (_ctx, rng) => {
        const families = [
          { prompt: "square, circle, square, circle, ?", correct: "square" },
          { prompt: "triangle, triangle, star, triangle, triangle, star, ?", correct: "triangle" },
          { prompt: "red, blue, red, blue, ?", correct: "red" }
        ];
        const pick = families[rng.int(0, families.length - 1)];
        return {
          prompt: `What comes next in the pattern? ${pick.prompt}`,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, ["square", "circle", "triangle", "star", "red", "blue"]),
          explanation: `Repeat the pattern block to find the next item: ${pick.correct}.`,
          strategyTags: ["find the repeating block", "restart the pattern block"],
          trapWarning: "Look at the whole repeating block, not just the last item."
        };
      }
    },
    {
      familyId: "growing_shape_count",
      generate: (_ctx, rng) => {
        const start = rng.int(1, 4);
        const add = rng.int(1, 3);
        const correct = start + add * 3;
        return {
          prompt: `A block tower has ${start}, ${start + add}, ${start + add * 2} blocks in the first three pictures. How many blocks are in the next picture?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [add, -add, 1, -1], 0),
          explanation: `The tower grows by ${add} blocks each time, so the next tower has ${correct} blocks.`,
          strategyTags: ["watch how much it grows", "extend the pattern once"],
          trapWarning: "Do not add different amounts on each step."
        };
      }
    }
  ],
  perimeter_broken_lines: [
    {
      familyId: "broken_line_total",
      format: "svg",
      generate: (_ctx, rng) => {
        const lengths = [rng.int(2, 5), rng.int(2, 5), rng.int(2, 5), rng.int(2, 5)];
        const correct = lengths.reduce((sum, value) => sum + value, 0);
        return {
          prompt: "What is the total length of the broken line?",
          correct: String(correct),
          distractors: numericDistractors(correct, [2, -2, lengths[0], -lengths[0]], 1),
          explanation: `Add all the side lengths: ${lengths.join(" + ")} = ${correct}.`,
          strategyTags: ["trace the whole outside", "add every segment once"],
          trapWarning: "Do not stop after only two segments.",
          format: "svg",
          visualAssetSpec: renderBrokenLine(lengths)
        };
      }
    },
    {
      familyId: "missing_segment",
      generate: (_ctx, rng) => {
        const a = rng.int(2, 6);
        const b = rng.int(2, 6);
        const c = rng.int(2, 6);
        const total = a + b + c;
        return {
          prompt: `A broken line has three parts. Two parts are ${a} cm and ${b} cm. The total length is ${total} cm. How long is the missing part?`,
          correct: String(c),
          distractors: numericDistractors(c, [1, -1, 2, -2], 1),
          explanation: `The missing part is ${total} - ${a} - ${b} = ${c}.`,
          strategyTags: ["use total minus known parts", "subtract one part at a time"],
          trapWarning: "Do not add when the total is already given."
        };
      }
    },
    {
      familyId: "rectangle_perimeter",
      generate: (_ctx, rng) => {
        const width = rng.int(2, 6);
        const height = rng.int(2, 5);
        const correct = 2 * (width + height);
        return {
          prompt: `A rectangle is ${width} cm long and ${height} cm wide. What is its perimeter?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [width, -width, 2, -2], 1),
          explanation: `A rectangle has two lengths and two widths, so perimeter = ${width} + ${height} + ${width} + ${height} = ${correct}.`,
          strategyTags: ["count both pairs of sides", "walk all the way around"],
          trapWarning: "Area and perimeter are not the same."
        };
      }
    }
  ],
  relative_position: [
    {
      familyId: "middle_of_line",
      generate: (_ctx, rng) => {
        const items = rng.pick([
          ["cat", "dog", "rabbit"],
          ["red box", "blue box", "green box"],
          ["apple", "pear", "orange"]
        ]);
        return {
          prompt: `The ${items[0]} is left of the ${items[1]}. The ${items[1]} is left of the ${items[2]}. Which is in the middle?`,
          correct: items[1],
          distractors: textDistractors(items[1], [...items, "none", "all"]),
          explanation: `${items[1]} is between ${items[0]} and ${items[2]}.`,
          strategyTags: ["draw a quick line picture", "find the item between the two others"],
          trapWarning: "Middle means between, not first or last."
        };
      }
    },
    {
      familyId: "above_below",
      generate: (_ctx, rng) => {
        const top = rng.pick(["kite", "bird", "sun"]);
        const middle = rng.pick(["tree", "house", "cloud"]);
        const bottom = rng.pick(["car", "dog", "boat"]);
        return {
          prompt: `The ${top} is above the ${middle}. The ${middle} is above the ${bottom}. Which is lowest?`,
          correct: bottom,
          distractors: textDistractors(bottom, [top, middle, bottom, "all", "none"]),
          explanation: `If ${middle} is above ${bottom}, then ${bottom} is the lowest.`,
          strategyTags: ["chain the clues in order", "look for highest or lowest"],
          trapWarning: "Above and below are opposites."
        };
      }
    },
    {
      familyId: "inside_outside",
      generate: (_ctx, rng) => {
        const inside = rng.pick(["ball", "star", "coin"]);
        const outside = rng.pick(["box", "bag", "circle"]);
        const correct = inside;
        return {
          prompt: `A ${inside} is inside a ${outside}. Which object is inside?`,
          correct,
          distractors: textDistractors(correct, [inside, outside, "both", "neither", "cannot tell"]),
          explanation: `The clue says the ${inside} is inside the ${outside}.`,
          strategyTags: ["underline the position word", "match object to relation"],
          trapWarning: "Inside and outside answer different questions."
        };
      }
    }
  ],
  shape_properties: [
    {
      familyId: "count_sides",
      generate: (_ctx, rng) => {
        const shape = rng.pick([
          { name: "triangle", value: 3 },
          { name: "square", value: 4 },
          { name: "pentagon", value: 5 },
          { name: "hexagon", value: 6 }
        ]);
        return {
          prompt: `How many sides does a ${shape.name} have?`,
          correct: String(shape.value),
          distractors: numericDistractors(shape.value, [1, -1, 2, -2], 1),
          explanation: `A ${shape.name} has ${shape.value} sides.`,
          strategyTags: ["count the edges", "match shape name to side count"],
          trapWarning: "Sides and corners are related, but the question asks for one of them."
        };
      }
    },
    {
      familyId: "count_corners",
      generate: (_ctx, rng) => {
        const shape = rng.pick([
          { name: "triangle", value: 3 },
          { name: "rectangle", value: 4 },
          { name: "pentagon", value: 5 }
        ]);
        return {
          prompt: `How many corners does a ${shape.name} have?`,
          correct: String(shape.value),
          distractors: numericDistractors(shape.value, [1, -1, 2, -2], 0),
          explanation: `A ${shape.name} has ${shape.value} corners.`,
          strategyTags: ["count vertices", "corners are turning points"],
          trapWarning: "A circle has no corners because it never turns sharply."
        };
      }
    },
    {
      familyId: "shape_description",
      generate: (_ctx, rng) => {
        const set = rng.pick([
          { prompt: "Which shape has 4 equal sides?", correct: "square", pool: ["square", "triangle", "rectangle", "circle", "pentagon"] },
          { prompt: "Which shape has 3 sides?", correct: "triangle", pool: ["triangle", "square", "rectangle", "circle", "hexagon"] },
          { prompt: "Which shape has no corners?", correct: "circle", pool: ["circle", "triangle", "square", "rectangle", "pentagon"] }
        ]);
        return {
          prompt: set.prompt,
          correct: set.correct,
          distractors: textDistractors(set.correct, set.pool),
          explanation: `${set.correct} is the only shape that matches the description.`,
          strategyTags: ["match properties to the shape", "use side and corner facts"],
          trapWarning: "Read every word in the description before choosing."
        };
      }
    }
  ],
  maze_shape_puzzles: [
    {
      familyId: "turn_count",
      format: "svg",
      generate: (_ctx, rng) => {
        const leftTurns = rng.int(1, 4);
        const rightTurns = rng.int(1, 3);
        const correct = leftTurns + rightTurns;
        return {
          prompt: `A path uses ${leftTurns} left turn(s) and ${rightTurns} right turn(s). How many turns are there in all?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, leftTurns - rightTurns, rightTurns - leftTurns], 0),
          explanation: `Count all turns: ${leftTurns} + ${rightTurns} = ${correct}.`,
          strategyTags: ["count all the turns", "add left and right turns"],
          trapWarning: "The question asks for total turns, not just left turns.",
          format: "svg",
          visualAssetSpec: renderMaze(rng.int(1, 999), { leftTurns, rightTurns })
        };
      }
    },
    {
      familyId: "shape_make",
      generate: (_ctx, rng) => {
        const set = rng.pick([
          { prompt: "Two equal triangles can make which larger shape?", correct: "square", pool: ["square", "circle", "pentagon", "line", "none"] },
          { prompt: "Two smaller squares can join to make which rectangle?", correct: "1 by 2 rectangle", pool: ["1 by 2 rectangle", "triangle", "circle", "cube", "none"] },
          { prompt: "A square cut along a diagonal makes how many triangles?", correct: "2", pool: ["1", "2", "3", "4", "5"] }
        ]);
        return {
          prompt: set.prompt,
          correct: set.correct,
          distractors: textDistractors(set.correct, set.pool),
          explanation: `${set.correct} is the correct shape result.`,
          strategyTags: ["picture the pieces moving together", "use simple shape facts"],
          trapWarning: "Think about how pieces fit, not just how many pieces there are."
        };
      }
    },
    {
      familyId: "shortest_path_reasoning",
      generate: (_ctx, rng) => {
        const pathA = rng.int(5, 9);
        const pathB = pathA + rng.int(1, 4);
        return {
          prompt: `Path A has ${pathA} steps. Path B has ${pathB} steps. Which path is shorter?`,
          correct: "Path A",
          distractors: textDistractors("Path A", ["Path A", "Path B", "They are equal", "Cannot tell"]),
          explanation: `${pathA} is fewer than ${pathB}, so Path A is shorter.`,
          strategyTags: ["compare total steps", "choose the smaller count"],
          trapWarning: "Shorter means fewer steps."
        };
      }
    }
  ],
  cube_cuboid_visualization: [
    {
      familyId: "count_marks_on_cube",
      format: "svg",
      generate: (_ctx, rng) => {
        const marks = rng.int(2, 5);
        return {
          prompt: "How many marked squares do you see on the cube picture?",
          correct: String(marks),
          distractors: numericDistractors(marks, [1, -1, 2, -2], 0),
          explanation: `Count the marked squares you can see. There are ${marks}.`,
          strategyTags: ["count visible marks once", "scan left to right"],
          trapWarning: "Do not count the same mark twice.",
          format: "svg",
          visualAssetSpec: renderCube(marks)
        };
      }
    },
    {
      familyId: "cube_facts",
      generate: (_ctx, rng) => {
        const ask = rng.pick([
          { prompt: "How many faces does a cube have?", correct: "6", pool: ["4", "5", "6", "7", "8"] },
          { prompt: "How many corners does a cube have?", correct: "8", pool: ["6", "7", "8", "9", "10"] },
          { prompt: "How many edges does a cube have?", correct: "12", pool: ["8", "10", "12", "14", "16"] }
        ]);
        return {
          prompt: ask.prompt,
          correct: ask.correct,
          distractors: textDistractors(ask.correct, ask.pool),
          explanation: `That is a standard cube fact: ${ask.correct}.`,
          strategyTags: ["know basic cube facts", "link face-edge-corner counts"],
          trapWarning: "Faces, edges, and corners are different parts."
        };
      }
    },
    {
      familyId: "hidden_faces",
      generate: (_ctx, rng) => {
        const shown = rng.int(2, 3);
        const correct = 6 - shown;
        return {
          prompt: `A cube has 6 faces. If ${shown} faces are shown in a drawing, how many faces are hidden?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
          explanation: `A cube has 6 faces, so hidden faces = 6 - ${shown} = ${correct}.`,
          strategyTags: ["start from 6 faces", "subtract the visible faces"],
          trapWarning: "Use the total number of faces first."
        };
      }
    }
  ],
  likelihood_vocabulary: [
    {
      familyId: "chance_words",
      generate: (_ctx, rng) => {
        const items = [
          { prompt: "Rolling a 7 on a normal die is", correct: "impossible" },
          { prompt: "The sun rising tomorrow is", correct: "certain" },
          { prompt: "Getting wet in the rain without an umbrella is", correct: "likely" }
        ];
        const pick = items[rng.int(0, items.length - 1)];
        return {
          prompt: `${pick.prompt}:`,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, ["certain", "impossible", "likely", "unlikely", "equal"]),
          explanation: `${pick.correct} is the best chance word for this event.`,
          strategyTags: ["match the event to a chance word", "think about whether it can happen"],
          trapWarning: "Impossible means zero chance. Certain means always."
        };
      }
    },
    {
      familyId: "bag_probability",
      generate: (_ctx, rng) => {
        const red = rng.int(1, 3);
        const blue = red + rng.int(2, 4);
        return {
          prompt: `A bag has ${red} red marble(s) and ${blue} blue marble(s). Which color is more likely to be picked?`,
          correct: "blue",
          distractors: textDistractors("blue", ["red", "blue", "equally likely", "impossible", "certain"]),
          explanation: `There are more blue marbles than red marbles, so blue is more likely.`,
          strategyTags: ["compare favorable outcomes", "more objects means more likely"],
          trapWarning: "More likely does not mean certain."
        };
      }
    },
    {
      familyId: "equally_likely",
      generate: (_ctx, rng) => {
        const count = rng.int(2, 5);
        return {
          prompt: `A bag has ${count} red marble(s) and ${count} blue marble(s). Picking red or blue is`,
          correct: "equally likely",
          distractors: textDistractors("equally likely", ["more likely red", "more likely blue", "equally likely", "impossible", "certain"]),
          explanation: `The counts are the same, so the chances are equal.`,
          strategyTags: ["equal counts mean equal chance", "compare both groups"],
          trapWarning: "Equal groups do not make one color more likely."
        };
      }
    }
  ],
  pictographs_bar_graphs: [
    {
      familyId: "largest_row",
      format: "svg",
      generate: (_ctx, rng) => {
        const groups = [rng.int(1, 4), rng.int(2, 5), rng.int(1, 4)];
        const labels = ["A", "B", "C"];
        const correct = labels[groups.indexOf(Math.max(...groups))];
        return {
          prompt: "Which row has the greatest count?",
          correct,
          distractors: textDistractors(correct, ["A", "B", "C", "All equal", "None"]),
          explanation: `Count the symbols in each row. Row ${correct} has the most.`,
          strategyTags: ["count each row carefully", "compare totals"],
          trapWarning: "Do not stop after the first row.",
          format: "svg",
          visualAssetSpec: renderPictograph(groups, { labels })
        };
      }
    },
    {
      familyId: "legend_total",
      format: "svg",
      generate: (_ctx, rng) => {
        const groups = [rng.int(1, 4), rng.int(1, 4), rng.int(1, 4)];
        const label = rng.pick(["A", "B", "C"]);
        const idx = label.charCodeAt(0) - 65;
        const valuePerIcon = rng.pick([2, 5]);
        const correct = groups[idx] * valuePerIcon;
        return {
          prompt: `Each symbol stands for ${valuePerIcon}. What is the total for row ${label}?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [valuePerIcon, -valuePerIcon, 1, -1], 0),
          explanation: `Row ${label} has ${groups[idx]} symbols. ${groups[idx]} × ${valuePerIcon} = ${correct}.`,
          strategyTags: ["read the legend first", "multiply icons by value"],
          trapWarning: "Each symbol may stand for more than 1.",
          format: "svg",
          visualAssetSpec: renderPictograph(groups, { labels: ["A", "B", "C"], valuePerIcon })
        };
      }
    },
    {
      familyId: "difference_rows",
      format: "svg",
      generate: (_ctx, rng) => {
        const groups = [rng.int(2, 5), rng.int(1, 4), rng.int(1, 4)];
        const correct = Math.max(...groups) - Math.min(...groups);
        return {
          prompt: "How many more symbols are in the longest row than in the shortest row?",
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
          explanation: `Compare the longest and shortest rows, then subtract to find the difference.`,
          strategyTags: ["find largest and smallest", "subtract to compare"],
          trapWarning: "More means subtract, not add.",
          format: "svg",
          visualAssetSpec: renderPictograph(groups, { labels: ["A", "B", "C"] })
        };
      }
    }
  ],
  venn_diagrams_easy: [
    {
      familyId: "union_total",
      format: "svg",
      generate: (_ctx, rng) => {
        const aOnly = rng.int(1, 4);
        const both = rng.int(1, 3);
        const bOnly = rng.int(1, 4);
        const correct = aOnly + both + bOnly;
        return {
          prompt: "How many objects are in A or B?",
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, both, -both], 0),
          explanation: `Count A only + both + B only: ${aOnly} + ${both} + ${bOnly} = ${correct}.`,
          strategyTags: ["union means either circle or both", "add all parts once"],
          trapWarning: "Count the overlap only one time.",
          format: "svg",
          visualAssetSpec: renderVenn(aOnly, both, bOnly)
        };
      }
    },
    {
      familyId: "overlap_only",
      format: "svg",
      generate: (_ctx, rng) => {
        const aOnly = rng.int(1, 4);
        const both = rng.int(1, 3);
        const bOnly = rng.int(1, 4);
        return {
          prompt: "How many objects are in both A and B?",
          correct: String(both),
          distractors: numericDistractors(both, [1, -1, 2, -2], 0),
          explanation: `The overlap region is the part in both sets. It shows ${both}.`,
          strategyTags: ["look at the overlap", "both means the middle region"],
          trapWarning: "Do not add the outside regions when the question says both.",
          format: "svg",
          visualAssetSpec: renderVenn(aOnly, both, bOnly)
        };
      }
    },
    {
      familyId: "exactly_one_set",
      format: "svg",
      generate: (_ctx, rng) => {
        const aOnly = rng.int(1, 4);
        const both = rng.int(1, 3);
        const bOnly = rng.int(1, 4);
        const correct = aOnly + bOnly;
        return {
          prompt: "How many objects are in exactly one of the sets?",
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, both, -both], 0),
          explanation: `Exactly one set means A only + B only, so ${aOnly} + ${bOnly} = ${correct}.`,
          strategyTags: ["exactly one means outside the overlap", "add only the two outer parts"],
          trapWarning: "Do not include the middle overlap when the question says exactly one.",
          format: "svg",
          visualAssetSpec: renderVenn(aOnly, both, bOnly)
        };
      }
    }
  ],
  calendar: [
    {
      familyId: "days_forward",
      generate: (_ctx, rng) => {
        const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const today = rng.int(0, 6);
        const jump = rng.int(1, 4);
        const correct = week[(today + jump) % 7];
        return {
          prompt: `If today is ${week[today]}, what day is it after ${jump} day(s)?`,
          correct,
          distractors: textDistractors(correct, week),
          explanation: `Move forward ${jump} day(s) on the 7-day cycle to reach ${correct}.`,
          strategyTags: ["count days ahead", "use the 7-day cycle"],
          trapWarning: "Do not count the starting day twice."
        };
      }
    },
    {
      familyId: "days_backward",
      generate: (_ctx, rng) => {
        const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const today = rng.int(0, 6);
        const jump = rng.int(1, 3);
        const correct = week[(today - jump + 7) % 7];
        return {
          prompt: `If today is ${week[today]}, what day was it ${jump} day(s) ago?`,
          correct,
          distractors: textDistractors(correct, week),
          explanation: `Move backward ${jump} day(s) on the 7-day cycle to reach ${correct}.`,
          strategyTags: ["count backward", "use the weekly cycle"],
          trapWarning: "Ago means move backward, not forward."
        };
      }
    },
    {
      familyId: "month_order",
      generate: (_ctx, rng) => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const idx = rng.int(0, 10);
        const askNext = rng.int(0, 1) === 0;
        const correct = askNext ? months[idx + 1] : months[idx];
        return {
          prompt: askNext ? `Which month comes after ${months[idx]}?` : `Which month comes before ${months[idx + 1]}?`,
          correct,
          distractors: textDistractors(correct, months.slice(Math.max(0, idx - 1), Math.min(months.length, idx + 4))),
          explanation: `Use the month order to find the correct month: ${correct}.`,
          strategyTags: ["remember month order", "move one month forward or back"],
          trapWarning: "After and before are opposite directions."
        };
      }
    }
  ],
  money_small: [
    {
      familyId: "coin_total",
      generate: (_ctx, rng) => {
        const pennies = rng.int(0, 5);
        const nickels = rng.int(0, 4);
        const dimes = rng.int(0, 3);
        const correct = pennies + 5 * nickels + 10 * dimes;
        return {
          prompt: `You have ${pennies} penn${pennies === 1 ? "y" : "ies"}, ${nickels} nickel(s), and ${dimes} dime(s). How many cents is that in all?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, 5, -5], 0),
          explanation: `Pennies are 1 cent, nickels are 5 cents, and dimes are 10 cents. Add them all to get ${correct}.`,
          strategyTags: ["convert every coin to cents", "group 5s and 10s first"],
          trapWarning: "Do not confuse nickels and dimes."
        };
      }
    },
    {
      familyId: "enough_money",
      generate: (_ctx, rng) => {
        const total = rng.pick([12, 15, 18, 20, 25]);
        const price = total - rng.int(1, 4);
        return {
          prompt: `A toy costs ${price} cents. You have ${total} cents. Do you have enough money?`,
          correct: "yes",
          distractors: textDistractors("yes", ["yes", "no", "only if you borrow", "cannot tell", "maybe"]),
          explanation: `${total} is at least ${price}, so you have enough money.`,
          strategyTags: ["compare money to price", "enough means greater than or equal"],
          trapWarning: "Enough can mean exactly the same amount or more."
        };
      }
    },
    {
      familyId: "which_set_matches",
      generate: (_ctx, rng) => {
        const sets = [
          { total: 20, correct: "2 dimes", pool: ["2 dimes", "1 nickel", "3 pennies", "1 dime and 1 penny", "4 pennies"] },
          { total: 15, correct: "1 dime and 1 nickel", pool: ["1 dime and 1 nickel", "2 dimes", "3 nickels and 1 penny", "10 pennies", "1 nickel"] },
          { total: 11, correct: "1 dime and 1 penny", pool: ["1 dime and 1 penny", "2 nickels", "11 nickels", "1 nickel and 1 penny", "11 dimes"] }
        ];
        const pick = sets[rng.int(0, sets.length - 1)];
        return {
          prompt: `Which set of coins makes ${pick.total} cents?`,
          correct: pick.correct,
          distractors: textDistractors(pick.correct, pick.pool),
          explanation: `${pick.correct} is worth ${pick.total} cents.`,
          strategyTags: ["know coin values", "check each set quickly"],
          trapWarning: "Read the total value, not just the number of coins."
        };
      }
    }
  ],
  clock_full_half: [
    {
      familyId: "time_words_to_digital",
      generate: (_ctx, rng) => {
        const hour = rng.int(1, 11);
        const half = rng.int(0, 1) === 0;
        const correct = half ? `${hour}:30` : `${hour}:00`;
        return {
          prompt: half ? `What digital time is half past ${hour}?` : `What digital time is ${hour} o'clock?`,
          correct,
          distractors: textDistractors(correct, [`${hour}:00`, `${hour}:30`, `${(hour % 12) + 1}:00`, `${(hour % 12) + 1}:30`, `${hour}:15`]),
          explanation: half ? `Half past ${hour} means ${hour}:30.` : `${hour} o'clock means ${hour}:00.`,
          strategyTags: ["match the words to :00 or :30", "watch the hour carefully"],
          trapWarning: "Half past is :30, not :15."
        };
      }
    },
    {
      familyId: "half_hour_later",
      generate: (_ctx, rng) => {
        const hour = rng.int(1, 10);
        const startHalf = rng.int(0, 1) === 0;
        const start = startHalf ? `${hour}:30` : `${hour}:00`;
        const correct = startHalf ? `${hour + 1}:00` : `${hour}:30`;
        return {
          prompt: `What time is 30 minutes after ${start}?`,
          correct,
          distractors: textDistractors(correct, [`${hour}:00`, `${hour}:30`, `${hour + 1}:00`, `${hour + 1}:30`, `${hour}:15`]),
          explanation: `Thirty minutes is half an hour. Move from :00 to :30 or from :30 to the next hour.`,
          strategyTags: ["30 minutes means half an hour", "watch when the hour changes"],
          trapWarning: "From :30, the next half-hour lands on the next full hour."
        };
      }
    },
    {
      familyId: "time_before",
      generate: (_ctx, rng) => {
        const hour = rng.int(2, 11);
        const startHalf = rng.int(0, 1) === 0;
        const start = startHalf ? `${hour}:30` : `${hour}:00`;
        const correct = startHalf ? `${hour}:00` : `${hour - 1}:30`;
        return {
          prompt: `What time is 30 minutes before ${start}?`,
          correct,
          distractors: textDistractors(correct, [`${hour}:00`, `${hour}:30`, `${hour - 1}:30`, `${hour - 1}:00`, `${hour}:15`]),
          explanation: `Move back half an hour from ${start} to get ${correct}.`,
          strategyTags: ["move back 30 minutes", "borrow from the earlier hour when needed"],
          trapWarning: "Before means move backward in time."
        };
      }
    }
  ],
  symmetry_rotation: [
    {
      familyId: "mirror_word",
      format: "svg",
      generate: (_ctx, rng) => {
        const pattern = [rng.int(0, 2), rng.int(0, 2), rng.int(0, 2), rng.int(0, 2)];
        return {
          prompt: "A mirror line is shown. Which word names the move?",
          correct: "reflection",
          distractors: textDistractors("reflection", ["reflection", "rotation", "translation", "stretch", "none"]),
          explanation: "A mirror line means reflection.",
          strategyTags: ["mirror means reflection", "look for flip, not turn"],
          trapWarning: "A flip is different from a turn.",
          format: "svg",
          visualAssetSpec: renderSymmetry(pattern)
        };
      }
    },
    {
      familyId: "line_of_symmetry_count",
      generate: (_ctx, rng) => {
        const pick = rng.pick([
          { shape: "square", count: 4 },
          { shape: "rectangle", count: 2 },
          { shape: "triangle", count: 1 }
        ]);
        return {
          prompt: `How many lines of symmetry does a ${pick.shape} have?`,
          correct: String(pick.count),
          distractors: numericDistractors(pick.count, [1, -1, 2, -2], 0),
          explanation: `A ${pick.shape} has ${pick.count} line(s) of symmetry.`,
          strategyTags: ["look for mirror lines", "count only exact matches"],
          trapWarning: "Only a true mirror line counts."
        };
      }
    },
    {
      familyId: "rotation_word",
      generate: (_ctx, rng) => {
        const shape = rng.pick(["arrow", "triangle", "square"]);
        return {
          prompt: `A ${shape} turns around a point. Which word names this move?`,
          correct: "rotation",
          distractors: textDistractors("rotation", ["rotation", "reflection", "translation", "stretch", "none"]),
          explanation: "Turning around a point is rotation.",
          strategyTags: ["turn means rotation", "flip means reflection"],
          trapWarning: "Do not confuse turning with flipping."
        };
      }
    }
  ],
  prealgebra_balance: [
    {
      familyId: "missing_addend_equation",
      generate: (_ctx, rng) => {
        const add = rng.int(1, 6);
        const total = add + rng.int(2, 9);
        const correct = total - add;
        return {
          prompt: `? + ${add} = ${total}. What is ?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, add, -add], 0),
          explanation: `Subtract ${add} from ${total} to find the missing number: ${correct}.`,
          strategyTags: ["undo with subtraction", "keep both sides equal"],
          trapWarning: "The equal sign means both sides have the same value."
        };
      }
    },
    {
      familyId: "same_value_both_sides",
      generate: (_ctx, rng) => {
        const left = rng.int(2, 8);
        const rightAdd = rng.int(1, 5);
        const correct = left - rightAdd;
        return {
          prompt: `${left} = ? + ${rightAdd}. What is ?`,
          correct: String(correct),
          distractors: numericDistractors(correct, [1, -1, rightAdd, -rightAdd], 0),
          explanation: `Both sides must match, so ? = ${left} - ${rightAdd} = ${correct}.`,
          strategyTags: ["same value on both sides", "work backward from the total"],
          trapWarning: "Read the equation as both sides being equal."
        };
      }
    },
    {
      familyId: "balance_scale_story",
      generate: (_ctx, rng) => {
        const circles = rng.int(2, 6);
        const stars = circles + rng.int(1, 4);
        const correct = String(stars - circles);
        return {
          prompt: `A balance has ${circles} circles on one side and ${stars} stars on the other side. How many more stars are there than circles?`,
          correct,
          distractors: numericDistractors(Number(correct), [1, -1, 2, -2], 0),
          explanation: `Compare the two sides by subtracting: ${stars} - ${circles} = ${correct}.`,
          strategyTags: ["compare both sides", "subtract to find how many more"],
          trapWarning: "More than means subtract, not add."
        };
      }
    },
    {
      familyId: "equal_pairs_weights",
      generate: (_ctx, rng) => {
        const start = rng.int(4, 8);
        const weights = [start, start + 1, start + 2, start + 3, start + 4];
        const correct = start + 2;
        return {
          prompt: `Five toys weigh ${weights.join(" g, ")} g. Two different pairs have the same total weight. Which weight is left over?`,
          correct: `${correct} g`,
          distractors: textDistractors(`${correct} g`, weights.map((weight) => `${weight} g`)),
          explanation: `${weights[0]} + ${weights[4]} = ${weights[1]} + ${weights[3]}, so the middle weight ${correct} g is left over.`,
          strategyTags: ["look for equal pair sums", "test the smallest with the largest"],
          trapWarning: "You need two equal pairs, not just one pair that looks close."
        };
      }
    }
  ]
};

export function familyIdsForSkill(skillId: SkillId): string[] {
  return FAMILY_LIBRARY[skillId].map((family) => family.familyId);
}

export function createTemplate(
  grade: 1 | 2,
  skillId: SkillId,
  familyId: string,
  pointTier: PointTier,
  ordinal: number
): QuestionTemplate {
  const family = FAMILY_LIBRARY[skillId].find((entry) => entry.familyId === familyId);
  if (!family) throw new Error(`Unknown family ${familyId} for skill ${skillId}`);

  const id = `g${grade}_${skillId}_${familyId}_${String(ordinal).padStart(3, "0")}`;

  return {
    id,
    grade,
    skillId,
    familyId,
    pointTier,
    format: family.format || "text",
    generate: (ctx) => {
      const rng = new SeededRng(ctx.variantSeed + grade * 1009 + pointTier * 97 + ordinal * 13);
      const draft = family.generate(ctx, rng);
      return toQuestion(ctx, skillId, familyId, draft);
    }
  };
}
