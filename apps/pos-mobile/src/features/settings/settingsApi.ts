import { createSettingsApi } from '@indyzai/feature-organization/settingsApi';
import { requestPos } from '../../core/api/posApi';
export const settingsApi = createSettingsApi(requestPos, 'pos');
