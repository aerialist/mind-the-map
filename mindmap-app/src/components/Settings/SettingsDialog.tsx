import { useEffect, useRef, useState } from 'react';
import { Settings, Palette, Key, ListTree } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { GeneralTab } from './GeneralTab';
import { AppearanceTab } from './AppearanceTab';
import { ApiKeysTab } from './ApiKeysTab';
import { WorkflowyTab } from './WorkflowyTab';

type TabId = 'general' | 'appearance' | 'workflowy' | 'apikeys';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { id: 'workflowy', label: 'Workflowy', icon: <ListTree className="w-4 h-4" /> },
  { id: 'apikeys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
];

export function SettingsDialog() {
  const isSettingsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const closeSettings = useSettingsStore((s) => s.closeSettings);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isSettingsOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isSettingsOpen && dialog.open) {
      dialog.close();
    }
  }, [isSettingsOpen]);

  // Handle click outside dialog to close
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const clickedInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!clickedInDialog) {
      closeSettings();
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSettings();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSettingsOpen, closeSettings]);

  // Reset to first tab when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setActiveTab('general');
    }
  }, [isSettingsOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="
        p-0 m-0 bg-transparent border-none outline-none backdrop:bg-black/20 backdrop:backdrop-blur-sm
        open:animate-in open:fade-in open:duration-200
      "
      onClick={handleDialogClick}
    >
      <div
        className="
          bg-white dark:bg-gray-800 rounded-xl shadow-2xl m-4
          w-[600px] max-w-[90vw] border border-gray-200 dark:border-gray-700
          overflow-hidden
        "
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preferences
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                border-b-2 -mb-px
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[300px] max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'workflowy' && <WorkflowyTab />}
          {activeTab === 'apikeys' && <ApiKeysTab />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={closeSettings}
            className="
              px-4 py-2 text-sm font-medium rounded-md
              bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors
            "
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
