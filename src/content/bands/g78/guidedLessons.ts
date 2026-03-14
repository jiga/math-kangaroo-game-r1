import coverageMap from './coverage-map.json';
import { buildGuidedTopics } from '../guidedFactory';

export const GUIDED_TOPICS = buildGuidedTopics(coverageMap);
