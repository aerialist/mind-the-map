import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Trash2, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  isKeyringAvailable,
} from '../../services/settings';

export function WorkflowyTab() {
  const settings = useSettingsStore((s) => s.settings);
  const updateWorkflowySettings = useSettingsStore((s) => s.updateWorkflowySettings);

  const [keyringAvailable, setKeyringAvailable] = useState<boolean | null>(null);

  // API Key state
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);

  // Target Bullet ID state
  const [targetBulletId, setTargetBulletId] = useState(settings.workflowy.targetBulletId);

  useEffect(() => {
    isKeyringAvailable().then(setKeyringAvailable);
    hasApiKey('workflowy').then((hasKey) => {
      setIsApiKeySet(hasKey);
      setIsLoadingApiKey(false);
    });
  }, []);

  // Sync local state with settings
  useEffect(() => {
    setTargetBulletId(settings.workflowy.targetBulletId);
  }, [settings.workflowy.targetBulletId]);

  const handleTargetBulletIdChange = (value: string) => {
    setTargetBulletId(value);
  };

  const handleTargetBulletIdBlur = () => {
    // Normalize: remove leading # if present
    let normalized = targetBulletId.trim();
    if (normalized.startsWith('#')) {
      normalized = normalized.slice(1);
    }
    updateWorkflowySettings({ targetBulletId: normalized });
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyValue || apiKeyValue.startsWith('\u2022')) return;

    setIsSavingApiKey(true);
    const success = await setApiKey('workflowy', apiKeyValue);
    setIsSavingApiKey(false);

    if (success) {
      setIsApiKeySet(true);
      setApiKeyValue('');
      setShowApiKey(false);
    }
  };

  const handleDeleteApiKey = async () => {
    await deleteApiKey('workflowy');
    setIsApiKeySet(false);
    setApiKeyValue('');
  };

  const handleEditApiKey = async () => {
    const currentValue = await getApiKey('workflowy');
    if (currentValue) {
      setApiKeyValue(currentValue);
      setShowApiKey(true);
    }
  };

  if (keyringAvailable === null || isLoadingApiKey) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Configure Workflowy integration settings for import/export functionality.
      </p>

      {/* API Key Section */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              API Key
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required for Workflowy import/export
            </p>
          </div>
          {isApiKeySet && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Check className="w-3 h-3" />
              Set
            </span>
          )}
        </div>

        {!keyringAvailable ? (
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Secure storage unavailable. API keys cannot be saved in portable mode.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder={isApiKeySet ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Enter API key...'}
                className="
                  w-full px-3 py-2 pr-10 text-sm rounded-md
                  border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-700
                  text-gray-900 dark:text-white
                  placeholder:text-gray-400 dark:placeholder:text-gray-500
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                "
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {isApiKeySet && !apiKeyValue && (
              <button
                onClick={handleEditApiKey}
                className="
                  px-3 py-2 text-sm rounded-md
                  border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors
                "
              >
                Edit
              </button>
            )}

            {apiKeyValue && !apiKeyValue.startsWith('\u2022') && (
              <button
                onClick={handleSaveApiKey}
                disabled={isSavingApiKey}
                className="
                  px-3 py-2 text-sm rounded-md
                  bg-blue-500 hover:bg-blue-600 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isSavingApiKey ? 'Saving...' : 'Save'}
              </button>
            )}

            {isApiKeySet && (
              <button
                onClick={handleDeleteApiKey}
                className="
                  p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20
                  rounded-md transition-colors
                "
                title="Delete API key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Target Bullet ID Section */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Target Bullet ID
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The Workflowy bullet (projectid) to sync with. Find this in the URL when viewing a bullet.
          </p>
        </div>

        <input
          type="text"
          value={targetBulletId}
          onChange={(e) => handleTargetBulletIdChange(e.target.value)}
          onBlur={handleTargetBulletIdBlur}
          placeholder="e.g., 8371678f-2aa6-1d44-8073-50274ebb91fa"
          className="
            w-full px-3 py-2 text-sm rounded-md font-mono
            border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
          "
        />

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Example URL: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">workflowy.com/#/8371678f-2aa6-1d44-8073-50274ebb91fa</code>
        </p>
      </div>
    </div>
  );
}
