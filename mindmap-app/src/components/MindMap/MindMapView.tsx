import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useFileOperations } from '../../hooks/useFileOperations';
import MindMapCanvas from './MindMapCanvas';

function MindMapView() {
  // Enable keyboard navigation
  useKeyboardNavigation();

  // Enable file operations (Ctrl+S, Ctrl+O, Ctrl+N)
  useFileOperations();

  return (
    <div className="h-full flex flex-col">
      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <MindMapCanvas />
      </div>
    </div>
  );
}

export default MindMapView;
