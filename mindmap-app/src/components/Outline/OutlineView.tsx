import { useDocumentStore } from '../../store';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useFileOperations } from '../../hooks/useFileOperations';
import OutlineNode from './OutlineNode';

function OutlineView() {
  const rootId = useDocumentStore((state) => state.rootId);
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <OutlineNode nodeId={rootId} depth={0} />
      </div>
    </div>
  );
}

export default OutlineView;
