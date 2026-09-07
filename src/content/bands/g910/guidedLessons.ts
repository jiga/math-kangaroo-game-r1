import { coverageMap } from './families';
import { buildGuidedTopics } from '../guidedFactory';

export const GUIDED_TOPICS = buildGuidedTopics(coverageMap);
