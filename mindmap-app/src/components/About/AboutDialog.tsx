import { useEffect, useRef, useState } from 'react';
import { safeInvoke } from '../../services/tauri/safeTauri';
import { useDocumentStore } from '../../store';

interface AboutDialogProps {}

export function AboutDialog(_props: AboutDialogProps) {
  const isAboutOpen = useDocumentStore((state) => state.isAboutOpen);
  const toggleAbout = useDocumentStore((state) => state.toggleAbout);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const [platformInfo, setPlatformInfo] = useState<string>('');

  // Fetch app version and platform info when component mounts
  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        const version = await safeInvoke<string>('get_app_version');
        setAppVersion(version ?? 'Dev');

        const platform = await safeInvoke<string>('get_platform_info');
        setPlatformInfo(platform ?? 'Browser');
      } catch (error) {
        console.error('Failed to get app info:', error);
        setAppVersion('Unknown');
        setPlatformInfo('Unknown');
      }
    };

    fetchAppInfo();
  }, []);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isAboutOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isAboutOpen && dialog.open) {
      dialog.close();
    }
  }, [isAboutOpen]);

  // Handle click outside dialog to close
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const clickedInDialog = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );

    if (!clickedInDialog) {
      toggleAbout();
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!isAboutOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleAbout();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAboutOpen, toggleAbout]);

  return (
    <dialog
      ref={dialogRef}
      className="
        p-0 m-0 bg-transparent border-none outline-none backdrop:bg-black/20 backdrop:backdrop-blur-sm
        open:animate-in open:fade-in open:duration-200
      "
      onClick={handleDialogClick}
    >
      <div className="
        bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 m-4
        w-96 max-w-[90vw] border border-gray-200 dark:border-gray-700
      ">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Mind the Map
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Version {appVersion}
          </p>
        </div>

        {/* App Info */}
        <div className="space-y-4 mb-6">
          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300">
              A visual mind mapping tool for organizing your thoughts and ideas.
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <span className="font-semibold">Built with:</span> React, TypeScript, Tauri
              </p>
              <p>
                <span className="font-semibold">Platform:</span> {platformInfo || 'Loading...'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center">
          <button
            onClick={toggleAbout}
            className="
              px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg
              transition-colors duration-200 focus:outline-none focus:ring-2 
              focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
            "
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}