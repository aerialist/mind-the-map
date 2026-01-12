/**
 * Secure secrets storage using tauri-plugin-keyring
 *
 * API keys and other sensitive data are stored in the OS keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service (libsecret)
 */

import { isTauriAvailable } from '../tauri/safeTauri';

const SERVICE = 'com.shunya.mindmap-app';

// Known API key names
export type ApiKeyName = 'openai' | 'anthropic' | 'workflowy';

/**
 * Get an API key from the keychain
 */
export async function getApiKey(name: ApiKeyName): Promise<string | null> {
  if (!isTauriAvailable()) {
    return null;
  }

  try {
    const { getPassword } = await import('tauri-plugin-keyring-api');
    const password = await getPassword(SERVICE, `api.${name}`);
    return password;
  } catch (error) {
    // Key doesn't exist or keyring unavailable
    console.debug(`No API key found for ${name}:`, error);
    return null;
  }
}

/**
 * Store an API key in the keychain
 */
export async function setApiKey(name: ApiKeyName, value: string): Promise<boolean> {
  if (!isTauriAvailable()) {
    return false;
  }

  try {
    const { setPassword } = await import('tauri-plugin-keyring-api');
    await setPassword(SERVICE, `api.${name}`, value);
    return true;
  } catch (error) {
    console.error(`Failed to store API key for ${name}:`, error);
    return false;
  }
}

/**
 * Delete an API key from the keychain
 */
export async function deleteApiKey(name: ApiKeyName): Promise<boolean> {
  if (!isTauriAvailable()) {
    return false;
  }

  try {
    const { deletePassword } = await import('tauri-plugin-keyring-api');
    await deletePassword(SERVICE, `api.${name}`);
    return true;
  } catch (error) {
    // Key might not exist, which is fine
    console.debug(`Failed to delete API key for ${name}:`, error);
    return false;
  }
}

/**
 * Check if an API key is set (without retrieving the value)
 */
export async function hasApiKey(name: ApiKeyName): Promise<boolean> {
  const key = await getApiKey(name);
  return key !== null && key.length > 0;
}

/**
 * Check if keyring is available on this system
 */
export async function isKeyringAvailable(): Promise<boolean> {
  if (!isTauriAvailable()) {
    return false;
  }

  try {
    // Try to access the keyring API
    const { getPassword } = await import('tauri-plugin-keyring-api');
    // Try a dummy operation to verify keyring works
    await getPassword(SERVICE, '__keyring_test__');
    return true;
  } catch (error) {
    // If error is "not found", keyring is working but key doesn't exist
    const errorStr = String(error);
    if (errorStr.includes('not found') || errorStr.includes('No password')) {
      return true;
    }
    // Other errors mean keyring is unavailable
    return false;
  }
}
