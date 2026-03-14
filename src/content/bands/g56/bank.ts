import coverageMap from './coverage-map.json';
import { createBandBankApi } from '../common';
import { FAMILY_LIBRARY } from './families';
import { CONTEST_BLUEPRINT } from './contestBlueprint';

export const bank = createBandBankApi({
  bandId: 'g56',
  coverageMap,
  familyLibrary: FAMILY_LIBRARY,
  contestBlueprint: CONTEST_BLUEPRINT
});
