import type { SkillId } from '../../domain/types';

export type G12CurriculumBullet = {
  id: string;
  label: string;
  skills: SkillId[];
  families: string[];
  guidedTopicIds: string[];
  guidedStageIds: string[];
};

export const G12_CURRICULUM_CHECKLIST: G12CurriculumBullet[] = [
  {
    id: 'counting_ordering',
    label: 'Counting to 20 and ordering small numbers; up to 30 for harder problems',
    skills: ['counting_ordering'],
    families: ['forward_sequence', 'backward_sequence', 'grouped_count', 'number_between'],
    guidedTopicIds: ['counting_patterns'],
    guidedStageIds: ['counting_patterns:rule', 'counting_patterns:rule-check']
  },
  {
    id: 'compare_sizes',
    label: 'Comparing sizes of small numbers and geometrical regions',
    skills: ['compare_number_region'],
    families: ['compare_numbers', 'place_value_compare', 'region_area_compare'],
    guidedTopicIds: ['compare_place_value', 'perimeter_regions'],
    guidedStageIds: ['compare_place_value:compare', 'compare_place_value:which', 'perimeter_regions:regions']
  },
  {
    id: 'ordinal_numbers',
    label: 'Ordinal numbers',
    skills: ['ordinal_numbers'],
    families: ['from_start', 'from_end'],
    guidedTopicIds: ['counting_patterns', 'number_line_positions'],
    guidedStageIds: ['counting_patterns:ordinal', 'number_line_positions:row-position']
  },
  {
    id: 'place_value',
    label: 'Place value (ones, tens, and up to hundreds for harder problems)',
    skills: ['place_value'],
    families: ['tens_and_ones', 'compose_number', 'place_value_compare'],
    guidedTopicIds: ['compare_place_value'],
    guidedStageIds: ['compare_place_value:compare', 'compare_place_value:digit-value']
  },
  {
    id: 'single_digit_add_sub',
    label: 'Simple addition and subtraction with two single-digit numbers',
    skills: ['single_digit_add_sub'],
    families: ['fact_fluency', 'missing_part', 'story_problem', 'multi_step_remaining'],
    guidedTopicIds: ['add_sub_balance'],
    guidedStageIds: ['add_sub_balance:parts', 'add_sub_balance:missing']
  },
  {
    id: 'number_line',
    label: 'Number line in simple applications',
    skills: ['number_line'],
    families: ['jump_direction', 'missing_start'],
    guidedTopicIds: ['number_line_positions'],
    guidedStageIds: ['number_line_positions:jumps', 'number_line_positions:land']
  },
  {
    id: 'fractions_words',
    label: 'Fractions using only the words half, third, quarter',
    skills: ['fractions_words'],
    families: ['fraction_of_total', 'whole_from_fraction', 'name_the_fraction', 'equal_shares_story'],
    guidedTopicIds: ['fractions_groups'],
    guidedStageIds: ['fractions_groups:fraction-bar', 'fractions_groups:fraction-word', 'fractions_groups:equal-groups']
  },
  {
    id: 'sorting_classifying',
    label: 'Ordering objects by one characteristic; sorting and classifying',
    skills: ['sorting_classifying'],
    families: ['exclusion_shelf', 'odd_one_out', 'belongs_to_group'],
    guidedTopicIds: ['sorting_sets_logic'],
    guidedStageIds: ['sorting_sets_logic:set-parts', 'sorting_sets_logic:exactly-one']
  },
  {
    id: 'measurement',
    label: 'Measurement: length, capacity, weight, temperature, time with small integers',
    skills: ['measurement_small', 'clock_full_half'],
    families: ['unit_compare', 'best_unit', 'temperature_compare', 'same_unit_sum', 'time_words_to_digital', 'half_hour_later', 'time_before', 'hour_later'],
    guidedTopicIds: ['measure_money_time'],
    guidedStageIds: ['measure_money_time:measure', 'measure_money_time:temperature', 'measure_money_time:time']
  },
  {
    id: 'patterns',
    label: 'Patterns numerical and geometrical without asking students to continue long sequences',
    skills: ['patterns'],
    families: ['growing_number_pattern', 'repeating_shape_pattern', 'growing_shape_count', 'repeat_number_pattern'],
    guidedTopicIds: ['counting_patterns'],
    guidedStageIds: ['counting_patterns:rule', 'counting_patterns:rule-check']
  },
  {
    id: 'perimeter_broken_lines',
    label: 'Perimeter and comparing length of broken lines',
    skills: ['perimeter_broken_lines'],
    families: ['broken_line_total', 'missing_segment', 'rectangle_perimeter', 'compare_path_lengths'],
    guidedTopicIds: ['perimeter_regions'],
    guidedStageIds: ['perimeter_regions:broken-line', 'perimeter_regions:perimeter-check']
  },
  {
    id: 'relative_position',
    label: 'Relative positions in a figure or in space',
    skills: ['relative_position'],
    families: ['middle_of_line', 'above_below', 'between_objects'],
    guidedTopicIds: ['number_line_positions'],
    guidedStageIds: ['number_line_positions:jumps', 'number_line_positions:row-position']
  },
  {
    id: 'shape_properties',
    label: 'Descriptive properties of geometrical figures',
    skills: ['shape_properties'],
    families: ['count_sides', 'shape_description', 'equal_sides_shape'],
    guidedTopicIds: ['shapes_space'],
    guidedStageIds: ['shapes_space:sides']
  },
  {
    id: 'maze_shape_puzzles',
    label: 'Puzzles with mazes or shapes',
    skills: ['maze_shape_puzzles'],
    families: ['turn_count', 'shortest_path_reasoning', 'right_turns_only'],
    guidedTopicIds: ['shapes_space'],
    guidedStageIds: ['shapes_space:maze']
  },
  {
    id: 'cube_cuboid_visualization',
    label: 'Simple spatial visualization of cubes and cuboids',
    skills: ['cube_cuboid_visualization'],
    families: ['count_marks_on_cube', 'cube_facts', 'hidden_faces', 'cuboid_facts', 'hidden_marks_total'],
    guidedTopicIds: ['shapes_space'],
    guidedStageIds: ['shapes_space:solid']
  },
  {
    id: 'likelihood_vocabulary',
    label: 'More likely, less likely, certain, impossible',
    skills: ['likelihood_vocabulary'],
    families: ['chance_words', 'bag_probability', 'equally_likely', 'most_likely_color'],
    guidedTopicIds: ['sorting_sets_logic', 'data_likelihood'],
    guidedStageIds: ['sorting_sets_logic:likely', 'data_likelihood:chance-words', 'data_likelihood:more-likely']
  },
  {
    id: 'pictographs_bar_graphs',
    label: 'Bars and graphs (pictographs)',
    skills: ['pictographs_bar_graphs'],
    families: ['largest_row', 'legend_total', 'total_all_rows'],
    guidedTopicIds: ['data_likelihood'],
    guidedStageIds: ['data_likelihood:legend', 'data_likelihood:row-total']
  },
  {
    id: 'venn_diagrams_easy',
    label: 'Venn diagrams (easy situations)',
    skills: ['venn_diagrams_easy'],
    families: ['in_both_sets', 'exactly_one_set', 'outside_both'],
    guidedTopicIds: ['sorting_sets_logic'],
    guidedStageIds: ['sorting_sets_logic:set-parts', 'sorting_sets_logic:exactly-one']
  },
  {
    id: 'calendar',
    label: 'Calendar (week, month, year)',
    skills: ['calendar'],
    families: ['days_forward', 'days_backward', 'month_order', 'week_year_facts', 'weekday_after_days'],
    guidedTopicIds: ['measure_money_time'],
    guidedStageIds: ['measure_money_time:calendar', 'measure_money_time:calendar-cycles']
  },
  {
    id: 'money_small',
    label: 'Money with small numbers',
    skills: ['money_small'],
    families: ['coin_total', 'enough_money', 'which_set_matches', 'change_from_coin'],
    guidedTopicIds: ['measure_money_time'],
    guidedStageIds: ['measure_money_time:money']
  },
  {
    id: 'clock_full_half',
    label: 'Clock faces with full and half hours only',
    skills: ['clock_full_half'],
    families: ['time_words_to_digital', 'half_hour_later', 'time_before', 'hour_later'],
    guidedTopicIds: ['measure_money_time'],
    guidedStageIds: ['measure_money_time:time']
  },
  {
    id: 'symmetry_rotation',
    label: 'Simple axial symmetry and rotated shapes',
    skills: ['symmetry_rotation'],
    families: ['mirror_word', 'line_of_symmetry_count', 'rotation_word'],
    guidedTopicIds: ['shapes_space'],
    guidedStageIds: ['shapes_space:symmetry', 'shapes_space:rotation']
  },
  {
    id: 'prealgebra_balance',
    label: 'Pre-algebra ideas like balances with equal, more, less',
    skills: ['prealgebra_balance'],
    families: ['missing_addend_equation', 'same_value_both_sides', 'balance_scale_story', 'equal_pairs_weights', 'missing_takeaway_balance'],
    guidedTopicIds: ['add_sub_balance'],
    guidedStageIds: ['add_sub_balance:balance']
  }
];
