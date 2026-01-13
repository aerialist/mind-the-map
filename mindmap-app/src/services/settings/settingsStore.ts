/**
 * Non-sensitive settings storage using tauri-plugin-store
 *
 * Settings are stored in a JSON file in the app data directory:
 * - macOS: ~/Library/Application Support/com.shunya.mindmap-app/settings.json
 * - Windows: C:\Users\<User>\AppData\Roaming\com.shunya.mindmap-app\settings.json
 * - Linux: ~/.config/com.shunya.mindmap-app/settings.json
 */

import { load, type Store } from '@tauri-apps/plugin-store';
import { isTauriAvailable } from '../tauri/safeTauri';
import { migrateSettings } from './migrations';
import {
  type AppSettings,
  type GeneralSettings,
  type AppearanceSettings,
  type MindmapSettings,
  type WorkflowySettings,
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  MAX_RECENT_FILES,
} from './types';

let store: Store | null = null;

/**
 * Initialize and get the settings store
 */
async function getStore(): Promise<Store | null> {
  if (!isTauriAvailable()) {
    return null;
  }

  if (!store) {
    store = await load('settings.json', {
      defaults: {
        version: SETTINGS_VERSION,
        general: DEFAULT_SETTINGS.general,
        appearance: DEFAULT_SETTINGS.appearance,
        mindmap: DEFAULT_SETTINGS.mindmap,
        workflowy: DEFAULT_SETTINGS.workflowy,
        recentFiles: [],
      },
      autoSave: 100, // Auto-save with 100ms debounce
    });

    // Check for migrations
    const version = await store.get<number>('version') ?? 0;
    if (version < SETTINGS_VERSION) {
      await migrateSettings(store, version);
    }
  }

  return store;
}

/**
 * Load all settings from storage
 */
export async function loadSettings(): Promise<AppSettings> {
  const s = await getStore();

  if (!s) {
    // Return defaults for browser mode
    return { ...DEFAULT_SETTINGS };
  }

  return {
    version: SETTINGS_VERSION,
    general: await s.get<GeneralSettings>('general') ?? DEFAULT_SETTINGS.general,
    appearance: await s.get<AppearanceSettings>('appearance') ?? DEFAULT_SETTINGS.appearance,
    mindmap: await s.get<MindmapSettings>('mindmap') ?? DEFAULT_SETTINGS.mindmap,
    workflowy: await s.get<WorkflowySettings>('workflowy') ?? DEFAULT_SETTINGS.workflowy,
    recentFiles: await s.get<string[]>('recentFiles') ?? [],
  };
}

/**
 * Update general settings
 */
export async function updateGeneralSettings(values: Partial<GeneralSettings>): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const current = await s.get<GeneralSettings>('general') ?? DEFAULT_SETTINGS.general;
  await s.set('general', { ...current, ...values });
}

/**
 * Update appearance settings
 */
export async function updateAppearanceSettings(values: Partial<AppearanceSettings>): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const current = await s.get<AppearanceSettings>('appearance') ?? DEFAULT_SETTINGS.appearance;
  await s.set('appearance', { ...current, ...values });
}

/**
 * Update mindmap settings
 */
export async function updateMindmapSettings(values: Partial<MindmapSettings>): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const current = await s.get<MindmapSettings>('mindmap') ?? DEFAULT_SETTINGS.mindmap;
  await s.set('mindmap', { ...current, ...values });
}

/**
 * Update workflowy settings
 */
export async function updateWorkflowySettings(values: Partial<WorkflowySettings>): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const current = await s.get<WorkflowySettings>('workflowy') ?? DEFAULT_SETTINGS.workflowy;
  await s.set('workflowy', { ...current, ...values });
}

/**
 * Add a file to recent files list
 */
export async function addRecentFile(filePath: string): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const recentFiles = await s.get<string[]>('recentFiles') ?? [];

  // Remove if already exists (we'll add to front)
  const filtered = recentFiles.filter((f) => f !== filePath);

  // Add to front, limit to max
  const updated = [filePath, ...filtered].slice(0, MAX_RECENT_FILES);

  await s.set('recentFiles', updated);
}

/**
 * Remove a file from recent files list
 */
export async function removeRecentFile(filePath: string): Promise<void> {
  const s = await getStore();
  if (!s) return;

  const recentFiles = await s.get<string[]>('recentFiles') ?? [];
  const updated = recentFiles.filter((f) => f !== filePath);

  await s.set('recentFiles', updated);
}

/**
 * Clear all recent files
 */
export async function clearRecentFiles(): Promise<void> {
  const s = await getStore();
  if (!s) return;

  await s.set('recentFiles', []);
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const s = await getStore();
  if (!s) return;

  await s.set('version', SETTINGS_VERSION);
  await s.set('general', DEFAULT_SETTINGS.general);
  await s.set('appearance', DEFAULT_SETTINGS.appearance);
  await s.set('mindmap', DEFAULT_SETTINGS.mindmap);
  await s.set('workflowy', DEFAULT_SETTINGS.workflowy);
  // Note: We don't clear recentFiles on reset
}
