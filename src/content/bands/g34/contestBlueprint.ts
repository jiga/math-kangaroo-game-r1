import { buildAutoBlueprint } from '../archetypes';
import { coverageMap, FAMILY_LIBRARY } from './families';

export const CONTEST_BLUEPRINT = buildAutoBlueprint(coverageMap, FAMILY_LIBRARY);
