/**
 * Settings schema migrations
 *
 * When SETTINGS_VERSION is incremented, add a migration function here
 * to transform old settings to the new format.
 */

import type { Store } from '@tauri-apps/plugin-store';
import { SETTINGS_VERSION, DEFAULT_SETTINGS } from './types';

type MigrationFn = (store: Store) => Promise<void>;

// Map of version -> migration function to get TO that version
const migrations: Record<number, MigrationFn> = {
  // Example: migrate from v0 (no version) to v1
  1: async (store: Store) => {
    // v1 is the initial version, just ensure defaults are set
    const general = await store.get('general');
    if (!general) {
      await store.set('general', DEFAULT_SETTINGS.general);
    }

    const appearance = await store.get('appearance');
    if (!appearance) {
      await store.set('appearance', DEFAULT_SETTINGS.appearance);
    }

    const mindmap = await store.get('mindmap');
    if (!mindmap) {
      await store.set('mindmap', DEFAULT_SETTINGS.mindmap);
    }

    const recentFiles = await store.get('recentFiles');
    if (!recentFiles) {
      await store.set('recentFiles', []);
    }

    await store.set('version', 1);
  },

  // Add future migrations here:
  // 2: async (store: Store) => {
  //   // Migrate from v1 to v2
  //   await store.set('version', 2);
  // },
};

/**
 * Run all necessary migrations to bring settings up to current version
 */
export async function migrateSettings(store: Store, fromVersion: number): Promise<void> {
  let currentVersion = fromVersion;

  while (currentVersion < SETTINGS_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrateFn = migrations[nextVersion];

    if (migrateFn) {
      console.log(`Migrating settings from v${currentVersion} to v${nextVersion}`);
      await migrateFn(store);
    }

    currentVersion = nextVersion;
  }

  await store.save();
}
