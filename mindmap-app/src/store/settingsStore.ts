/**
 * Zustand store for settings state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AppSettings,
  GeneralSettings,
  AppearanceSettings,
  MindmapSettings,
} from '../services/settings/types';
import {
  loadSettings,
  updateGeneralSettings as persistGeneralSettings,
  updateAppearanceSettings as persistAppearanceSettings,
  updateMindmapSettings as persistMindmapSettings,
  addRecentFile as persistAddRecentFile,
  removeRecentFile as persistRemoveRecentFile,
  clearRecentFiles as persistClearRecentFiles,
  DEFAULT_SETTINGS,
} from '../services/settings';

interface SettingsState {
  // Settings data
  settings: AppSettings;
  isLoading: boolean;
  isSettingsOpen: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateGeneralSettings: (values: Partial<GeneralSettings>) => Promise<void>;
  updateAppearanceSettings: (values: Partial<AppearanceSettings>) => Promise<void>;
  updateMindmapSettings: (values: Partial<MindmapSettings>) => Promise<void>;
  addRecentFile: (filePath: string) => Promise<void>;
  removeRecentFile: (filePath: string) => Promise<void>;
  clearRecentFiles: () => Promise<void>;

  // Dialog state
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set) => ({
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    isSettingsOpen: false,

    loadSettings: async () => {
      try {
        const settings = await loadSettings();
        set({ settings, isLoading: false });
      } catch (error) {
        console.error('Failed to load settings:', error);
        set({ isLoading: false });
      }
    },

    updateGeneralSettings: async (values) => {
      await persistGeneralSettings(values);
      set((state) => {
        state.settings.general = { ...state.settings.general, ...values };
      });
    },

    updateAppearanceSettings: async (values) => {
      await persistAppearanceSettings(values);
      set((state) => {
        state.settings.appearance = { ...state.settings.appearance, ...values };
      });
    },

    updateMindmapSettings: async (values) => {
      await persistMindmapSettings(values);
      set((state) => {
        state.settings.mindmap = { ...state.settings.mindmap, ...values };
      });
    },

    addRecentFile: async (filePath) => {
      await persistAddRecentFile(filePath);
      set((state) => {
        const filtered = state.settings.recentFiles.filter((f) => f !== filePath);
        state.settings.recentFiles = [filePath, ...filtered].slice(0, 10);
      });
    },

    removeRecentFile: async (filePath) => {
      await persistRemoveRecentFile(filePath);
      set((state) => {
        state.settings.recentFiles = state.settings.recentFiles.filter((f) => f !== filePath);
      });
    },

    clearRecentFiles: async () => {
      await persistClearRecentFiles();
      set((state) => {
        state.settings.recentFiles = [];
      });
    },

    openSettings: () => {
      set({ isSettingsOpen: true });
    },

    closeSettings: () => {
      set({ isSettingsOpen: false });
    },

    toggleSettings: () => {
      set((state) => {
        state.isSettingsOpen = !state.isSettingsOpen;
      });
    },
  }))
);
