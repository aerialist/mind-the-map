import { Monitor, Sun, Moon } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

type Theme = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large';

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
];

const fontSizeOptions: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '14px' },
  { value: 'medium', label: 'Medium', description: '16px' },
  { value: 'large', label: 'Large', description: '18px' },
];

export function AppearanceTab() {
  const settings = useSettingsStore((s) => s.settings);
  const updateAppearanceSettings = useSettingsStore((s) => s.updateAppearanceSettings);

  const handleThemeChange = (theme: Theme) => {
    updateAppearanceSettings({ theme });
  };

  const handleFontSizeChange = (fontSize: FontSize) => {
    updateAppearanceSettings({ fontSize });
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Theme
        </h3>

        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleThemeChange(option.value)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
                ${
                  settings.appearance.theme === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              {option.icon}
              <span className="text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Font Size
        </h3>

        <div className="space-y-2">
          {fontSizeOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="fontSize"
                checked={settings.appearance.fontSize === option.value}
                onChange={() => handleFontSizeChange(option.value)}
                className="w-4 h-4 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {option.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({option.description})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Animations (from mindmap settings) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Animations
        </h3>

        <AnimationsToggle />
      </div>
    </div>
  );
}

function AnimationsToggle() {
  const settings = useSettingsStore((s) => s.settings);
  const updateMindmapSettings = useSettingsStore((s) => s.updateMindmapSettings);

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={settings.mindmap.animationsEnabled}
        onChange={(e) => updateMindmapSettings({ animationsEnabled: e.target.checked })}
        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Enable animations in mind map view
      </span>
    </label>
  );
}
