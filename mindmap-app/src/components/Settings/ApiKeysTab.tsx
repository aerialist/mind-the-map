import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Trash2, AlertCircle } from 'lucide-react';
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  isKeyringAvailable,
  type ApiKeyName,
} from '../../services/settings';

interface ApiKeyConfig {
  name: ApiKeyName;
  label: string;
  description: string;
  placeholder: string;
}

const apiKeyConfigs: ApiKeyConfig[] = [
  {
    name: 'openai',
    label: 'OpenAI API Key',
    description: 'For AI-powered features (coming soon)',
    placeholder: 'sk-...',
  },
  {
    name: 'anthropic',
    label: 'Anthropic API Key',
    description: 'For Claude AI features (coming soon)',
    placeholder: 'sk-ant-...',
  },
];

export function ApiKeysTab() {
  const [keyringAvailable, setKeyringAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isKeyringAvailable().then(setKeyringAvailable);
  }, []);

  if (keyringAvailable === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Checking keyring availability...
        </div>
      </div>
    );
  }

  if (!keyringAvailable) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Secure storage unavailable
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              API key storage requires access to the system keychain, which is not available
              in portable mode or in some environments.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        API keys are securely stored in your system keychain and never sent anywhere
        except to the respective API services.
      </p>

      <div className="space-y-4">
        {apiKeyConfigs.map((config) => (
          <ApiKeyInput key={config.name} config={config} />
        ))}
      </div>
    </div>
  );
}

function ApiKeyInput({ config }: { config: ApiKeyConfig }) {
  const [value, setValue] = useState('');
  const [isSet, setIsSet] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if key is already set on mount
  useEffect(() => {
    hasApiKey(config.name).then((hasKey) => {
      setIsSet(hasKey);
      setIsLoading(false);
    });
  }, [config.name]);

  const handleSave = async () => {
    if (!value || value.startsWith('\u2022')) return;

    setIsSaving(true);
    const success = await setApiKey(config.name, value);
    setIsSaving(false);

    if (success) {
      setIsSet(true);
      setValue('');
      setShowValue(false);
    }
  };

  const handleDelete = async () => {
    await deleteApiKey(config.name);
    setIsSet(false);
    setValue('');
  };

  const handleEdit = async () => {
    // Load actual value for editing
    const currentValue = await getApiKey(config.name);
    if (currentValue) {
      setValue(currentValue);
      setShowValue(true);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg h-20" />
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {config.label}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {config.description}
          </p>
        </div>
        {isSet && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="w-3 h-3" />
            Set
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isSet ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : config.placeholder}
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
            onClick={() => setShowValue(!showValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {isSet && !value && (
          <button
            onClick={handleEdit}
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

        {value && !value.startsWith('\u2022') && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="
              px-3 py-2 text-sm rounded-md
              bg-blue-500 hover:bg-blue-600 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        )}

        {isSet && (
          <button
            onClick={handleDelete}
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
    </div>
  );
}
