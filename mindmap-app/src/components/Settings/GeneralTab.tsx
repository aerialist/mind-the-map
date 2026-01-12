import { useSettingsStore } from '../../store/settingsStore';

export function GeneralTab() {
  const settings = useSettingsStore((s) => s.settings);
  const updateGeneralSettings = useSettingsStore((s) => s.updateGeneralSettings);

  const handleAutoSaveChange = (enabled: boolean) => {
    updateGeneralSettings({ autoSaveEnabled: enabled });
  };

  const handleAutoSaveIntervalChange = (intervalMs: number) => {
    updateGeneralSettings({ autoSaveIntervalMs: intervalMs });
  };

  const handleCheckForUpdatesChange = (enabled: boolean) => {
    updateGeneralSettings({ checkForUpdates: enabled });
  };

  return (
    <div className="space-y-6">
      {/* Auto-save */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Auto-save
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.general.autoSaveEnabled}
            onChange={(e) => handleAutoSaveChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Enable auto-save
          </span>
        </label>

        <div className="flex items-center gap-3 ml-7">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Save interval:
          </label>
          <select
            value={settings.general.autoSaveIntervalMs}
            onChange={(e) => handleAutoSaveIntervalChange(Number(e.target.value))}
            disabled={!settings.general.autoSaveEnabled}
            className="
              px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <option value={1000}>1 second</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={120000}>2 minutes</option>
            <option value={300000}>5 minutes</option>
          </select>
        </div>
      </div>

      {/* Updates */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Updates
        </h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.general.checkForUpdates}
            onChange={(e) => handleCheckForUpdatesChange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Check for updates on startup
          </span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
          Coming soon - update checking is not yet implemented
        </p>
      </div>
    </div>
  );
}
