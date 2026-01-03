import { useState, useCallback } from 'react';
import { X, Tags } from 'lucide-react';
import { useDocumentStore } from '../../store';
import {
  ICON_DEFINITIONS,
  ICON_CATEGORY_LABELS,
  getIconDefinition,
  type IconCategory,
  type NodeIcon,
} from '../../types';

function IconPicker() {
  const isOpen = useDocumentStore((state) => state.isIconPickerOpen);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const nodes = useDocumentStore((state) => state.nodes);
  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const closeIconPicker = useDocumentStore((state) => state.closeIconPicker);
  const addIcon = useDocumentStore((state) => state.addIcon);
  const removeIcon = useDocumentStore((state) => state.removeIcon);
  const clearIcons = useDocumentStore((state) => state.clearIcons);

  const [selectedCategory, setSelectedCategory] =
    useState<IconCategory>('priority');

  const hasMultipleSelection = selectedNodeIds.length > 1;

  // Panel stays open until explicitly closed (no Escape key, no click-outside)

  const handleIconClick = useCallback(
    (icon: NodeIcon) => {
      // Apply icon to all selected nodes
      for (const nodeId of selectedNodeIds) {
        addIcon(nodeId, icon);
      }
    },
    [selectedNodeIds, addIcon]
  );

  const handleRemoveIcon = useCallback(
    (index: number) => {
      // Only remove from primary selected node (shown in "Current Icons")
      if (selectedNodeId) {
        removeIcon(selectedNodeId, index);
      }
    },
    [selectedNodeId, removeIcon]
  );

  const handleClearAll = useCallback(() => {
    // Clear icons from all selected nodes
    for (const nodeId of selectedNodeIds) {
      clearIcons(nodeId);
    }
  }, [selectedNodeIds, clearIcons]);

  if (!isOpen) return null;

  const categories = Object.keys(ICON_DEFINITIONS) as IconCategory[];
  const currentIcons = node?.icons || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t first:border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Tags size={16} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Icons
          </span>
          {hasMultipleSelection && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
              {selectedNodeIds.length} nodes
            </span>
          )}
        </div>
        <button
          onClick={closeIconPicker}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* No node selected message */}
      {selectedNodeIds.length === 0 || !node ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Select a node to add icons
        </div>
      ) : (
        <>
          {/* Current icons */}
          {currentIcons.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Current Icons
                </span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {currentIcons.map((icon, index) => {
                  const def = getIconDefinition(icon);
                  if (!def) return null;
                  const IconComponent = def.icon;
                  return (
                    <button
                      key={`${icon.type}-${icon.value}-${index}`}
                      onClick={() => handleRemoveIcon(index)}
                      className="flex items-center gap-1 px-1.5 py-1 bg-white dark:bg-gray-700 rounded hover:bg-red-100 dark:hover:bg-red-900 group border border-gray-200 dark:border-gray-600"
                      title="Click to remove"
                    >
                      <span className="relative">
                        <IconComponent
                          className="w-4 h-4"
                          style={{ color: def.color }}
                        />
                        {def.text && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
                            style={{ color: def.color }}
                          >
                            {def.text}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-red-500">
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap ${
                  selectedCategory === category
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {ICON_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          {/* Icon grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-5 gap-1">
              {ICON_DEFINITIONS[selectedCategory].map((iconDef) => {
                const icon: NodeIcon = {
                  type: iconDef.type,
                  value: iconDef.value,
                } as NodeIcon;

                const isSelected = currentIcons.some(
                  (i) => i.type === icon.type && i.value === icon.value
                );

                const IconComponent = iconDef.icon;

                return (
                  <button
                    key={`${iconDef.type}-${iconDef.value}`}
                    onClick={() => handleIconClick(icon)}
                    className={`flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
                        : ''
                    }`}
                    title={iconDef.label}
                  >
                    <span className="relative">
                      <IconComponent
                        className="w-5 h-5"
                        style={{ color: iconDef.color }}
                      />
                      {iconDef.text && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                          style={{ color: iconDef.color }}
                        >
                          {iconDef.text}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer hints */}
          <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex gap-3">
            <span>Click to add</span>
            <span>Esc Close</span>
          </div>
        </>
      )}
    </div>
  );
}

export default IconPicker;
