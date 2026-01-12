/**
 * Settings type definitions
 */

// Current settings schema version - increment when making breaking changes
export const SETTINGS_VERSION = 1;

export interface GeneralSettings {
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  checkForUpdates: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
}

export interface MindmapSettings {
  defaultZoom: number;
  animationsEnabled: boolean;
}

export interface AppSettings {
  version: number;
  general: GeneralSettings;
  appearance: AppearanceSettings;
  mindmap: MindmapSettings;
  recentFiles: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  general: {
    autoSaveEnabled: true,
    autoSaveIntervalMs: 1000,
    checkForUpdates: true,
  },
  appearance: {
    theme: 'system',
    fontSize: 'medium',
  },
  mindmap: {
    defaultZoom: 1.0,
    animationsEnabled: true,
  },
  recentFiles: [],
};

// Maximum number of recent files to track
export const MAX_RECENT_FILES = 10;
