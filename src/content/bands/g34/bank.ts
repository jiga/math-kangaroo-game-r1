import { createBandBankApi } from '../common';
import { coverageMap, FAMILY_LIBRARY } from './families';
import { CONTEST_BLUEPRINT } from './contestBlueprint';

export const bank = createBandBankApi({
  bandId: 'g34',
  coverageMap,
  familyLibrary: FAMILY_LIBRARY,
  contestBlueprint: CONTEST_BLUEPRINT
});
