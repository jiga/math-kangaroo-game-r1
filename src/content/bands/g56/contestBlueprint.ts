import coverageMap from './coverage-map.json';
import { buildAutoBlueprint } from '../archetypes';
import { FAMILY_LIBRARY } from './families';

export const CONTEST_BLUEPRINT = buildAutoBlueprint(coverageMap, FAMILY_LIBRARY);
