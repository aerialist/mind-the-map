import { useDocumentStore } from '../../store';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useFileOperations } from '../../hooks/useFileOperations';
import MindMapCanvas from './MindMapCanvas';

function MindMapView() {
  const isDirty = useDocumentStore((state) => state.isDirty);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);

  // Enable keyboard navigation
  useKeyboardNavigation();

  // Enable file operations (Ctrl+S, Ctrl+O, Ctrl+N)
  useFileOperations();

  // Get filename from path
  const fileName = currentFilePath
    ? currentFilePath.split('/').pop() || 'Untitled'
    : 'Untitled';

  return (
    <div className="h-full flex flex-col">
      {/* Title bar */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
        {fileName}
        {isDirty && <span className="ml-1">*</span>}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <MindMapCanvas />
      </div>
    </div>
  );
}

export default MindMapView;
