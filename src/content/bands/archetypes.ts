import type { BandCoverageMap, BandFamilyLibrary, BandFamilySpec, CoverageRow } from "./common";
import { numericDistractors, textDistractors, fractionText, simplifyFraction, formatDecimal, gcd, lcm } from "./common";
import type { GenerationContext } from "../../domain/types";
import { SeededRng } from "../g1g2/helpers";
import {
  angleVisual,
  balanceVisual,
  coordinateVisual,
  formulaVisual,
  fractionBarVisual,
  lessonCard,
  netVisual
} from "./visuals";

const ARCHETYPE_BY_SKILL: Record<string, string> = {
  multi_digit_add_sub: "arithmetic",
  multiplication_division: "multiplicative",
  place_value_rounding: "place_value",
  fractions_parts: "fractions_basic",
  measurement_time_money: "measurement",
  perimeter_area_intro: "geometry_basic",
  shapes_angles: "geometry_basic",
  patterns_equations: "algebra_intro",
  data_graphs: "data_logic",
  logic_elimination: "logic",
  coordinates_paths: "coordinates_basic",
  solids_nets: "spatial",

  factors_multiples_primes: "number_theory",
  fractions_operations: "fractions_advanced",
  decimals_percents: "decimal_percent",
  ratio_rate: "ratio_rate",
  expressions_equations: "algebra_linear",
  area_volume: "geometry_measurement",
  angles_geometry: "geometry_measurement",
  divisibility_remainders: "number_theory",
  coordinates_graphs: "graphs",
  probability_counting: "counting_probability",
  sequences_patterns: "functions_sequences",
  logic_sets: "logic",

  integers_rationals: "integers_rationals",
  linear_equations: "algebra_linear",
  ratios_proportions: "ratio_rate",
  percent_change: "decimal_percent",
  geometry_angles_triangles: "geometry_angles",
  area_volume_scale: "geometry_measurement",
  coordinate_geometry: "graphs",
  combinatorics_counting: "counting_probability",
  probability_expected: "counting_probability",
  sequences_functions: "functions_sequences",
  algebraic_manipulation: "algebra_linear",
  logical_reasoning: "logic",

  linear_systems: "systems",
  quadratic_patterns: "quadratic",
  exponents_surds: "exponents_surds",
  inequalities_absolute: "inequalities",
  geometry_similarity: "geometry_angles",
  circles_coordinate: "analytic_geometry",
  counting_probability: "counting_probability",
  functions_graphs: "graphs",
  sequences_series: "functions_sequences",
  number_theory_modular: "number_theory",
  algebra_word_models: "systems",
  optimization_logic: "logic",

  advanced_algebra: "advanced_algebra",
  functions_transformations: "functions_advanced",
  polynomial_roots: "polynomial",
  trig_geometry: "trig_geometry",
  analytic_geometry: "analytic_geometry",
  combinatorics_probability: "counting_probability",
  sequences_series_upper: "functions_sequences",
  inequalities_systems_upper: "inequalities",
  logarithms_exponents: "exponents_surds",
  modular_number_theory: "number_theory",
  proof_logic_invariants: "logic",
  optimization_modeling: "logic"
};

function family(id: string, generate: BandFamilySpec["generate"], format: BandFamilySpec["format"] = "text"): BandFamilySpec {
  return { familyId: id, format, generate };
}

function easyRange(ctx: GenerationContext, rng: SeededRng, a = 10, b = 90): number {
  const widen = ctx.grade * 3 + ctx.pointTier * 5;
  return rng.int(a, b + widen);
}

function arithmeticFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("story_sum", (ctx, rng) => {
      const a = easyRange(ctx, rng, 18, 120);
      const b = easyRange(ctx, rng, 12, 95);
      const correct = a + b;
      return {
        prompt: `A class solved ${a} warm-ups in the morning and ${b} after lunch. How many warm-ups did they solve in all?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [10, -10, 1, -1], 0),
        explanation: `Add the two parts: ${a} + ${b} = ${correct}.`,
        strategyTags: ["part-part-whole", "write one equation"],
        trapWarning: "Do not subtract when the story asks for the total."
      };
    }),
    family("difference_story", (ctx, rng) => {
      const a = easyRange(ctx, rng, 50, 180);
      const b = rng.int(12, Math.max(20, Math.floor(a * 0.7)));
      const correct = a - b;
      return {
        prompt: `A library had ${a} bookmarks. ${b} were given away. How many bookmarks stayed in the library?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [b, -b, 5, -5], 0),
        explanation: `Start with ${a} and subtract ${b}: ${a} - ${b} = ${correct}.`,
        strategyTags: ["start-change-end", "subtract the change"],
        trapWarning: "Keep the starting amount and the amount removed in the right order."
      };
    }),
    family("missing_addend", (ctx, rng) => {
      const part = easyRange(ctx, rng, 20, 140);
      const total = part + rng.int(15, 90);
      const correct = total - part;
      return {
        prompt: `Fill the box: ${part} + □ = ${total}`,
        correct: String(correct),
        distractors: numericDistractors(correct, [part % 10 || 3, -(part % 10 || 3), 7, -7], 0),
        explanation: `Missing part = whole - known part = ${total} - ${part} = ${correct}.`,
        strategyTags: ["subtract to find the missing part", "check with addition"],
        trapWarning: "The box is not the total; it is the missing part."
      };
    }),
    family("operation_table", (ctx, rng) => {
      const start = easyRange(ctx, rng, 30, 110);
      const plus = rng.int(8, 26);
      const minus = rng.int(4, 18);
      const correct = start + plus - minus;
      return {
        prompt: `Start with ${start}. Add ${plus}, then subtract ${minus}. What number do you get?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [plus, -minus, plus - minus + 6, -(plus - minus)], 0),
        explanation: `${start} + ${plus} = ${start + plus}, then ${start + plus} - ${minus} = ${correct}.`,
        strategyTags: ["follow the order", "keep a running total"],
        trapWarning: "Do the operations in the given order."
      };
    })
  ];
}

function multiplicativeFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("equal_groups", (ctx, rng) => {
      const groups = rng.int(3, ctx.grade + 4);
      const each = rng.int(4, ctx.grade + 7);
      const correct = groups * each;
      return {
        prompt: `${groups} trays each hold ${each} muffins. How many muffins are there altogether?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [groups, -groups, each, -each], 0),
        explanation: `${groups} equal groups of ${each} means ${groups} × ${each} = ${correct}.`,
        strategyTags: ["equal groups", "multiply instead of add one by one"],
        trapWarning: "Equal groups means repeated multiplication, not mixing numbers randomly."
      };
    }),
    family("missing_factor", (ctx, rng) => {
      const a = rng.int(3, ctx.grade + 5);
      const b = rng.int(4, ctx.grade + 6);
      const product = a * b;
      return {
        prompt: `Fill the box: ${a} × □ = ${product}`,
        correct: String(b),
        distractors: numericDistractors(b, [1, -1, a - b, 2], 1),
        explanation: `Use the inverse fact: ${product} ÷ ${a} = ${b}.`,
        strategyTags: ["use the inverse operation", "match a fact family"],
        trapWarning: "Divide the product by the known factor."
      };
    }),
    family("division_share", (ctx, rng) => {
      const each = rng.int(3, ctx.grade + 5);
      const groups = rng.int(3, ctx.grade + 4);
      const total = each * groups;
      return {
        prompt: `${total} stickers are shared equally among ${groups} children. How many stickers does each child get?`,
        correct: String(each),
        distractors: numericDistractors(each, [groups, -1, 2, -2], 1),
        explanation: `Equal sharing means divide: ${total} ÷ ${groups} = ${each}.`,
        strategyTags: ["share equally", "divide to find one group"],
        trapWarning: "Equal sharing asks for division, not subtraction."
      };
    }),
    family("remainder_reasoning", (ctx, rng) => {
      const groups = rng.int(3, ctx.grade + 4);
      const each = rng.int(4, ctx.grade + 6);
      const extra = rng.int(1, groups - 1);
      const total = groups * each + extra;
      return {
        prompt: `${total} marbles are packed into bags of ${groups}. How many full bags can be made?`,
        correct: String(each),
        distractors: numericDistractors(each, [extra, -1, 1, groups], 0),
        explanation: `${total} = ${groups} × ${each} + ${extra}, so there are ${each} full bags.`,
        strategyTags: ["divide and interpret remainder", "full groups only"],
        trapWarning: "The remainder does not make another full group."
      };
    })
  ];
}

function placeValueFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("digit_value", (ctx, rng) => {
      const hundreds = rng.int(1, 8);
      const tens = rng.int(0, 9);
      const ones = rng.int(0, 9);
      const number = hundreds * 100 + tens * 10 + ones;
      const pick = rng.pick([
        { digit: hundreds, place: "hundreds", value: hundreds * 100 },
        { digit: tens, place: "tens", value: tens * 10 },
        { digit: ones, place: "ones", value: ones }
      ]);
      return {
        prompt: `In ${number}, what is the value of the digit in the ${pick.place} place?`,
        correct: String(pick.value),
        distractors: numericDistractors(pick.value, [pick.digit, -pick.digit, 10, -10], 0),
        explanation: `The ${pick.place} digit is worth ${pick.value}.`,
        strategyTags: ["name the place", "value is digit times place"],
        trapWarning: "Digit and value are not the same thing."
      };
    }),
    family("round_nearest", (ctx, rng) => {
      const base = easyRange(ctx, rng, 120, 980);
      const number = base + rng.int(1, 49);
      const place = rng.pick([
        { value: 10, label: "nearest ten" },
        { value: 100, label: "nearest hundred" }
      ]);
      const correct = Math.round(number / place.value) * place.value;
      return {
        prompt: `Round ${number} to the ${place.label}.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [place.value, -place.value, place.value * 2, -(place.value * 2)], 0),
        explanation: `Use the next digit to round ${number} to ${correct}.`,
        strategyTags: ["look one place right", "5 or more rounds up"],
        trapWarning: "Round based on the next place value digit only."
      };
    }),
    family("compose_number", (ctx, rng) => {
      const hundreds = rng.int(1, 9);
      const tens = rng.int(0, 8);
      const ones = rng.int(0, 9);
      const correct = hundreds * 100 + tens * 10 + ones;
      return {
        prompt: `What number has ${hundreds} hundreds, ${tens} tens, and ${ones} ones?`,
        correct: String(correct),
        distractors: textDistractors(String(correct), [String(hundreds * 100 + ones * 10 + tens), String(hundreds * 10 + tens * 100 + ones), String(hundreds * 100 + tens + ones * 10), String(hundreds * 10 + tens + ones)]),
        explanation: `${hundreds} hundreds = ${hundreds * 100}, ${tens} tens = ${tens * 10}, plus ${ones}.`,
        strategyTags: ["build from place values", "write hundreds tens ones"],
        trapWarning: "Keep the hundreds, tens, and ones in the correct places."
      };
    }),
    family("compare_numbers", (ctx, rng) => {
      const a = easyRange(ctx, rng, 120, 980);
      const b = easyRange(ctx, rng, 120, 980);
      const correct = a > b ? String(a) : String(b);
      return {
        prompt: `Which number is greater: ${a} or ${b}?`,
        correct,
        distractors: textDistractors(correct, [String(a < b ? a : b), "they are equal", `${Math.abs(a - b)}`, `${Math.min(a, b) + 10}`]),
        explanation: `Compare the highest place first. The greater number is ${correct}.`,
        strategyTags: ["compare left to right", "check the highest place first"],
        trapWarning: "Do not compare only the last digit."
      };
    })
  ];
}

function fractionsBasicFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("fraction_of_quantity", (ctx, rng) => {
      const denominator = rng.pick([2, 3, 4, 5]);
      const numerator = rng.int(1, denominator - 1);
      const group = rng.int(2, 6);
      const total = denominator * group;
      const correct = (total / denominator) * numerator;
      return {
        prompt: `What is ${fractionText(numerator, denominator)} of ${total}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [group, -group, numerator, -1], 0),
        explanation: `One part is ${total} ÷ ${denominator} = ${total / denominator}, so ${numerator} parts make ${correct}.`,
        strategyTags: ["find one equal part first", "scale by the numerator"],
        trapWarning: "Divide by the denominator before multiplying by the numerator."
      };
    }),
    family("whole_from_fraction", (ctx, rng) => {
      const denominator = rng.pick([2, 3, 4, 5]);
      const numerator = rng.int(1, denominator - 1);
      const part = rng.int(2, 10);
      const shown = numerator * part;
      const correct = denominator * part;
      return {
        prompt: `${shown} is ${fractionText(numerator, denominator)} of a ribbon. How long is the whole ribbon?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [shown, -part, part, denominator], 1),
        explanation: `If ${numerator} parts are ${shown}, then one part is ${part}. The whole is ${denominator} parts, so ${correct}.`,
        strategyTags: ["scale up from the known fraction", "find one part"],
        trapWarning: "The given amount is only part of the whole."
      };
    }),
    family("compare_same_denominator", (ctx, rng) => {
      const denominator = rng.pick([4, 6, 8]);
      const a = rng.int(1, denominator - 1);
      let b = rng.int(1, denominator - 1);
      while (b === a) b = rng.int(1, denominator - 1);
      const correct = a > b ? fractionText(a, denominator) : fractionText(b, denominator);
      return {
        prompt: `Which fraction is greater: ${fractionText(a, denominator)} or ${fractionText(b, denominator)}?`,
        correct,
        distractors: textDistractors(correct, [fractionText(Math.min(a, b), denominator), "they are equal", fractionText(denominator - 1, denominator), fractionText(1, denominator)]),
        explanation: `With the same denominator, the fraction with more selected parts is greater.`,
        strategyTags: ["same denominator means compare numerators", "draw equal parts mentally"],
        trapWarning: "Do not change the denominator when the parts are already equal-sized."
      };
    }),
    family("visual_share", (ctx, rng) => {
      const parts = rng.pick([3, 4, 5, 6]);
      const shaded = rng.int(1, parts - 1);
      const correct = fractionText(shaded, parts);
      return {
        prompt: `What fraction of the strip is shaded?`,
        correct,
        distractors: textDistractors(correct, [fractionText(parts - shaded, parts), fractionText(shaded, Math.max(2, parts - 1)), fractionText(1, parts), fractionText(parts, shaded || 1)]),
        explanation: `${shaded} of the ${parts} equal parts are shaded, so the fraction is ${correct}.`,
        strategyTags: ["count shaded parts", "count total equal parts"],
        trapWarning: "The denominator is the total number of equal parts."
        ,format: "svg",
        visualAssetSpec: fractionBarVisual(parts, shaded, "equal parts")
      };
    }, "svg")
  ];
}

function measurementFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("elapsed_time", (ctx, rng) => {
      const hour = rng.int(1, 10);
      const startMinutes = rng.pick([0, 15, 30, 45]);
      const jump = rng.pick([15, 30, 45, 60, 75, 90]);
      const totalMinutes = hour * 60 + startMinutes + jump;
      const endHour = ((Math.floor(totalMinutes / 60) - 1) % 12) + 1;
      const endMinutes = totalMinutes % 60;
      const correct = `${endHour}:${String(endMinutes).padStart(2, "0")}`;
      return {
        prompt: `A lesson starts at ${hour}:${String(startMinutes).padStart(2, "0")}. It lasts ${jump} minutes. What time does it end?`,
        correct,
        distractors: textDistractors(correct, [`${hour}:${String((startMinutes + jump) % 60).padStart(2, "0")}`, `${((hour + 1 - 1) % 12) + 1}:${String(startMinutes).padStart(2, "0")}`, `${endHour}:${String((endMinutes + 15) % 60).padStart(2, "0")}`, `${endHour}:${String((endMinutes + 30) % 60).padStart(2, "0")}`]),
        explanation: `Add ${jump} minutes to the start time to get ${correct}.`,
        strategyTags: ["convert to minutes when needed", "keep track of the hour change"],
        trapWarning: "Watch when the minutes pass 60 and the hour increases."
      };
    }),
    family("money_total", (ctx, rng) => {
      const quarters = rng.int(0, 3);
      const dimes = rng.int(0, 4);
      const nickels = rng.int(0, 4);
      const ones = rng.int(0, 4);
      const correct = quarters * 25 + dimes * 10 + nickels * 5 + ones;
      return {
        prompt: `How many cents are in ${quarters} quarters, ${dimes} dimes, ${nickels} nickels, and ${ones} pennies?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [5, -5, 10, -10], 0),
        explanation: `Convert each coin to cents and add the totals.`,
        strategyTags: ["convert each coin first", "group into tens and quarters"],
        trapWarning: "Quarter = 25, dime = 10, nickel = 5, penny = 1."
      };
    }),
    family("unit_conversion", (ctx, rng) => {
      const unit = rng.pick([
        { big: "m", small: "cm", factor: 100 },
        { big: "kg", small: "g", factor: 1000 },
        { big: "L", small: "mL", factor: 1000 }
      ]);
      const amount = rng.int(2, 9);
      const correct = amount * unit.factor;
      return {
        prompt: `How many ${unit.small} are in ${amount} ${unit.big}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [unit.factor, -unit.factor, amount, -amount], 0),
        explanation: `Multiply by the conversion factor: ${amount} ${unit.big} = ${correct} ${unit.small}.`,
        strategyTags: ["convert to one unit first", "multiply by the unit factor"],
        trapWarning: "Do not compare different units without converting."
      };
    }),
    family("line_plot_compare", (ctx, rng) => {
      const a = rng.int(12, 45);
      const b = a + rng.int(4, 15);
      const correct = b - a;
      return {
        prompt: `A rope is ${a} cm long and another rope is ${b} cm long. How much longer is the second rope?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, 2, -2], 0),
        explanation: `Longer by means subtract: ${b} - ${a} = ${correct}.`,
        strategyTags: ["difference means subtract", "compare in the same unit"],
        trapWarning: "How much longer asks for the difference, not the total."
      };
    })
  ];
}

function geometryBasicFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("rectangle_perimeter", (ctx, rng) => {
      const width = rng.int(3, 9 + ctx.grade);
      const height = rng.int(2, 8 + ctx.grade);
      const correct = 2 * (width + height);
      return {
        prompt: `A rectangle has length ${width} cm and width ${height} cm. What is its perimeter?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [width * height - correct, width + height, -2, 2], 0),
        explanation: `Perimeter of a rectangle is 2(length + width) = ${correct}.`,
        strategyTags: ["trace the outside", "double the two side lengths"],
        trapWarning: "Perimeter adds outside edges; area does not."
      };
    }),
    family("unit_square_area", (ctx, rng) => {
      const rows = rng.int(2, 5);
      const cols = rng.int(3, 6 + Math.max(0, ctx.grade - 3));
      const correct = rows * cols;
      return {
        prompt: `A rectangle is made from ${rows} rows of ${cols} unit squares. What is its area?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [rows + cols - correct, rows, cols, -2], 0),
        explanation: `Area in unit squares is rows × columns = ${correct}.`,
        strategyTags: ["count rows and columns", "area means cover the inside"],
        trapWarning: "Area counts square units, not side lengths."
      };
    }),
    family("angle_turn", (ctx, rng) => {
      const correct = rng.pick([90, 180, 270]);
      return {
        prompt: `A robot turns a quarter-turn, then another quarter-turn. How many degrees has it turned in all?`,
        correct: "180",
        distractors: ["90", "270", "360", "45"],
        explanation: `A quarter-turn is 90°, so two quarter-turns make 180°.`,
        strategyTags: ["know quarter-turn and half-turn", "add angle turns"],
        trapWarning: "A quarter-turn is 90°, not 25° or 45°."
      };
    }),
    family("shape_property", (ctx, rng) => {
      const correct = rng.pick([
        "triangle",
        "quadrilateral",
        "pentagon",
        "hexagon"
      ]);
      const sideCount: Record<string, number> = {
        triangle: 3,
        quadrilateral: 4,
        pentagon: 5,
        hexagon: 6
      };
      return {
        prompt: `Which shape has ${sideCount[correct]} sides?`,
        correct,
        distractors: textDistractors(correct, ["circle", "octagon", "rectangle", "rhombus"]),
        explanation: `${correct} is the shape with ${sideCount[correct]} sides.`,
        strategyTags: ["match the side count", "ignore extra words"],
        trapWarning: "Name the shape by the number of sides, not by how it looks at first glance."
      };
    })
  ];
}

function algebraIntroFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("function_machine", (ctx, rng) => {
      const add = rng.int(2, 9);
      const input = rng.int(4, 18);
      const correct = input + add;
      return {
        prompt: `A machine adds ${add}. What comes out when ${input} goes in?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [add, -add, 1, -1], 0),
        explanation: `Add ${add} to the input: ${input} + ${add} = ${correct}.`,
        strategyTags: ["follow one rule", "apply the machine exactly once"],
        trapWarning: "Do not invent a second step when the machine gives only one rule."
      };
    }),
    family("growing_pattern", (ctx, rng) => {
      const start = rng.int(2, 12);
      const step = rng.int(2, 6);
      const correct = start + step * 3;
      return {
        prompt: `Find the next number: ${start}, ${start + step}, ${start + step * 2}, ${correct}, ?`,
        correct: String(correct + step),
        distractors: numericDistractors(correct + step, [step, -step, step * 2, -1], 0),
        explanation: `The pattern adds ${step} each time, so the next term is ${correct + step}.`,
        strategyTags: ["look at the step size", "keep one rule the whole way"],
        trapWarning: "Check two jumps before deciding the rule."
      };
    }),
    family("balance_box", (ctx, rng) => {
      const box = rng.int(3, 16);
      const extra = rng.int(2, 9);
      const total = box + extra;
      return {
        prompt: `Solve the box: □ + ${extra} = ${total}`,
        correct: String(box),
        distractors: numericDistractors(box, [extra, -extra, 1, -1], 0),
        explanation: `Undo the +${extra}: ${total} - ${extra} = ${box}.`,
        strategyTags: ["undo the outside operation", "use the inverse"],
        trapWarning: "Subtract the known addend from the total."
      };
    }),
    family("table_rule", (ctx, rng) => {
      const step = rng.int(2, 5);
      const start = rng.int(1, 6);
      const input = rng.int(4, 8);
      const correct = start + step * input;
      return {
        prompt: `A pattern follows output = ${step} × n + ${start}. What is the output when n = ${input}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [step, -step, start, -start], 0),
        explanation: `Substitute n = ${input}: ${step} × ${input} + ${start} = ${correct}.`,
        strategyTags: ["substitute carefully", "multiply then add"],
        trapWarning: "Do multiplication before adding the starting amount."
      };
    })
  ];
}

function dataLogicFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("bar_graph_total", (ctx, rng) => {
      const values = [rng.int(3, 8), rng.int(4, 9), rng.int(2, 7)];
      const correct = values[0] + values[1] + values[2];
      return {
        prompt: `A chart shows 3 rows with counts ${values.join(", ")}. What is the total?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [values[0], -values[0], 2, -2], 0),
        explanation: `Add the counts from all rows to get ${correct}.`,
        strategyTags: ["read every row once", "total means add"],
        trapWarning: "Do not stop at the largest row when the question asks for the total."
      };
    }),
    family("pictograph_legend", (ctx, rng) => {
      const icons = rng.int(3, 6);
      const legend = rng.pick([2, 3, 4]);
      const correct = icons * legend;
      return {
        prompt: `In a pictograph, each star stands for ${legend}. One row has ${icons} stars. What does the row show in all?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [legend, -legend, icons, -1], 0),
        explanation: `Multiply icons by the legend value: ${icons} × ${legend} = ${correct}.`,
        strategyTags: ["read the legend first", "multiply number of icons"],
        trapWarning: "Each picture may stand for more than 1."
      };
    }),
    family("best_choice", (ctx, rng) => {
      const correct = rng.pick(["always", "sometimes", "never"]);
      const statement = correct === "always" ? "A square has 4 sides" : correct === "sometimes" ? "A rectangle is a square" : "A triangle has 4 sides";
      return {
        prompt: `Choose the best word: ${statement}.`,
        correct,
        distractors: textDistractors(correct, ["certain", "likely", "maybe", "impossible"]),
        explanation: `Read the statement carefully and decide whether it happens always, sometimes, or never.`,
        strategyTags: ["test the statement", "pick the strongest true word"],
        trapWarning: "Sometimes is different from always."
      };
    }),
    family("table_compare", (ctx, rng) => {
      const a = rng.int(10, 28);
      const b = a + rng.int(3, 12);
      return {
        prompt: `Row A shows ${a} and Row B shows ${b}. How many more does Row B show?`,
        correct: String(b - a),
        distractors: numericDistractors(b - a, [a, -1, 1, 2], 0),
        explanation: `Compare with subtraction: ${b} - ${a} = ${b - a}.`,
        strategyTags: ["difference means subtract", "compare the two rows"],
        trapWarning: "Read the row labels before subtracting."
      };
    })
  ];
}

function logicFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("elimination_clues", (ctx, rng) => {
      const correct = rng.pick(["red", "blue", "green", "yellow"]);
      return {
        prompt: `A box is not red, not green, and not yellow. What color must it be?`,
        correct: "blue",
        distractors: textDistractors("blue", ["red", "green", "yellow", "cannot tell"]),
        explanation: `If three colors are ruled out, the only color left is blue.`,
        strategyTags: ["cross out impossible choices", "keep the last option standing"],
        trapWarning: "A no-clue removes choices; it does not describe the answer."
      };
    }),
    family("ordering_logic", (ctx, rng) => {
      const names = ["Ava", "Ben", "Cora", "Drew"];
      return {
        prompt: `Ava is before Ben. Ben is before Cora. Who cannot be first?`,
        correct: "Cora",
        distractors: textDistractors("Cora", ["Ava", "Ben", "Drew", "Any of them"]),
        explanation: `Since Ava and Ben both come before Cora, Cora cannot be first.`,
        strategyTags: ["chain the clues", "lock in relative order"],
        trapWarning: "Use all clues together, not one at a time."
      };
    }),
    family("parity_move", (ctx, rng) => {
      const moves = rng.int(3, 9);
      const start = rng.pick(["even", "odd"]);
      const correct = moves % 2 === 0 ? start : start === "even" ? "odd" : "even";
      return {
        prompt: `A token starts on an ${start} number. It moves +1 exactly ${moves} times. Does it end on an even or odd number?`,
        correct,
        distractors: textDistractors(correct, [start, "prime", "zero", "cannot tell"]),
        explanation: `Each +1 flips parity. After ${moves} moves, it ends on ${correct}.`,
        strategyTags: ["track even-odd flips", "ignore exact size when parity is enough"],
        trapWarning: "When only parity matters, do not overcompute the exact number."
      };
    }),
    family("set_reasoning", (ctx, rng) => {
      const total = rng.int(12, 24);
      const circle = rng.int(4, 8);
      const both = rng.int(1, Math.min(4, circle - 1));
      const squareOnly = rng.int(3, 7);
      const correct = total - (circle + squareOnly);
      return {
        prompt: `There are ${total} objects. ${circle - both} are only in Circle, ${both} are in both, and ${squareOnly} are only in Square. How many are outside both sets?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [both, -both, 2, -2], 0),
        explanation: `Inside the sets there are ${(circle - both) + both + squareOnly}. Subtract from ${total} to get ${correct}.`,
        strategyTags: ["add inside first", "subtract from the total"],
        trapWarning: "Do not double-count the overlap."
      };
    }),
    family("extreme_choice", (ctx, rng) => {
      const correct = "Try the shortest valid path first";
      return {
        prompt: `What is usually the smartest first move on a small contest puzzle?`,
        correct,
        distractors: textDistractors(correct, ["Compute every possibility from the start", "Choose the longest route first", "Ignore the clues and guess", "Use the biggest number immediately"]),
        explanation: `A fast contest habit is to use structure, elimination, and the shortest valid path first.`,
        strategyTags: ["test an efficient case first", "eliminate before brute force"],
        trapWarning: "Contest logic rewards structure before long computation."
      };
    })
  ];
}

function coordinatesBasicFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("grid_point", (ctx, rng) => {
      const x = rng.int(1, 6);
      const y = rng.int(1, 5);
      const correct = `(${x}, ${y})`;
      return {
        prompt: `Which coordinate names the highlighted point?`,
        correct,
        distractors: textDistractors(correct, [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${x}, ${y + 1})`, `(${x - 1}, ${y})`]),
        explanation: `Read across for x and up for y, so the point is ${correct}.`,
        strategyTags: ["read x first", "then read y"],
        trapWarning: "Coordinates are ordered pairs; swapping x and y changes the point.",
        format: "svg",
        visualAssetSpec: coordinateVisual([{ x, y, label: "P" }], 0)
      };
    }, "svg"),
    family("path_end", (ctx, rng) => {
      const startX = rng.int(1, 4);
      const startY = rng.int(1, 4);
      const right = rng.int(1, 3);
      const up = rng.int(1, 3);
      const correct = `(${startX + right}, ${startY + up})`;
      return {
        prompt: `A robot starts at (${startX}, ${startY}), moves ${right} right and ${up} up. Where does it end?`,
        correct,
        distractors: textDistractors(correct, [`(${startX + right}, ${startY - up})`, `(${startX - right}, ${startY + up})`, `(${startX + up}, ${startY + right})`, `(${startX}, ${startY})`]),
        explanation: `Moving right changes x and moving up changes y, so the end point is ${correct}.`,
        strategyTags: ["update x for left-right", "update y for up-down"],
        trapWarning: "Only x changes horizontally and only y changes vertically."
      };
    }),
    family("manhattan_distance", (ctx, rng) => {
      const a = { x: rng.int(0, 3), y: rng.int(0, 3) };
      const b = { x: a.x + rng.int(2, 5), y: a.y + rng.int(1, 4) };
      const correct = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      return {
        prompt: `On grid streets, how many blocks from (${a.x}, ${a.y}) to (${b.x}, ${b.y}) if you only move across and up/down?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, Math.abs(b.x - a.x) - correct, Math.abs(b.y - a.y)], 0),
        explanation: `Count horizontal blocks and vertical blocks, then add them.`,
        strategyTags: ["count horizontal then vertical", "use grid distance"],
        trapWarning: "Grid distance is not diagonal distance."
      };
    }),
    family("shortest_path_count", (ctx, rng) => {
      const right = rng.int(2, 4);
      const up = rng.int(2, 3);
      const correct = right + up;
      return {
        prompt: `A shortest path needs ${right} steps right and ${up} steps up. How many steps are in any shortest path?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, right * up - correct, right], 0),
        explanation: `Every shortest path uses exactly ${right} right steps and ${up} up steps, so ${correct} steps in all.`,
        strategyTags: ["count required moves", "shortest path uses no extra steps"],
        trapWarning: "Shortest means use each needed move once, with no detours."
      };
    })
  ];
}

function spatialFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("cube_faces", (ctx, rng) => {
      return {
        prompt: `A cube has 6 faces. If 3 faces can be seen in one view, how many faces are hidden?`,
        correct: "3",
        distractors: ["2", "4", "5", "6"],
        explanation: `Cube faces total 6. If 3 are visible, 3 are hidden.`,
        strategyTags: ["whole minus visible", "remember cube facts"],
        trapWarning: "A cube always has 6 faces in total."
      };
    }),
    family("net_square_count", (ctx, rng) => {
      const correct = 6;
      return {
        prompt: `How many equal squares are needed to make a cube net?`,
        correct: String(correct),
        distractors: ["4", "5", "7", "8"],
        explanation: `A cube has 6 faces, so a net needs 6 equal squares.`,
        strategyTags: ["match net squares to faces", "remember the solid"],
        trapWarning: "One square is needed for each face of the cube."
      };
    }),
    family("hidden_cubes", (ctx, rng) => {
      const front = rng.int(2, 4);
      const depth = rng.int(2, 3);
      const height = rng.int(2, 3);
      const total = front * depth * height;
      const visible = front * height + depth * height - height;
      const correct = Math.max(0, total - visible);
      return {
        prompt: `A block is built from ${front} by ${depth} by ${height} small cubes. If ${visible} cubes are visible from one corner view, how many are hidden?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, height, -height], 0),
        explanation: `Hidden cubes = total cubes - visible cubes = ${total} - ${visible} = ${correct}.`,
        strategyTags: ["find the total first", "subtract the visible cubes"],
        trapWarning: "Do not confuse visible faces with visible cubes."
      };
    }),
    family("folded_net", (ctx, rng) => {
      return {
        prompt: `Which statement is true for every cube net?`,
        correct: "It uses 6 equal squares.",
        distractors: textDistractors("It uses 6 equal squares.", ["It uses 5 equal squares.", "It must be a rectangle.", "It shows all 8 vertices as squares.", "It has no shared edges."]),
        explanation: `Every cube net is made of the 6 square faces of the cube.`,
        strategyTags: ["use cube facts", "focus on what must stay true"],
        trapWarning: "Different-looking nets can fold to the same cube."
      };
    })
  ];
}

function numberTheoryFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("gcd_pair", (ctx, rng) => {
      const a = rng.int(12, 60);
      const b = rng.int(18, 72);
      const correct = gcd(a, b);
      return {
        prompt: `What is the greatest common factor of ${a} and ${b}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, Math.max(2, Math.floor(correct / 2)), a % 10 || 2], 1),
        explanation: `List the common factors and choose the greatest one: ${correct}.`,
        strategyTags: ["factor both numbers", "choose the greatest common factor"],
        trapWarning: "GCF means common factor, not common multiple."
      };
    }),
    family("lcm_pair", (ctx, rng) => {
      const a = rng.int(4, 12);
      const b = rng.int(5, 14);
      const correct = lcm(a, b);
      return {
        prompt: `What is the least common multiple of ${a} and ${b}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, b, -b], 1),
        explanation: `Find the first number both lists reach. That least common multiple is ${correct}.`,
        strategyTags: ["skip-count both lists", "look for the first shared multiple"],
        trapWarning: "LCM is the smallest shared multiple, not the largest factor."
      };
    }),
    family("prime_test", (ctx, rng) => {
      const primes = [11, 13, 17, 19, 23, 29, 31, 37];
      const composites = [12, 14, 15, 21, 25, 27, 33, 35];
      const correct = rng.pick(primes);
      const distractors = composites.slice(0, 4).map(String);
      return {
        prompt: `Which number is prime?`,
        correct: String(correct),
        distractors: textDistractors(String(correct), distractors),
        explanation: `${correct} has exactly two factors: 1 and itself.`,
        strategyTags: ["test small divisors", "a prime has exactly two factors"],
        trapWarning: "Even numbers greater than 2 are not prime."
      };
    }),
    family("remainder_pack", (ctx, rng) => {
      const divisor = rng.int(3, 9);
      const quotient = rng.int(4, 12);
      const remainder = rng.int(1, divisor - 1);
      const total = divisor * quotient + remainder;
      return {
        prompt: `When ${total} is divided by ${divisor}, what is the remainder?`,
        correct: String(remainder),
        distractors: numericDistractors(remainder, [1, -1, divisor - remainder, quotient - remainder], 0),
        explanation: `${total} = ${divisor} × ${quotient} + ${remainder}, so the remainder is ${remainder}.`,
        strategyTags: ["write quotient times divisor plus remainder", "remainder is smaller than the divisor"],
        trapWarning: "A remainder can never be as large as the divisor."
      };
    }),
    family("mod_pattern", (ctx, rng) => {
      const divisor = rng.pick([3, 4, 5, 6, 7]);
      const residue = rng.int(0, divisor - 1);
      const next = residue + divisor;
      return {
        prompt: `A number leaves remainder ${residue} when divided by ${divisor}. Which number could it be?`,
        correct: String(next),
        distractors: textDistractors(String(next), [String(divisor), String(residue), String(next + 1), String(next - 1)]),
        explanation: `Numbers with remainder ${residue} have the form ${divisor}k + ${residue}.`,
        strategyTags: ["write a number as divisor times quotient plus remainder", "look for the matching residue"],
        trapWarning: "Only numbers with the same residue in the same modulus fit the pattern."
      };
    })
  ];
}

function fractionsAdvancedFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("add_like_denominator", (ctx, rng) => {
      const denominator = rng.pick([6, 8, 10, 12]);
      const a = rng.int(1, denominator / 2);
      const b = rng.int(1, denominator / 2);
      const [n, d] = simplifyFraction(a + b, denominator);
      const correct = fractionText(n, d);
      return {
        prompt: `Compute ${fractionText(a, denominator)} + ${fractionText(b, denominator)}.`,
        correct,
        distractors: textDistractors(correct, [fractionText(a + b, denominator), fractionText(a + b, denominator * 2), fractionText(Math.abs(a - b), denominator), fractionText(a * b, denominator)]),
        explanation: `Add the numerators because the denominators already match, then simplify if possible.`,
        strategyTags: ["keep the denominator", "simplify at the end"],
        trapWarning: "Do not add the denominators when the parts are the same size."
      };
    }),
    family("fraction_compare", (ctx, rng) => {
      const pair = rng.pick([
        [1, 2, 2, 3],
        [3, 4, 5, 6],
        [2, 5, 1, 2],
        [5, 8, 2, 3]
      ]);
      const [a, b, c, d] = pair;
      const correct = a / b > c / d ? fractionText(a, b) : fractionText(c, d);
      return {
        prompt: `Which fraction is greater: ${fractionText(a, b)} or ${fractionText(c, d)}?`,
        correct,
        distractors: textDistractors(correct, [correct === fractionText(a, b) ? fractionText(c, d) : fractionText(a, b), fractionText(a + c, b + d), "they are equal", fractionText(1, 1)]),
        explanation: `Use a benchmark like 1/2 or compare by making common denominators.`,
        strategyTags: ["use a benchmark", "compare equivalent fractions"],
        trapWarning: "A bigger denominator does not always mean a bigger fraction."
      };
    }),
    family("fraction_of_set", (ctx, rng) => {
      const denominator = rng.pick([3, 4, 5, 6]);
      const numerator = rng.int(1, denominator - 1);
      const base = rng.int(2, 7);
      const total = denominator * base;
      const correct = numerator * base;
      return {
        prompt: `${fractionText(numerator, denominator)} of a set is needed. If the set has ${total} items, how many items are needed?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [base, -base, numerator, denominator], 0),
        explanation: `One part is ${base}. Multiply by ${numerator} to get ${correct}.`,
        strategyTags: ["find one part first", "multiply by the numerator"],
        trapWarning: "Fraction of a set uses equal groups."
      };
    }),
    family("fraction_difference", (ctx, rng) => {
      const denominator = rng.pick([6, 8, 10]);
      const a = rng.int(denominator / 2, denominator - 1);
      const b = rng.int(1, denominator / 2);
      const [n, d] = simplifyFraction(a - b, denominator);
      const correct = fractionText(n, d);
      return {
        prompt: `Compute ${fractionText(a, denominator)} - ${fractionText(b, denominator)}.`,
        correct,
        distractors: textDistractors(correct, [fractionText(a - b, denominator), fractionText(a + b, denominator), fractionText(b, a), fractionText(a, b)]),
        explanation: `Subtract the numerators and keep the common denominator, then simplify.`,
        strategyTags: ["same denominator means subtract numerators", "simplify at the end"],
        trapWarning: "The denominator stays the same when the parts are the same size."
      };
    }),
    family("visual_equivalent", (ctx, rng) => {
      const parts = rng.pick([4, 6, 8]);
      const shaded = rng.pick([2, 3, 4]);
      const [n, d] = simplifyFraction(shaded, parts);
      const correct = fractionText(n, d);
      return {
        prompt: `Which fraction matches the shaded strip?`,
        correct,
        distractors: textDistractors(correct, [fractionText(shaded, parts), fractionText(n + 1, d + 1), fractionText(d, n), fractionText(1, d)]),
        explanation: `${shaded}/${parts} simplifies to ${correct}.`,
        strategyTags: ["reduce by a common factor", "match the picture to a fraction"],
        trapWarning: "Equivalent fractions name the same amount, not a different shading.",
        format: "svg",
        visualAssetSpec: fractionBarVisual(parts, shaded, "equivalent")
      };
    }, "svg")
  ];
}

function decimalPercentFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("percent_of_number", (ctx, rng) => {
      const percent = rng.pick([10, 20, 25, 40, 50, 75]);
      const base = rng.int(20, 200);
      const correct = Math.round((base * percent) / 100);
      return {
        prompt: `What is ${percent}% of ${base}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [percent / 5 || 2, -(percent / 10 || 1), 5, -5], 0),
        explanation: `${percent}% means ${percent}/100, so multiply ${base} by that fraction.`,
        strategyTags: ["turn percent into per hundred", "use easy benchmark percents"],
        trapWarning: "Percent means out of 100, not out of 10."
      };
    }),
    family("decimal_compare", (ctx, rng) => {
      const a = Number((rng.int(11, 89) / 10).toFixed(1));
      const b = Number((rng.int(11, 89) / 10).toFixed(1));
      const correct = a > b ? String(a) : String(b);
      return {
        prompt: `Which decimal is greater: ${a} or ${b}?`,
        correct,
        distractors: textDistractors(correct, [String(a < b ? a : b), "they are equal", String(Math.max(a, b).toFixed(2)), String(Math.min(a, b).toFixed(2))]),
        explanation: `Compare whole-number parts first, then tenths, then hundredths.`,
        strategyTags: ["align decimal places", "compare left to right"],
        trapWarning: "0.8 is greater than 0.75 because 8 tenths > 7 tenths."
      };
    }),
    family("percent_change", (ctx, rng) => {
      const start = rng.int(40, 180);
      const percent = rng.pick([10, 20, 25, 50]);
      const correct = Math.round(start * (1 + percent / 100));
      return {
        prompt: `A price of ${start} increases by ${percent}%. What is the new price?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [percent, -percent, Math.round(start * percent / 100), -Math.round(start * percent / 100)], 0),
        explanation: `Find the increase, then add it to the start price.`,
        strategyTags: ["find the change first", "new amount = original + change"],
        trapWarning: "Percent increase changes the original amount; it is not the final answer by itself."
      };
    }),
    family("fraction_decimal_match", (ctx, rng) => {
      const pair = rng.pick([
        [1, 2, "0.5"],
        [1, 4, "0.25"],
        [3, 4, "0.75"],
        [1, 5, "0.2"]
      ]);
      const [n, d, dec] = pair;
      return {
        prompt: `Which decimal is equal to ${fractionText(n, d)}?`,
        correct: dec,
        distractors: textDistractors(dec, [formatDecimal(Number(dec) + 0.1), formatDecimal(Math.max(0, Number(dec) - 0.1)), "0.05", "1.0"]),
        explanation: `Convert the fraction to a decimal or use a known benchmark value.`,
        strategyTags: ["use fraction-decimal benchmarks", "think in tenths or hundredths"],
        trapWarning: "The denominator tells how many equal parts make 1 whole."
      };
    }),
    family("percent_to_fraction", (ctx, rng) => {
      const pair = rng.pick([
        [10, "1/10"],
        [20, "1/5"],
        [25, "1/4"],
        [50, "1/2"],
        [75, "3/4"]
      ]);
      return {
        prompt: `Which fraction is equal to ${pair[0]}%?`,
        correct: pair[1],
        distractors: textDistractors(pair[1], ["1/3", "2/5", "2/3", "4/5"]),
        explanation: `${pair[0]}% = ${pair[0]}/100, then simplify to ${pair[1]}.`,
        strategyTags: ["write percent over 100", "simplify the fraction"],
        trapWarning: "Percent is out of 100, even if the simplified fraction looks different."
      };
    })
  ];
}

function ratioFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("scale_recipe", (ctx, rng) => {
      const a = rng.int(2, 7);
      const factor = rng.int(2, 5);
      const correct = a * factor;
      return {
        prompt: `A recipe uses ${a} cups of flour for 1 batch. How many cups are needed for ${factor} batches?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, factor, -1], 0),
        explanation: `Scale every quantity by the same factor: ${a} × ${factor} = ${correct}.`,
        strategyTags: ["scale both parts equally", "use a ratio table"],
        trapWarning: "When batches multiply, every ingredient multiplies too."
      };
    }),
    family("unit_rate", (ctx, rng) => {
      const distance = rng.int(18, 90);
      const time = rng.pick([2, 3, 4, 5, 6]);
      const correct = distance / time;
      return {
        prompt: `A runner goes ${distance} km in ${time} hours at a constant speed. How many kilometers per hour is that?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [time, -1, 1, Math.floor(correct / 2)], 0),
        explanation: `Unit rate means per 1 hour, so divide ${distance} by ${time}.`,
        strategyTags: ["per 1 means divide", "build the unit rate"],
        trapWarning: "A unit rate is one unit of the second quantity."
      };
    }),
    family("ratio_table", (ctx, rng) => {
      const left = rng.int(2, 7);
      const right = rng.int(3, 9);
      const scale = rng.int(2, 6);
      const correct = right * scale;
      return {
        prompt: `In a ratio table, ${left} corresponds to ${right}. What corresponds to ${left * scale}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [right, -right, scale, -scale], 0),
        explanation: `The left side is multiplied by ${scale}, so the right side must also be multiplied by ${scale}.`,
        strategyTags: ["keep the ratio scale the same", "match the multiplication"],
        trapWarning: "Only proportional changes keep the ratio true."
      };
    }),
    family("proportion_missing", (ctx, rng) => {
      const a = rng.int(2, 6);
      const b = rng.int(3, 9);
      const c = a * rng.int(2, 4);
      const correct = (b * c) / a;
      return {
        prompt: `Solve the proportion ${a}:${b} = ${c}:□`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, b, -b], 0),
        explanation: `Scale from ${a} to ${c}, then scale ${b} by the same factor.`,
        strategyTags: ["scale both ratio parts together", "cross-check with equal fractions"],
        trapWarning: "The same scale factor must apply to both sides of the ratio."
      };
    }),
    family("percent_as_ratio", (ctx, rng) => {
      const percent = rng.pick([20, 25, 40, 60, 75]);
      const correct = percent === 20 ? "1:5" : percent === 25 ? "1:4" : percent === 40 ? "2:5" : percent === 60 ? "3:5" : "3:4";
      return {
        prompt: `Which ratio is equivalent to ${percent}%?`,
        correct,
        distractors: textDistractors(correct, ["1:2", "2:3", "4:5", "5:6"]),
        explanation: `Write ${percent}% as ${percent}:100 and simplify.`,
        strategyTags: ["turn percent into a ratio out of 100", "simplify the ratio"],
        trapWarning: "Reduce the ratio after writing the percent as per hundred."
      };
    })
  ];
}

function algebraLinearFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("one_step_equation", (ctx, rng) => {
      const x = rng.int(3, 20);
      const add = rng.int(2, 12);
      return {
        prompt: `Solve: x + ${add} = ${x + add}`,
        correct: String(x),
        distractors: numericDistractors(x, [add, -add, 1, -1], 0),
        explanation: `Undo the +${add} to isolate x.`,
        strategyTags: ["undo the outside operation", "keep the equation balanced"],
        trapWarning: "Use the inverse operation on the side with x."
      };
    }),
    family("two_step_equation", (ctx, rng) => {
      const x = rng.int(2, 12);
      const mult = rng.int(2, 5);
      const add = rng.int(1, 8);
      const total = mult * x + add;
      return {
        prompt: `Solve: ${mult}x + ${add} = ${total}`,
        correct: String(x),
        distractors: numericDistractors(x, [1, -1, mult, -mult], 0),
        explanation: `Subtract ${add}, then divide by ${mult}.`,
        strategyTags: ["undo in reverse order", "subtract before dividing"],
        trapWarning: "Undo the +${add} before the multiplication."
      };
    }),
    family("expression_value", (ctx, rng) => {
      const x = rng.int(2, 9);
      const a = rng.int(2, 6);
      const b = rng.int(1, 9);
      const correct = a * x + b;
      return {
        prompt: `Evaluate ${a}n + ${b} when n = ${x}.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, b, -b], 0),
        explanation: `Substitute n = ${x}, multiply first, then add ${b}.`,
        strategyTags: ["substitute carefully", "use order of operations"],
        trapWarning: "Multiply before you add."
      };
    }),
    family("combine_like_terms", (ctx, rng) => {
      const a = rng.int(2, 8);
      const b = rng.int(2, 8);
      const correct = `${a + b}x`;
      return {
        prompt: `Simplify: ${a}x + ${b}x`,
        correct,
        distractors: textDistractors(correct, [`${a * b}x`, `${a + b}`, `${a}x^${b}`, `${Math.abs(a - b)}x`]),
        explanation: `Like terms have the same variable part, so add the coefficients.`,
        strategyTags: ["combine like terms only", "add the coefficients"],
        trapWarning: "Only like terms can be combined directly."
      };
    }),
    family("balance_model", (ctx, rng) => {
      const x = rng.int(3, 12);
      const extra = rng.int(2, 7);
      return {
        prompt: `A balance shows x + ${extra} on one side and ${x + extra} on the other. What is x?`,
        correct: String(x),
        distractors: numericDistractors(x, [1, -1, extra, -extra], 0),
        explanation: `Subtract ${extra} from the total to find x.`,
        strategyTags: ["keep both sides equal", "remove the same amount"],
        trapWarning: "The extra amount is not x itself.",
        format: "svg",
        visualAssetSpec: balanceVisual(`x+${extra}`, `${x + extra}`, "balance")
      };
    }, "svg")
  ];
}

function geometryMeasurementFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("composite_area", (ctx, rng) => {
      const a = rng.int(4, 9);
      const b = rng.int(3, 7);
      const c = rng.int(2, 6);
      const correct = a * b + c * b;
      return {
        prompt: `A shape is made from two rectangles: ${a} by ${b} and ${c} by ${b}. What is the total area?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a + c, -(a + c), b, -b], 0),
        explanation: `Find each rectangle's area and add them: ${a * b} + ${c * b} = ${correct}.`,
        strategyTags: ["split into simpler shapes", "add the areas"],
        trapWarning: "Composite area is found piece by piece."
      };
    }),
    family("volume_box", (ctx, rng) => {
      const l = rng.int(2, 8);
      const w = rng.int(2, 6);
      const h = rng.int(2, 5);
      const correct = l * w * h;
      return {
        prompt: `What is the volume of a box with side lengths ${l}, ${w}, and ${h}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [l * w, -(l * w), h, -h], 0),
        explanation: `Volume of a rectangular prism is length × width × height = ${correct}.`,
        strategyTags: ["multiply the three dimensions", "use cubic units"],
        trapWarning: "Volume needs three dimensions, not just area."
      };
    }),
    family("triangle_angle_sum", (ctx, rng) => {
      const a = rng.int(25, 75);
      const b = rng.int(25, 75);
      const correct = 180 - a - b;
      return {
        prompt: `Two angles of a triangle are ${a}° and ${b}°. What is the third angle?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, 10, -10], 0),
        explanation: `Angles in a triangle add to 180°, so the third angle is ${correct}°.`,
        strategyTags: ["triangle angles total 180", "subtract the known angles"],
        trapWarning: "Triangle angle sums always use 180°, not 360°."
      };
    }),
    family("polygon_sum", (ctx, rng) => {
      const sides = rng.pick([5, 6, 7, 8]);
      const correct = (sides - 2) * 180;
      return {
        prompt: `What is the sum of the interior angles of a ${sides}-gon?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [180, -180, sides * 90 - correct, 90], 0),
        explanation: `A ${sides}-gon can be split into ${sides - 2} triangles, so the sum is ${correct}°.`,
        strategyTags: ["split into triangles", "use (n-2)×180"],
        trapWarning: "Interior-angle sum depends on the number of sides, not the side lengths."
      };
    }),
    family("scaled_area", (ctx, rng) => {
      const area = rng.int(12, 60);
      const factor = rng.pick([2, 3, 4]);
      const correct = area * factor * factor;
      return {
        prompt: `A figure is enlarged by scale factor ${factor}. If the original area is ${area}, what is the new area?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [area * factor - correct, area, factor, -factor], 0),
        explanation: `Area scales by the square of the scale factor, so multiply by ${factor * factor}.`,
        strategyTags: ["length scale is not area scale", "square the scale factor"],
        trapWarning: "Area changes by factor squared, not by the factor itself."
      };
    })
  ];
}

function graphsFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("coordinate_read", (ctx, rng) => {
      const point = { x: rng.int(1, 6), y: rng.int(1, 5), label: "A" };
      const correct = `(${point.x}, ${point.y})`;
      return {
        prompt: `What are the coordinates of point A?`,
        correct,
        distractors: textDistractors(correct, [`(${point.y}, ${point.x})`, `(${point.x + 1}, ${point.y})`, `(${point.x}, ${point.y + 1})`, `(${point.x - 1}, ${point.y})`]),
        explanation: `Coordinates are read as (x, y), so A is at ${correct}.`,
        strategyTags: ["x then y", "use the axes labels"],
        trapWarning: "Do not swap x and y.",
        format: "svg",
        visualAssetSpec: coordinateVisual([point], 0)
      };
    }, "svg"),
    family("slope_from_points", (ctx, rng) => {
      const x1 = rng.int(0, 3);
      const y1 = rng.int(0, 3);
      const run = rng.int(1, 4);
      const rise = rng.int(1, 4);
      const correct = fractionText(rise, run);
      return {
        prompt: `What is the slope from (${x1}, ${y1}) to (${x1 + run}, ${y1 + rise})?`,
        correct,
        distractors: textDistractors(correct, [fractionText(run, rise), String(rise + run), fractionText(rise + 1, run), fractionText(rise, run + 1)]),
        explanation: `Slope is rise over run, so ${rise}/${run}.`,
        strategyTags: ["rise over run", "subtract coordinates in the same order"],
        trapWarning: "Slope uses vertical change divided by horizontal change."
      };
    }),
    family("table_linear_rule", (ctx, rng) => {
      const m = rng.int(2, 5);
      const b = rng.int(1, 6);
      const x = rng.int(3, 8);
      const correct = m * x + b;
      return {
        prompt: `A table follows y = ${m}x + ${b}. What is y when x = ${x}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [m, -m, b, -b], 0),
        explanation: `Substitute x = ${x} into the rule to get ${correct}.`,
        strategyTags: ["substitute into the rule", "multiply before adding"],
        trapWarning: "Keep x and y roles separate when reading the rule."
      };
    }),
    family("midpoint", (ctx, rng) => {
      const x1 = rng.int(0, 4);
      const y1 = rng.int(0, 4);
      const x2 = x1 + rng.int(2, 6);
      const y2 = y1 + rng.int(2, 6);
      const correct = `(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`;
      return {
        prompt: `What is the midpoint of (${x1}, ${y1}) and (${x2}, ${y2})?`,
        correct,
        distractors: textDistractors(correct, [`(${x1 + x2}, ${y1 + y2})`, `(${x2 - x1}, ${y2 - y1})`, `(${(x1 + x2) / 2}, ${y1})`, `(${x2}, ${(y1 + y2) / 2})`]),
        explanation: `Average the x-coordinates and the y-coordinates to get the midpoint.`,
        strategyTags: ["average the coordinates", "midpoint is halfway in both directions"],
        trapWarning: "Midpoint uses averages, not differences."
      };
    }),
    family("line_interpretation", (ctx, rng) => {
      const start = rng.int(1, 5);
      const step = rng.int(2, 4);
      const at = rng.int(3, 6);
      const correct = start + step * at;
      return {
        prompt: `A graph starts at ${start} and rises ${step} each step. What value is reached after ${at} steps?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [step, -step, start, -start], 0),
        explanation: `Repeatedly add ${step}, or use start + step × steps.`,
        strategyTags: ["start value plus repeated rise", "read the trend"],
        trapWarning: "Use both the starting value and the rate of change."
      };
    })
  ];
}

function countingProbabilityFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("counting_product", (ctx, rng) => {
      const shirts = rng.int(2, 5);
      const pants = rng.int(2, 4);
      const correct = shirts * pants;
      return {
        prompt: `There are ${shirts} shirts and ${pants} pants. How many outfits can be made with one shirt and one pair of pants?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [shirts, -shirts, pants, -pants], 0),
        explanation: `Use the multiplication principle: ${shirts} × ${pants} = ${correct}.`,
        strategyTags: ["count in stages", "multiply the independent choices"],
        trapWarning: "When choices happen in sequence, multiply the number of options."
      };
    }),
    family("simple_probability", (ctx, rng) => {
      const red = rng.int(2, 6);
      const blue = rng.int(1, 5);
      const total = red + blue;
      const correct = fractionText(red, total);
      return {
        prompt: `A bag has ${red} red and ${blue} blue marbles. What is the probability of drawing red?`,
        correct,
        distractors: textDistractors(correct, [fractionText(blue, total), fractionText(total, red), fractionText(1, total), "1"]),
        explanation: `Probability = favorable outcomes / total outcomes = ${red}/${total}.`,
        strategyTags: ["favorable over total", "count all outcomes once"],
        trapWarning: "Use total marbles in the denominator."
      };
    }),
    family("arrangements", (ctx, rng) => {
      const letters = rng.pick(["ABC", "ABCD"]);
      const correct = letters.length === 3 ? "6" : "24";
      return {
        prompt: `How many different arrangements can be made with the letters ${letters}?`,
        correct,
        distractors: textDistractors(correct, [String(letters.length), String(letters.length * 2), String(letters.length * letters.length), String(letters.length + 1)]),
        explanation: `Count ordered arrangements: 3 letters make 3×2×1 = 6, 4 letters make 4×3×2×1 = 24.`,
        strategyTags: ["ordered arrangements multiply descending choices", "use factorial thinking"],
        trapWarning: "Arrangements care about order."
      };
    }),
    family("expected_value_easy", (ctx, rng) => {
      const values = [1, 2, 3, 4, 5, 6];
      return {
        prompt: `What is the average value on a fair number cube numbered 1 through 6?`,
        correct: "3.5",
        distractors: textDistractors("3.5", ["3", "4", "6", "2.5"]),
        explanation: `Add 1 through 6 and divide by 6 to get 3.5.`,
        strategyTags: ["average = total ÷ count", "use symmetry around the middle"],
        trapWarning: "Expected value can be a decimal even if outcomes are whole numbers."
      };
    }),
    family("conditional_restriction", (ctx, rng) => {
      const correct = "12";
      return {
        prompt: `How many 2-digit numbers can be made using digits 1, 2, 3, 4 with no repetition?`,
        correct,
        distractors: textDistractors(correct, ["16", "8", "24", "4"]),
        explanation: `4 choices for the first digit and 3 choices for the second give 12 numbers.`,
        strategyTags: ["use a counting tree", "reduce the choices after each pick"],
        trapWarning: "No repetition means the second choice has fewer options."
      };
    })
  ];
}

function functionsSequenceFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("arithmetic_sequence", (ctx, rng) => {
      const start = rng.int(2, 12);
      const step = rng.int(2, 7);
      const n = rng.int(5, 9);
      const correct = start + step * (n - 1);
      return {
        prompt: `An arithmetic sequence starts ${start}, ${start + step}, ${start + step * 2}, ... What is term ${n}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [step, -step, n, -n], 0),
        explanation: `Term ${n} = first term + (n - 1) × step = ${correct}.`,
        strategyTags: ["find the common difference", "count how many jumps to the target term"],
        trapWarning: "The first term is term 1, so there are n-1 jumps to term n."
      };
    }),
    family("recursive_table", (ctx, rng) => {
      const start = rng.int(1, 6);
      const mult = rng.int(2, 3);
      const add = rng.int(1, 4);
      const a2 = start * mult + add;
      const a3 = a2 * mult + add;
      const correct = a3 * mult + add;
      return {
        prompt: `A sequence starts at ${start} and follows: multiply by ${mult}, then add ${add}. What is the 4th term?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [add, -add, mult, -mult], 0),
        explanation: `Apply the rule one step at a time to reach the 4th term.`,
        strategyTags: ["repeat the same rule", "keep a running table"],
        trapWarning: "A recursive rule is applied step by step."
      };
    }),
    family("geometric_sequence", (ctx, rng) => {
      const start = rng.pick([2, 3, 4, 5]);
      const ratio = rng.pick([2, 3]);
      const n = rng.int(4, 6);
      const correct = start * ratio ** (n - 1);
      return {
        prompt: `A geometric sequence starts ${start}, ${start * ratio}, ${start * ratio * ratio}, ... What is term ${n}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [ratio, -ratio, start, -start], 0),
        explanation: `Multiply by the same ratio each time.`,
        strategyTags: ["look for multiplicative growth", "count powers of the ratio"],
        trapWarning: "Geometric sequences multiply; they do not add a fixed difference."
      };
    }),
    family("function_table", (ctx, rng) => {
      const m = rng.int(2, 5);
      const b = rng.int(1, 6);
      const input = rng.int(3, 8);
      const correct = m * input + b;
      return {
        prompt: `A function table follows f(n) = ${m}n + ${b}. What is f(${input})?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [m, -m, b, -b], 0),
        explanation: `Substitute n = ${input} into the function rule.`,
        strategyTags: ["substitute into the rule", "compute in order"],
        trapWarning: "Keep the variable's value consistent in every term."
      };
    }),
    family("series_sum", (ctx, rng) => {
      const first = rng.int(2, 8);
      const step = rng.int(2, 5);
      const count = rng.int(4, 6);
      const last = first + step * (count - 1);
      const correct = ((first + last) * count) / 2;
      return {
        prompt: `Find the sum of the first ${count} terms of the arithmetic sequence ${first}, ${first + step}, ...`,
        correct: String(correct),
        distractors: numericDistractors(correct, [last, -last, count, -count], 0),
        explanation: `Average the first and last terms, then multiply by the number of terms.`,
        strategyTags: ["pair first and last", "average then multiply"],
        trapWarning: "Do not confuse the last term with the whole sum."
      };
    })
  ];
}

function integerFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("signed_sum", (ctx, rng) => {
      const a = rng.int(-12, 18);
      const b = rng.int(-12, 18);
      const correct = a + b;
      return {
        prompt: `Compute ${a} + (${b}).`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, Math.abs(a), Math.abs(b)], -50, 50),
        explanation: `Combine the signed values carefully to get ${correct}.`,
        strategyTags: ["track the sign", "combine positives and negatives"],
        trapWarning: "Adding a negative is the same as subtracting its size."
      };
    }),
    family("signed_product", (ctx, rng) => {
      const a = rng.pick([-6, -5, -4, 4, 5, 6]);
      const b = rng.pick([-5, -4, 4, 5]);
      const correct = a * b;
      return {
        prompt: `Compute ${a} × ${b}.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [Math.abs(a), -Math.abs(a), Math.abs(b), -Math.abs(b)], -50, 50),
        explanation: `Use the sign rule for multiplication, then multiply the absolute values.`,
        strategyTags: ["same signs positive, different signs negative", "multiply the absolute values"],
        trapWarning: "Check the sign first, then the size."
      };
    }),
    family("absolute_value", (ctx, rng) => {
      const a = rng.pick([-12, -9, -7, -4, 4, 7, 9, 12]);
      const correct = Math.abs(a);
      return {
        prompt: `What is |${a}|?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [-correct * 2, 1, -1, 2], 0),
        explanation: `Absolute value is the distance from 0, so it is always nonnegative.`,
        strategyTags: ["distance from zero", "ignore the sign for absolute value"],
        trapWarning: "Absolute value never stays negative."
      };
    }),
    family("ordering_rationals", (ctx, rng) => {
      const values = [-1.5, -0.75, 0.25, 1.2, 2.5];
      const correct = "-1.5";
      return {
        prompt: `Which number is least: -1.5, -0.75, 0.25, 1.2, 2.5?`,
        correct,
        distractors: textDistractors(correct, ["-0.75", "0.25", "1.2", "2.5"]),
        explanation: `More negative numbers are smaller on the number line.`,
        strategyTags: ["place numbers on a line mentally", "more left means smaller"],
        trapWarning: "Among negatives, the one with the larger absolute value is actually smaller."
      };
    }),
    family("rational_difference", (ctx, rng) => {
      const a = rng.int(-8, 6);
      const b = rng.int(-8, 6);
      const correct = a - b;
      return {
        prompt: `Compute ${a} - (${b}).`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, Math.abs(b), -Math.abs(b)], -40, 40),
        explanation: `Subtracting a negative is the same as adding its opposite.`,
        strategyTags: ["change subtraction of negatives to addition", "watch the double sign"],
        trapWarning: `Keep the minus sign attached to (${b}) before simplifying.`
      };
    })
  ];
}

function systemsFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("solve_system", (ctx, rng) => {
      const x = rng.int(2, 8);
      const y = rng.int(3, 9);
      const a = rng.int(2, 5);
      const b = rng.int(2, 5);
      const eq1 = x + y;
      const eq2 = a * x + b * y;
      return {
        prompt: `Solve the system: x + y = ${eq1}, and ${a}x + ${b}y = ${eq2}. What is x?`,
        correct: String(x),
        distractors: numericDistractors(x, [1, -1, y - x, a], 0),
        explanation: `Use substitution or elimination to solve the pair and get x = ${x}.`,
        strategyTags: ["line up the two equations", "eliminate one variable"],
        trapWarning: "A system answer must satisfy both equations."
      };
    }),
    family("word_model", (ctx, rng) => {
      const adults = rng.int(4, 10);
      const children = rng.int(6, 14);
      const tickets = adults + children;
      const total = adults * 12 + children * 7;
      return {
        prompt: `A show sold ${tickets} tickets. Adult tickets cost 12 and child tickets cost 7. The total revenue was ${total}. How many adult tickets were sold?`,
        correct: String(adults),
        distractors: numericDistractors(adults, [1, -1, children - adults, 2], 0),
        explanation: `Let adults and children be variables and solve the system from the ticket count and total cost.`,
        strategyTags: ["translate words into equations", "use both totals"],
        trapWarning: "Revenue and number of tickets are two different conditions."
      };
    }),
    family("mixture_balance", (ctx, rng) => {
      const cupsA = rng.int(2, 5);
      const cupsB = rng.int(2, 5);
      const total = cupsA + cupsB;
      const sugar = cupsA * 3 + cupsB * 5;
      return {
        prompt: `A drink uses ${total} cups total. Type A has 3 spoons of sugar per cup and Type B has 5. If the drink has ${sugar} spoons of sugar total, how many cups of Type B were used?`,
        correct: String(cupsB),
        distractors: numericDistractors(cupsB, [1, -1, cupsA - cupsB, 2], 0),
        explanation: `Let the two cup counts be variables and solve the two equations.`,
        strategyTags: ["set up two equations", "use total and weighted total"],
        trapWarning: "Track which ingredient belongs to which type."
      };
    }),
    family("intersection_table", (ctx, rng) => {
      const x = rng.int(2, 7);
      const y = 2 * x + 1;
      return {
        prompt: `Line A follows y = 2x + 1. Line B passes through (${x}, ${y}). What is the x-coordinate of their intersection?`,
        correct: String(x),
        distractors: numericDistractors(x, [1, -1, y - x, 2], 0),
        explanation: `The given point lies on both lines, so its x-coordinate is ${x}.`,
        strategyTags: ["intersection point satisfies both relations", "use the given point"],
        trapWarning: "An intersection is a single point that works for both lines."
      };
    }),
    family("balance_equations", (ctx, rng) => {
      const x = rng.int(2, 8);
      const y = rng.int(2, 8);
      return {
        prompt: `Two boxes and one star weigh ${2 * x + y}. One box and two stars weigh ${x + 2 * y}. If a box weighs ${x}, how much does a star weigh?`,
        correct: String(y),
        distractors: numericDistractors(y, [1, -1, x - y, 2], 0),
        explanation: `Substitute the box value into the second relation and solve for the star.`,
        strategyTags: ["substitute known values", "solve the remaining equation"],
        trapWarning: "Use the given box weight before solving for the star."
      };
    })
  ];
}

function quadraticFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("square_pattern", (ctx, rng) => {
      const n = rng.int(5, 12);
      const correct = n * n;
      return {
        prompt: `What is ${n}^2?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [n, -n, 2 * n, -2 * n], 0),
        explanation: `${n}^2 means ${n} × ${n} = ${correct}.`,
        strategyTags: ["square means multiply a number by itself", "check powers carefully"],
        trapWarning: "n^2 is not 2n."
      };
    }),
    family("factor_quadratic", (ctx, rng) => {
      const a = rng.int(2, 8);
      const b = rng.int(2, 8);
      const sum = a + b;
      const product = a * b;
      return {
        prompt: `x^2 + ${sum}x + ${product} factors as (x + ?)(x + ?). What are the two numbers?`,
        correct: `${a} and ${b}`,
        distractors: textDistractors(`${a} and ${b}`, [`${sum} and ${product}`, `${a} and ${product}`, `${b} and ${product}`, `${a + 1} and ${b - 1}`]),
        explanation: `For x^2 + ${sum}x + ${product}, find two numbers with sum ${sum} and product ${product}.`,
        strategyTags: ["look for sum and product", "test factor pairs"],
        trapWarning: "The pair must fit both the sum and the product."
      };
    }),
    family("difference_of_squares", (ctx, rng) => {
      const a = rng.int(6, 14);
      const b = rng.int(2, a - 1);
      const correct = (a - b) * (a + b);
      return {
        prompt: `Compute ${a}^2 - ${b}^2.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a + b, -(a + b), a - b, -(a - b)], 0),
        explanation: `Use the identity a^2 - b^2 = (a - b)(a + b).`,
        strategyTags: ["spot a difference of squares", "factor before multiplying"],
        trapWarning: "Do not square after subtracting unless the expression tells you to."
      };
    }),
    family("parabola_value", (ctx, rng) => {
      const x = rng.int(2, 6);
      const b = rng.int(1, 5);
      const c = rng.int(1, 7);
      const correct = x * x + b * x + c;
      return {
        prompt: `Evaluate y = x^2 + ${b}x + ${c} when x = ${x}.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [b, -b, c, -c], 0),
        explanation: `Substitute x = ${x} and compute in order.`,
        strategyTags: ["substitute carefully", "square before multiply-add"],
        trapWarning: "x^2 is the square of x, not 2x."
      };
    }),
    family("quadratic_sequence", (ctx, rng) => {
      const start = rng.int(1, 4);
      const correct = start + 16;
      return {
        prompt: `A sequence grows by odd numbers: ${start}, ${start + 1}, ${start + 4}, ${start + 9}, ? What comes next?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [3, -3, 5, -5], 0),
        explanation: `The added amounts are 1, 3, 5, 7, so the next term is ${correct}.`,
        strategyTags: ["look at second differences", "notice the odd-number growth"],
        trapWarning: "This sequence is not arithmetic; its jumps keep changing."
      };
    })
  ];
}

function exponentsFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("exponent_rule", (ctx, rng) => {
      const a = rng.int(2, 5);
      const m = rng.int(2, 5);
      const n = rng.int(2, 4);
      const correct = `${a}^${m + n}`;
      return {
        prompt: `Simplify ${a}^${m} × ${a}^${n}.`,
        correct,
        distractors: textDistractors(correct, [`${a}^${m * n}`, `${a * a}^${m + n}`, `${a}^${m - n}`, `${a + 1}^${m + n}`]),
        explanation: `When the bases match, add the exponents: ${m} + ${n} = ${m + n}.`,
        strategyTags: ["same base means add exponents", "keep the base the same"],
        trapWarning: "Do not multiply exponents when multiplying equal bases."
      };
    }),
    family("square_root", (ctx, rng) => {
      const n = rng.pick([16, 25, 36, 49, 64, 81]);
      const correct = Math.sqrt(n);
      return {
        prompt: `What is √${n}?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, 2, -2], 0),
        explanation: `The square root is the number whose square is ${n}.`,
        strategyTags: ["know the perfect squares", "check by squaring"],
        trapWarning: "Square root asks for the side length, not the area."
      };
    }),
    family("scientific_notation", (ctx, rng) => {
      const coeff = rng.int(2, 9);
      const exp = rng.int(3, 6);
      const correct = String(coeff * 10 ** exp);
      return {
        prompt: `Write ${coeff} × 10^${exp} as an ordinary number.`,
        correct,
        distractors: numericDistractors(Number(correct), [10 ** (exp - 1), -(10 ** (exp - 1)), coeff, -coeff], 0, 99999999),
        explanation: `Move the decimal point ${exp} places to the right.`,
        strategyTags: ["powers of ten shift place value", "count the decimal moves"],
        trapWarning: "10^n multiplies by ten repeatedly; it does not add n zeros blindly if decimals are involved."
      };
    }),
    family("radical_compare", (ctx, rng) => {
      const pair = rng.pick([
        [18, 20],
        [27, 25],
        [45, 50],
        [32, 36]
      ]);
      const correct = pair[0] > pair[1] ? `√${pair[0]}` : `√${pair[1]}`;
      return {
        prompt: `Which is greater: √${pair[0]} or √${pair[1]}?`,
        correct,
        distractors: textDistractors(correct, [correct === `√${pair[0]}` ? `√${pair[1]}` : `√${pair[0]}`, "they are equal", String(Math.max(...pair)), String(Math.min(...pair))]),
        explanation: `Square root is increasing, so compare the numbers inside the radical.`,
        strategyTags: ["square root preserves order", "compare the radicands"],
        trapWarning: "You can compare square roots by comparing what is inside."
      };
    }),
    family("log_power_bridge", (ctx, rng) => {
      return {
        prompt: `If 2^x = 32, what is x?`,
        correct: "5",
        distractors: ["4", "6", "8", "16"],
        explanation: `Since 2 × 2 × 2 × 2 × 2 = 32, x = 5.`,
        strategyTags: ["rewrite as repeated multiplication", "match the power to the number"],
        trapWarning: "The exponent counts how many equal factors of 2 are used."
      };
    })
  ];
}

function inequalitiesFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("one_step_inequality", (ctx, rng) => {
      const x = rng.int(2, 12);
      const add = rng.int(1, 8);
      const bound = x + add;
      return {
        prompt: `Which value satisfies x + ${add} < ${bound}?`,
        correct: String(x - 1),
        distractors: numericDistractors(x - 1, [1, -1, add, -add], -20, 40),
        explanation: `Subtract ${add} from both sides to get x < ${bound - add}.`,
        strategyTags: ["undo the same step on both sides", "test the answer back in the inequality"],
        trapWarning: "An inequality has many solutions; the choice only needs to satisfy the relation."
      };
    }),
    family("absolute_distance", (ctx, rng) => {
      const center = rng.int(2, 12);
      const radius = rng.int(2, 5);
      const correct = `${center - radius} and ${center + radius}`;
      return {
        prompt: `Which two numbers are exactly ${radius} away from ${center}?`,
        correct,
        distractors: textDistractors(correct, [`${center - radius} and ${center}`, `${center} and ${center + radius}`, `${center - 1} and ${center + 1}`, `${center - radius + 1} and ${center + radius - 1}`]),
        explanation: `Numbers exactly ${radius} away are the center minus and plus ${radius}.`,
        strategyTags: ["absolute value is distance", "use center minus and plus radius"],
        trapWarning: "Distance creates two symmetric solutions."
      };
    }),
    family("interval_intersection", (ctx, rng) => {
      return {
        prompt: `What is the intersection of x > 3 and x < 8 among the integers?`,
        correct: "4, 5, 6, 7",
        distractors: textDistractors("4, 5, 6, 7", ["3, 4, 5, 6, 7, 8", "4, 5, 6, 7, 8", "3, 4, 5, 6, 7", "all integers"]),
        explanation: `The intersection keeps only values that satisfy both conditions at once.`,
        strategyTags: ["draw both conditions", "keep only the overlap"],
        trapWarning: "Intersection means both conditions together, not either one."
      };
    }),
    family("system_region", (ctx, rng) => {
      return {
        prompt: `Which point satisfies both x > 1 and y > 2?`,
        correct: "(3, 4)",
        distractors: textDistractors("(3, 4)", ["(1, 4)", "(3, 2)", "(0, 5)", "(2, 1)"]),
        explanation: `The point must have x greater than 1 and y greater than 2.`,
        strategyTags: ["check each condition separately", "a solution to a system must satisfy every condition"],
        trapWarning: "A point fails the system if it breaks even one inequality."
      };
    }),
    family("absolute_equation", (ctx, rng) => {
      const center = rng.int(2, 10);
      const radius = rng.int(1, 4);
      const correct = `${center - radius} and ${center + radius}`;
      return {
        prompt: `Solve |x - ${center}| = ${radius}.`,
        correct,
        distractors: textDistractors(correct, [`${center - radius}`, `${center + radius}`, `${center} and ${radius}`, `${center - 1} and ${center + 1}`]),
        explanation: `Absolute value means distance, so x is ${radius} away from ${center}.`,
        strategyTags: ["distance gives two symmetric answers", "write both plus and minus cases"],
        trapWarning: "Absolute value equations usually create two solutions."
      };
    })
  ];
}

function geometryAnglesFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("triangle_missing_angle", (ctx, rng) => {
      const a = rng.int(30, 75);
      const b = rng.int(25, 70);
      const correct = 180 - a - b;
      return {
        prompt: `In a triangle, two angles are ${a}° and ${b}°. Find the third angle.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [10, -10, a - b, b - a], 0),
        explanation: `Triangle angles add to 180°, so subtract the known angles.`,
        strategyTags: ["use the 180-degree sum", "subtract the known angles"],
        trapWarning: "Only triangles use the 180-degree total here.",
        format: "svg",
        visualAssetSpec: angleVisual(a, b, correct, "triangle")
      };
    }, "svg"),
    family("exterior_angle", (ctx, rng) => {
      const a = rng.int(35, 75);
      const b = rng.int(25, 70);
      const correct = a + b;
      return {
        prompt: `An exterior angle of a triangle equals the sum of the two remote interior angles. If those are ${a}° and ${b}°, what is the exterior angle?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a, -a, b, -b], 0),
        explanation: `Add the two remote interior angles: ${a} + ${b} = ${correct}.`,
        strategyTags: ["use the exterior-angle theorem", "add the remote angles"],
        trapWarning: "The adjacent interior angle is not one of the remote angles."
      };
    }),
    family("similar_scale", (ctx, rng) => {
      const small = rng.int(3, 8);
      const factor = rng.int(2, 5);
      const correct = small * factor;
      return {
        prompt: `Two similar triangles have a scale factor of ${factor}. If a side on the smaller triangle is ${small}, what is the matching side on the larger triangle?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [small, -small, factor, -1], 0),
        explanation: `Corresponding sides in similar figures scale by the same factor.`,
        strategyTags: ["match corresponding sides", "scale by the similarity factor"],
        trapWarning: "Only corresponding sides can be matched."
      };
    }),
    family("circle_arc_fraction", (ctx, rng) => {
      const fraction = rng.pick([
        [1, 4],
        [1, 3],
        [1, 2],
        [3, 4]
      ]);
      const correct = String((360 * fraction[0]) / fraction[1]);
      return {
        prompt: `An arc is ${fractionText(fraction[0], fraction[1])} of a full circle. How many degrees is the arc?`,
        correct,
        distractors: numericDistractors(Number(correct), [30, -30, 60, -60], 0, 360),
        explanation: `A full circle is 360°, so multiply 360 by the fraction of the circle.`,
        strategyTags: ["fraction of 360", "match part of a whole circle"],
        trapWarning: "Use 360° for a full circle, not 180°."
      };
    }),
    family("angle_chase", (ctx, rng) => {
      const a = rng.int(30, 70);
      const correct = 180 - a;
      return {
        prompt: `Two angles form a straight line. One angle is ${a}°. What is the other?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [10, -10, a, -a], 0),
        explanation: `Angles on a straight line sum to 180°, so the other angle is ${correct}°.`,
        strategyTags: ["use the straight-line sum", "subtract from 180"],
        trapWarning: "A linear pair adds to 180°, not 360°."
      };
    })
  ];
}

function analyticGeometryFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("distance_axis_aligned", (ctx, rng) => {
      const x1 = rng.int(0, 4);
      const x2 = x1 + rng.int(2, 7);
      const y = rng.int(0, 6);
      const correct = x2 - x1;
      return {
        prompt: `What is the distance between (${x1}, ${y}) and (${x2}, ${y})?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [1, -1, y, -y], 0),
        explanation: `Same y-coordinate means horizontal distance only: |${x2} - ${x1}| = ${correct}.`,
        strategyTags: ["use the changed coordinate only", "absolute difference gives distance"],
        trapWarning: "If one coordinate matches, distance is the difference in the other coordinate."
      };
    }),
    family("midpoint_point", (ctx, rng) => {
      const x1 = rng.int(0, 4);
      const y1 = rng.int(0, 4);
      const x2 = x1 + rng.int(2, 6);
      const y2 = y1 + rng.int(2, 6);
      const correct = `(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`;
      return {
        prompt: `Find the midpoint of (${x1}, ${y1}) and (${x2}, ${y2}).`,
        correct,
        distractors: textDistractors(correct, [`(${x1 + x2}, ${y1 + y2})`, `(${x2 - x1}, ${y2 - y1})`, `(${x1}, ${(y1 + y2) / 2})`, `(${(x1 + x2) / 2}, ${y2})`]),
        explanation: `Average the coordinates to get the midpoint.`,
        strategyTags: ["average x-values and y-values", "midpoint means halfway"],
        trapWarning: "Midpoint uses averages, not sums."
      };
    }),
    family("slope_parallel", (ctx, rng) => {
      const slope = rng.pick(["1/2", "2", "-1", "-3", "3/4"]);
      return {
        prompt: `A line is parallel to a line with slope ${slope}. What is its slope?`,
        correct: slope,
        distractors: textDistractors(slope, [slope === "1/2" ? "2" : "1/2", slope === "-1" ? "1" : "-1", "0", "undefined"]),
        explanation: `Parallel lines have the same slope.`,
        strategyTags: ["parallel keeps the same steepness", "copy the slope"],
        trapWarning: "Perpendicular, not parallel, changes to the negative reciprocal."
      };
    }),
    family("perpendicular_slope", (ctx, rng) => {
      return {
        prompt: `What is the slope of a line perpendicular to a line with slope 2?`,
        correct: "-1/2",
        distractors: textDistractors("-1/2", ["1/2", "-2", "2", "0"]),
        explanation: `Perpendicular slopes are negative reciprocals, so 2 becomes -1/2.`,
        strategyTags: ["flip and change sign", "use negative reciprocal"],
        trapWarning: "Perpendicular slopes are not just negatives or just reciprocals; they are both."
      };
    }),
    family("circle_radius", (ctx, rng) => {
      const radius = rng.int(3, 9);
      const correct = 2 * radius;
      return {
        prompt: `A circle has radius ${radius}. What is its diameter?`,
        correct: String(correct),
        distractors: numericDistractors(correct, [radius, -radius, 1, -1], 0),
        explanation: `The diameter is twice the radius, so ${correct}.`,
        strategyTags: ["diameter is two radii", "double the radius"],
        trapWarning: "Radius is from center to circle; diameter is all the way across."
      };
    })
  ];
}

function advancedAlgebraFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("identity_substitution", (ctx, rng) => {
      const a = rng.int(2, 7);
      const b = rng.int(2, 7);
      const correct = a * a - b * b;
      return {
        prompt: `Evaluate (a - b)(a + b) when a = ${a} and b = ${b}.`,
        correct: String(correct),
        distractors: numericDistractors(correct, [a + b, -(a + b), a * b, -a * b], -100, 200),
        explanation: `Either substitute directly or use the difference-of-squares identity.`,
        strategyTags: ["spot algebraic structure", "substitute carefully"],
        trapWarning: "Keep the parentheses and signs when substituting."
      };
    }),
    family("parameter_equation", (ctx, rng) => {
      const x = rng.int(2, 8);
      const k = rng.int(2, 6);
      const total = k * x + 5;
      return {
        prompt: `If kx + 5 = ${total} and k = ${k}, what is x?`,
        correct: String(x),
        distractors: numericDistractors(x, [1, -1, k, -k], -20, 40),
        explanation: `Substitute the parameter k, then solve the resulting linear equation.`,
        strategyTags: ["replace the parameter first", "solve the simpler equation"],
        trapWarning: "Use the parameter's value before rearranging."
      };
    }),
    family("identity_pattern", (ctx, rng) => {
      return {
        prompt: `Which expression is equal to (x + 3)^2?`,
        correct: "x^2 + 6x + 9",
        distractors: textDistractors("x^2 + 6x + 9", ["x^2 + 9", "x^2 + 3x + 9", "x^2 + 6x + 3", "2x + 9"]),
        explanation: `(x + 3)^2 = x^2 + 2·3·x + 3^2 = x^2 + 6x + 9.`,
        strategyTags: ["use the square of a binomial", "middle term is twice the product"],
        trapWarning: "Squaring a sum produces a middle term."
      };
    }),
    family("evaluate_rational", (ctx, rng) => {
      const x = rng.int(2, 8);
      const correct = formatDecimal((x + 1) / (x - 1));
      return {
        prompt: `Evaluate (x + 1)/(x - 1) when x = ${x}.`,
        correct,
        distractors: textDistractors(correct, [formatDecimal((x - 1) / (x + 1)), formatDecimal((x + 1) / x), formatDecimal((x - 1) / x), String(x)]),
        explanation: `Substitute x and simplify the fraction.`,
        strategyTags: ["substitute with parentheses", "simplify after substitution"],
        trapWarning: "Keep numerator and denominator grouped when substituting."
      };
    }),
    family("formula_card", (ctx, rng) => {
      return {
        prompt: `If u + v = 10 and uv = 21, what is u^2 + v^2?`,
        correct: "58",
        distractors: textDistractors("58", ["100", "42", "79", "31"]),
        explanation: `Use u^2 + v^2 = (u + v)^2 - 2uv = 100 - 42 = 58.`,
        strategyTags: ["rewrite the target with a known identity", "substitute the given totals"],
        trapWarning: "Use the identity before guessing u and v individually.",
        format: "svg",
        visualAssetSpec: formulaVisual(["u² + v² = (u + v)² - 2uv", "100 - 42 = 58"], "identity")
      };
    }, "svg")
  ];
}

function functionsAdvancedFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("function_shift", (ctx, rng) => ({
      prompt: `If f(x) = x^2, which rule describes the graph shifted up by 3?`,
      correct: "x^2 + 3",
      distractors: textDistractors("x^2 + 3", ["(x + 3)^2", "x^2 - 3", "(x - 3)^2", "3x^2"]),
      explanation: `A vertical shift up by 3 adds 3 outside the function.`,
      strategyTags: ["inside changes horizontal, outside changes vertical", "track the shift direction"],
      trapWarning: "Adding inside the square shifts left/right, not up/down."
    })),
    family("composition", (ctx, rng) => ({
      prompt: `If f(x) = 2x + 1 and g(x) = x - 3, what is f(g(5))?`,
      correct: "5",
      distractors: textDistractors("5", ["8", "11", "3", "7"]),
      explanation: `First find g(5) = 2, then apply f to get 5.`,
      strategyTags: ["work from the inside out", "evaluate step by step"],
      trapWarning: "Function composition is nested; compute the inner value first."
    })),
    family("inverse_match", (ctx, rng) => ({
      prompt: `If f(x) = x + 7, what is f⁻¹(x)?`,
      correct: "x - 7",
      distractors: textDistractors("x - 7", ["x + 7", "7 - x", "1/(x + 7)", "x/7"]),
      explanation: `The inverse undoes the +7, so it subtracts 7.`,
      strategyTags: ["inverse undoes the original rule", "reverse the operation"],
      trapWarning: "An inverse reverses the operation; it does not repeat it."
    })),
    family("table_compare", (ctx, rng) => {
      const x = rng.int(2, 6);
      const correct = String(2 * x + 1);
      return {
        prompt: `Function A follows y = 2x + 1. What is A(${x})?`,
        correct,
        distractors: numericDistractors(Number(correct), [1, -1, 2, -2], -20, 80),
        explanation: `Substitute x = ${x} into the function rule.`,
        strategyTags: ["plug in the input", "follow the rule exactly"],
        trapWarning: "The input is x only; do not reuse a previous output value."
      };
    }),
    family("transformation_visual", (ctx, rng) => ({
      prompt: `Which point lies on y = x + 2?`,
      correct: "(1, 3)",
      distractors: textDistractors("(1, 3)", ["(1, 2)", "(2, 2)", "(0, 0)", "(3, 1)"]),
      explanation: `Substitute x = 1 to check that y must be 3.`,
      strategyTags: ["test candidate points", "check the rule with substitution"],
      trapWarning: "A point is on the graph only if its coordinates satisfy the equation."
    }))
  ];
}

function polynomialFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("root_test", (ctx, rng) => ({
      prompt: `Which number is a root of x^2 - 5x + 6 = 0?`,
      correct: "2",
      distractors: textDistractors("2", ["1", "4", "5", "6"]),
      explanation: `Factor to (x - 2)(x - 3) = 0, so the roots are 2 and 3.`,
      strategyTags: ["factor the polynomial", "set each factor equal to zero"],
      trapWarning: "A root makes the polynomial equal to zero."
    })),
    family("vieta_sum", (ctx, rng) => ({
      prompt: `A monic quadratic has roots 2 and 5. What is the sum of the roots?`,
      correct: "7",
      distractors: textDistractors("7", ["10", "3", "-7", "-10"]),
      explanation: `Add the roots directly: 2 + 5 = 7.`,
      strategyTags: ["track root relationships", "use the given roots directly"],
      trapWarning: "Do not multiply when the question asks for a sum."
    })),
    family("factor_match", (ctx, rng) => ({
      prompt: `Which factorization is correct for x^2 - 9?`,
      correct: "(x - 3)(x + 3)",
      distractors: textDistractors("(x - 3)(x + 3)", ["(x - 9)(x + 1)", "(x - 3)^2", "(x + 9)(x - 1)", "x(x - 9)"]),
      explanation: `x^2 - 9 is a difference of squares.`,
      strategyTags: ["spot special products", "difference of squares factors symmetrically"],
      trapWarning: "x^2 - a^2 does not factor as (x - a)^2."
    })),
    family("remainder_theorem", (ctx, rng) => ({
      prompt: `What is the remainder when x^2 + 3x + 2 is divided by x + 1?`,
      correct: "0",
      distractors: textDistractors("0", ["1", "2", "3", "-1"]),
      explanation: `Use the remainder theorem: evaluate at x = -1 to get 0.`,
      strategyTags: ["plug in the matching root", "use the remainder theorem"],
      trapWarning: "For x + 1, substitute x = -1."
    })),
    family("graph_value", (ctx, rng) => ({
      prompt: `If p(x) = x^2 - 4x, what is p(6)?`,
      correct: "12",
      distractors: textDistractors("12", ["8", "24", "36", "2"]),
      explanation: `Substitute x = 6: 36 - 24 = 12.`,
      strategyTags: ["substitute then simplify", "keep the minus sign with the second term"],
      trapWarning: "Do the square before subtracting 4x."
    }))
  ];
}

function trigFamilies(row: CoverageRow): BandFamilySpec[] {
  return [
    family("right_triangle_ratio", (ctx, rng) => ({
      prompt: `In a right triangle, the side opposite angle A is 6 and the hypotenuse is 10. What is sin A?`,
      correct: "3/5",
      distractors: textDistractors("3/5", ["5/3", "3/10", "2/5", "4/5"]),
      explanation: `sin A = opposite / hypotenuse = 6/10 = 3/5.`,
      strategyTags: ["match the trig ratio to the correct sides", "simplify the fraction"],
      trapWarning: "Do not swap opposite and adjacent."
    })),
    family("special_triangle", (ctx, rng) => ({
      prompt: `In a 45-45-90 triangle with legs 1 and 1, what is the hypotenuse?`,
      correct: "√2",
      distractors: textDistractors("√2", ["2", "1", "2√2", "√3"]),
      explanation: `Use the 45-45-90 triangle fact or the Pythagorean theorem.`,
      strategyTags: ["remember special right triangles", "or use a²+b²=c²"],
      trapWarning: "The hypotenuse is longer than a leg."
    })),
    family("cosine_ratio", (ctx, rng) => ({
      prompt: `In a right triangle, the side adjacent to angle B is 8 and the hypotenuse is 17. What is cos B?`,
      correct: "8/17",
      distractors: textDistractors("8/17", ["17/8", "15/17", "8/15", "9/17"]),
      explanation: `cos B = adjacent / hypotenuse = 8/17.`,
      strategyTags: ["cosine uses adjacent over hypotenuse", "name the sides from the angle"],
      trapWarning: "Adjacent depends on which angle you are using."
    })),
    family("angle_sum", (ctx, rng) => ({
      prompt: `Two acute angles in a right triangle measure 32° and ?. What is the missing angle?`,
      correct: "58",
      distractors: textDistractors("58", ["90", "122", "48", "32"]),
      explanation: `The acute angles in a right triangle add to 90°, so the missing angle is 58°.`,
      strategyTags: ["use the right-angle total", "subtract from 90"],
      trapWarning: "The two acute angles share the remaining 90° together."
    })),
    family("trig_geometry_card", (ctx, rng) => ({
      prompt: `Which formula is correct for the Pythagorean theorem?`,
      correct: "a² + b² = c²",
      distractors: textDistractors("a² + b² = c²", ["a + b = c", "2a + 2b = c²", "a² - b² = c²", "ab = c²"]),
      explanation: `For a right triangle, the squares on the legs add to the square on the hypotenuse.`,
      strategyTags: ["match the right-triangle identity", "use squared lengths"],
      trapWarning: "The theorem uses squares of side lengths.",
      format: "svg",
      visualAssetSpec: formulaVisual(["a² + b² = c²", "right triangle"], "theorem")
    }), "svg")
  ];
}

export function familiesForSkill(row: CoverageRow): BandFamilySpec[] {
  const archetype = ARCHETYPE_BY_SKILL[row.skillId] || "logic";
  switch (archetype) {
    case "arithmetic": return arithmeticFamilies(row);
    case "multiplicative": return multiplicativeFamilies(row);
    case "place_value": return placeValueFamilies(row);
    case "fractions_basic": return fractionsBasicFamilies(row);
    case "measurement": return measurementFamilies(row);
    case "geometry_basic": return geometryBasicFamilies(row);
    case "algebra_intro": return algebraIntroFamilies(row);
    case "data_logic": return dataLogicFamilies(row);
    case "logic": return logicFamilies(row);
    case "coordinates_basic": return coordinatesBasicFamilies(row);
    case "spatial": return spatialFamilies(row);
    case "number_theory": return numberTheoryFamilies(row);
    case "fractions_advanced": return fractionsAdvancedFamilies(row);
    case "decimal_percent": return decimalPercentFamilies(row);
    case "ratio_rate": return ratioFamilies(row);
    case "algebra_linear": return algebraLinearFamilies(row);
    case "geometry_measurement": return geometryMeasurementFamilies(row);
    case "graphs": return graphsFamilies(row);
    case "counting_probability": return countingProbabilityFamilies(row);
    case "functions_sequences": return functionsSequenceFamilies(row);
    case "integers_rationals": return integerFamilies(row);
    case "systems": return systemsFamilies(row);
    case "quadratic": return quadraticFamilies(row);
    case "exponents_surds": return exponentsFamilies(row);
    case "inequalities": return inequalitiesFamilies(row);
    case "geometry_angles": return geometryAnglesFamilies(row);
    case "analytic_geometry": return analyticGeometryFamilies(row);
    case "advanced_algebra": return advancedAlgebraFamilies(row);
    case "functions_advanced": return functionsAdvancedFamilies(row);
    case "polynomial": return polynomialFamilies(row);
    case "trig_geometry": return trigFamilies(row);
    default: return logicFamilies(row);
  }
}

export function buildFamilyLibrary(coverageMap: BandCoverageMap): BandFamilyLibrary {
  const library: BandFamilyLibrary = {};
  for (const row of coverageMap.curriculum) {
    library[row.skillId] = familiesForSkill(row).slice(0, row.requiredFamilies);
  }
  return library;
}

export function buildAutoBlueprint(coverageMap: BandCoverageMap, library: BandFamilyLibrary) {
  const high = coverageMap.curriculum.filter((row) => row.highValue);
  const rest = coverageMap.curriculum.filter((row) => !row.highValue);
  const ordered = [...high, ...rest];
  const blueprint = [] as Array<{ skillId: string; familyId: string; pointTier: 3 | 4 | 5 }>;
  for (let index = 0; index < coverageMap.contestQuestions; index += 1) {
    const row = ordered[index % ordered.length];
    const families = library[row.skillId];
    const familyId = families[Math.floor(index / ordered.length) % families.length]?.familyId || families[0].familyId;
    const pointTier = index < coverageMap.contestQuestions / 3 ? 3 : index < (coverageMap.contestQuestions * 2) / 3 ? 4 : 5;
    blueprint.push({ skillId: row.skillId, familyId, pointTier: pointTier as 3 | 4 | 5 });
  }
  return blueprint;
}
