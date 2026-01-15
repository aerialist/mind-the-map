import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../../store';

interface ShortcutItem {
  keys: string[];
  description: string;
  inactive?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';
const altKey = isMac ? '⌥' : 'Alt';
const shiftKey = isMac ? '⇧' : 'Shift';
const ctrlKey = 'Ctrl';
const redoKeys = isMac
  ? [`${modKey}+${shiftKey}+Z`]
  : [`${modKey}+${shiftKey}+Z`, `${modKey}+Y`];
const quitKeys = [isMac ? `${modKey}+Q` : 'Alt+F4'];
const fullScreenKeys = isMac
  ? [`${ctrlKey}+${modKey}+F`]
  : ['F11'];

const shortcutSections: ShortcutSection[] = [
  {
    title: 'File',
    shortcuts: [
      { keys: [`${modKey}+N`], description: 'New Document' },
      { keys: [`${modKey}+O`], description: 'Open...' },
      { keys: [`${modKey}+${shiftKey}+O`], description: 'Map Folder...' },
      { keys: ['—'], description: 'Map Workflowy...' },
      { keys: [`${modKey}+S`], description: 'Save' },
      { keys: [`${modKey}+${shiftKey}+S`], description: 'Save As...' },
      { keys: [`${modKey}+${shiftKey}+E`], description: 'Export as PDF' },
      { keys: [`${modKey}+P`], description: 'Print...' },
      { keys: [`${modKey}+,`], description: 'Preferences...' },
      { keys: quitKeys, description: 'Quit' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: [`${modKey}+Z`], description: 'Undo' },
      { keys: redoKeys, description: 'Redo' },
      { keys: [`${modKey}+X`], description: 'Cut' },
      { keys: [`${modKey}+C`], description: 'Copy' },
      { keys: [`${modKey}+${shiftKey}+C`], description: 'Copy for Miro' },
      { keys: [`${modKey}+V`], description: 'Paste' },
      { keys: [`${modKey}+${shiftKey}+V`], description: 'Paste as Child' },
      { keys: [`${modKey}+D`], description: 'Duplicate Node' },
      { keys: [`${modKey}+Backspace`], description: 'Delete Node' },
      { keys: [`${modKey}+${shiftKey}+Backspace`], description: 'Delete Node & Children', inactive: true },
      { keys: [`${modKey}+A`], description: 'Select All (in text)' },
      { keys: [`${modKey}+${shiftKey}+A`], description: 'Select All Siblings', inactive: true },
      { keys: [`${modKey}+${altKey}+A`], description: 'Select All Children', inactive: true },
      { keys: [`${modKey}+F`], description: 'Find...' },
      { keys: [`${modKey}+G`], description: 'Find Next', inactive: true },
      { keys: [`${modKey}+${shiftKey}+G`], description: 'Find Previous', inactive: true },
      { keys: [`${modKey}+${shiftKey}+P`], description: 'Go to Node...', inactive: true },
      { keys: [`${modKey}+${shiftKey}+D`], description: 'Jump to Daily Note', inactive: true },
      { keys: [`${modKey}+R`], description: 'Recent Nodes', inactive: true },
    ],
  },
  {
    title: 'Insert',
    shortcuts: [
      { keys: ['Enter'], description: 'New Sibling Node Below' },
      { keys: [`${modKey}+${shiftKey}+Enter`], description: 'New Sibling Node Above' },
      { keys: ['Tab'], description: 'New Child Node' },
      { keys: [`${shiftKey}+Enter`], description: 'Line Break (in node)', inactive: true },
      { keys: [`${modKey}+K`], description: 'Link...' },
      { keys: [`${modKey}+T`], description: 'Tag', inactive: true },
      { keys: [`${modKey}+${shiftKey}+N`], description: 'Note', inactive: true },
      { keys: [`${modKey}+${shiftKey}+I`], description: 'Icon...' },
      { keys: [`${modKey}+${shiftKey}+K`], description: 'Color/Style...', inactive: true },
      { keys: [`${modKey}+${shiftKey}+P`], description: 'Priority', inactive: true },
    ],
  },
  {
    title: 'Format',
    shortcuts: [
      { keys: [`${modKey}+B`], description: 'Bold', inactive: true },
      { keys: [`${modKey}+I`], description: 'Italic', inactive: true },
      { keys: [`${modKey}+U`], description: 'Underline', inactive: true },
      { keys: [`${modKey}+${shiftKey}+X`], description: 'Strikethrough', inactive: true },
      { keys: [`${modKey}+E`], description: 'Code', inactive: true },
      { keys: [`${modKey}+\\`], description: 'Clear Formatting', inactive: true },
    ],
  },
  {
    title: 'Node',
    shortcuts: [
      { keys: [`${modKey}+]`], description: 'Indent' },
      { keys: [`${modKey}+[`], description: 'Outdent' },
      { keys: [`${modKey}+${shiftKey}+↑`], description: 'Move Node Up' },
      { keys: [`${modKey}+${shiftKey}+↓`], description: 'Move Node Down' },
      { keys: [`${modKey}+${shiftKey}+←`], description: 'Move Node Left (Outdent)' },
      { keys: [`${modKey}+${shiftKey}+→`], description: 'Move Node Right (Indent)' },
      { keys: ['Space'], description: 'Expand/Collapse' },
      { keys: [`${shiftKey}+Space`], description: 'Expand/Collapse All Children' },
      { keys: [`${modKey}+${altKey}+→`], description: 'Expand All Children' },
      { keys: [`${modKey}+${altKey}+←`], description: 'Collapse All Children' },
      { keys: [`${modKey}+.`], description: 'Zoom to Node (Focus)', inactive: true },
      { keys: [`${modKey}+,`], description: 'Zoom Out from Node', inactive: true },
      { keys: [`${modKey}+Home`], description: 'Jump to Root', inactive: true },
    ],
  },
  {
    title: 'Navigate',
    shortcuts: [
      { keys: ['↑'], description: 'Move to Sibling Above' },
      { keys: ['↓'], description: 'Move to Sibling Below' },
      { keys: ['→'], description: 'Move to First Child' },
      { keys: ['←'], description: 'Move to Parent' },
      { keys: [`${modKey}+↑`], description: 'Jump to First Sibling' },
      { keys: [`${modKey}+↓`], description: 'Jump to Last Sibling' },
      { keys: [`${modKey}+→`], description: 'Jump to Last Child' },
      { keys: [`${shiftKey}+↑`], description: 'Extend Selection Up', inactive: true },
      { keys: [`${shiftKey}+↓`], description: 'Extend Selection Down', inactive: true },
      { keys: [`${modKey}+Enter`], description: 'Select/Deselect Node', inactive: true },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: [`${modKey}+M`], description: 'Toggle Outline ↔ Mindmap' },
      { keys: [`${modKey}+1`], description: 'Switch to Mind Map' },
      { keys: [`${modKey}+2`], description: 'Switch to Outline' },
      { keys: [`${modKey}+Plus`], description: 'Zoom In', inactive: true },
      { keys: [`${modKey}+Minus`], description: 'Zoom Out', inactive: true },
      { keys: [`${modKey}+0`], description: 'Reset Zoom', inactive: true },
      { keys: [`${modKey}+${shiftKey}+F`], description: 'Fit to Screen' },
      { keys: [`${modKey}+${shiftKey}+H`], description: 'Show/Hide Completed', inactive: true },
      { keys: [`${modKey}+${shiftKey}+.`], description: 'Focus Mode (Hide UI)', inactive: true },
      { keys: [`${modKey}+B`], description: 'Toggle Sidebar', inactive: true },
      ...(!isMac ? [{ keys: fullScreenKeys, description: 'Enter Full Screen' }] : []),
    ],
  },
  {
    title: 'Workflowy',
    shortcuts: [
      { keys: ['—'], description: 'Push to Workflowy (only for Workflowy-synced documents)' },
      { keys: ['—'], description: 'Pull from Workflowy (only for Workflowy-synced documents)' },
    ],
  },
  ...(isMac
    ? [
        {
          title: 'Window',
          shortcuts: [
            { keys: [`${modKey}+M`], description: 'Minimize' },
            { keys: fullScreenKeys, description: 'Enter Full Screen' },
          ],
        },
      ]
    : []),
  {
    title: 'Help',
    shortcuts: [
      { keys: ['?', `${modKey}+/`], description: 'Keyboard Shortcuts' },
    ],
  },
];

const tips = [
  'Press Tab or Enter while editing to create new nodes without stopping',
  'Right-click and drag to pan the mind map canvas',
  'Use mouse wheel to zoom, Ctrl+wheel to pan vertically, Shift+wheel to pan horizontally',
  'Paste indented text or HTML lists to create structured nodes',
  'Click an icon on a node to cycle through variants in the same category',
  'Smart Collapse cycles: Collapsed → Expanded (except Done ✓) → Fully Expanded',
  'Multi-select nodes, then use icon picker to apply icons to all at once',
  'Collapsed nodes show a count of hidden children',
  'Open Link panel with Ctrl+K. Click linked text to open URLs or files',
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
                      className={`flex items-center justify-between py-1.5 ${shortcut.inactive ? 'opacity-50' : ''}`}
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
