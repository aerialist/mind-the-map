import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../../store';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';
const altKey = isMac ? '⌥' : 'Alt';
const shiftKey = isMac ? '⇧' : 'Shift';

const shortcutSections: ShortcutSection[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Move between siblings' },
      { keys: ['←'], description: 'Go to parent / collapse' },
      { keys: ['→'], description: 'Go to first child / expand' },
      { keys: [`${modKey}+F`], description: 'Search nodes' },
    ],
  },
  {
    title: 'Node Editing',
    shortcuts: [
      { keys: ['Tab'], description: 'Create child node' },
      { keys: ['Enter'], description: 'Create sibling below' },
      { keys: [`${shiftKey}+Enter`], description: 'Create sibling above' },
      { keys: ['E', 'F2'], description: 'Edit selected node' },
      { keys: ['Escape'], description: 'Save and stop editing' },
      { keys: [`${modKey}+Escape`], description: 'Cancel (discard changes)' },
      { keys: ['Delete', 'Backspace'], description: 'Delete node' },
      { keys: ['I'], description: 'Open icon picker' },
    ],
  },
  {
    title: 'Collapse & Expand',
    shortcuts: [
      { keys: ['Space'], description: 'Toggle collapse' },
      { keys: [`${shiftKey}+${altKey}+Space`], description: 'Smart collapse all (3-state cycle)' },
    ],
  },
  {
    title: 'Clipboard',
    shortcuts: [
      { keys: [`${modKey}+C`], description: 'Copy nodes' },
      { keys: [`${modKey}+X`], description: 'Cut nodes' },
      { keys: [`${modKey}+V`], description: 'Paste as children' },
      { keys: [`${modKey}+${shiftKey}+M`], description: 'Copy for Miro' },
    ],
  },
  {
    title: 'Multi-Selection',
    shortcuts: [
      { keys: [`${modKey}+Click`], description: 'Toggle node in selection' },
      { keys: [`${shiftKey}+Click`], description: 'Select range' },
    ],
  },
  {
    title: 'File Operations',
    shortcuts: [
      { keys: [`${modKey}+N`], description: 'New document' },
      { keys: [`${modKey}+O`], description: 'Open document' },
      { keys: [`${modKey}+S`], description: 'Save document' },
      { keys: [`${modKey}+${shiftKey}+S`], description: 'Save as...' },
    ],
  },
  {
    title: 'View & History',
    shortcuts: [
      { keys: [`${modKey}+1`], description: 'Mind map view' },
      { keys: [`${modKey}+2`], description: 'Outline view' },
      { keys: [`${modKey}+Z`], description: 'Undo' },
      { keys: [`${modKey}+${shiftKey}+Z`, `${modKey}+Y`], description: 'Redo' },
    ],
  },
  {
    title: 'Help',
    shortcuts: [
      { keys: ['?', `${modKey}+/`], description: 'Show this help' },
      { keys: ['Escape'], description: 'Close dialogs' },
    ],
  },
];

const tips = [
  'Press Tab or Enter while editing to create new nodes without stopping',
  'Right-click and drag to pan the mind map canvas',
  'Use mouse wheel to zoom, Ctrl+wheel to pan vertically, Shift+wheel to pan horizontally',
  'Paste indented text or HTML lists to create structured nodes',
  'Click an icon on a node to cycle through variants in the same category',
  'Smart Collapse cycles: Collapsed → Expanded (except ✓) → Fully Expanded',
  'Multi-select nodes, then use icon picker to apply icons to all at once',
  'Collapsed nodes show a count of hidden children',
];

function HelpDialog() {
  const isHelpOpen = useDocumentStore((state) => state.isHelpOpen);
  const closeHelp = useDocumentStore((state) => state.closeHelp);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpOpen) {
        e.preventDefault();
        closeHelp();
      }
    };

    if (isHelpOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isHelpOpen, closeHelp]);

  // Focus trap
  useEffect(() => {
    if (isHelpOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isHelpOpen]);

  if (!isHelpOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeHelp}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={closeHelp}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Shortcuts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {shortcutSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1.5 ml-4">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            {keyIdx > 0 && (
                              <span className="text-xs text-gray-400 mx-0.5">or</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm whitespace-nowrap">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tips Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Quick Tips
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <a
            href="https://aerialist.github.io/mind-the-map/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Full Documentation
          </a>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Escape</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

export default HelpDialog;
