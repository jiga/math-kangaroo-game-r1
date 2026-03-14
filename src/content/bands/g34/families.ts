import coverageMap from './coverage-map.json';
import { buildFamilyLibrary } from '../archetypes';

export const FAMILY_LIBRARY = buildFamilyLibrary(coverageMap);
