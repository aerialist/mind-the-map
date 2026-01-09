/**
 * Safe Tauri API wrappers that handle non-Tauri environments gracefully.
 * These functions check if Tauri APIs are available before calling them,
 * allowing the app to run in a browser-only mode for development/testing.
 */

// Check if we're running in a Tauri environment
export const isTauriAvailable = (): boolean => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

// Safe invoke that returns undefined if Tauri is not available
export const safeInvoke = async <T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T | undefined> => {
  if (!isTauriAvailable()) {
    console.warn(`Tauri not available, skipping invoke: ${cmd}`);
    return undefined;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`Failed to invoke ${cmd}:`, error);
    return undefined;
  }
};

// Safe listen that returns a no-op unlisten function if Tauri is not available
export const safeListen = async <T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> => {
  if (!isTauriAvailable()) {
    console.warn(`Tauri not available, skipping listen: ${event}`);
    return () => {};
  }

  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<T>(event, handler);
  } catch (error) {
    console.error(`Failed to listen to ${event}:`, error);
    return () => {};
  }
};

// Safe getCurrentWindow that returns a mock if Tauri is not available
export const safeGetCurrentWindow = async () => {
  if (!isTauriAvailable()) {
    return {
      label: "mock",
      setTitle: async () => {},
      onFocusChanged: async () => () => {},
    };
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return {
      label: "mock",
      setTitle: async () => {},
      onFocusChanged: async () => () => {},
    };
  }
};
