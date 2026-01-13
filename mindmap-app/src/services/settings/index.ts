/**
 * Settings service - manages persistent app settings
 *
 * Non-sensitive settings (theme, preferences) are stored in a JSON file.
 * Sensitive settings (API keys) are stored in the OS keychain.
 */

// Types
export type {
  AppSettings,
  GeneralSettings,
  AppearanceSettings,
  MindmapSettings,
  WorkflowySettings,
} from './types';
export { DEFAULT_SETTINGS, SETTINGS_VERSION, MAX_RECENT_FILES } from './types';

// Non-sensitive settings (JSON file)
export {
  loadSettings,
  updateGeneralSettings,
  updateAppearanceSettings,
  updateMindmapSettings,
  updateWorkflowySettings,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  resetSettings,
} from './settingsStore';

// Sensitive settings (OS keychain)
export type { ApiKeyName } from './secretsStore';
export {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  isKeyringAvailable,
} from './secretsStore';
