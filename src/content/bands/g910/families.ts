import coverageMapJson from './coverage-map.json';
import { parseBandCoverageMap } from '../common';
import { buildFamilyLibrary } from '../archetypes';

export const coverageMap = parseBandCoverageMap(coverageMapJson);

export const FAMILY_LIBRARY = buildFamilyLibrary(coverageMap);
