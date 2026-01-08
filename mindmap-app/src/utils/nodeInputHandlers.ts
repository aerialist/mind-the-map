import type React from 'react';

export type NodeInputKeyOptions = {
  isComposing: boolean;
  onCreateChild: () => void;
  onCreateSibling: () => void;
  onFocusParent?: () => void;
  onEscape?: (mode: 'save' | 'cancel') => void;
};

export const isImeComposing = (
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  isComposing: boolean
) => {
  return (
    event.nativeEvent.isComposing ||
    isComposing ||
    event.keyCode === 229 ||
    event.key === 'Process'
  );
};

export const handleNodeInputKeyDown = (
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  options: NodeInputKeyOptions
) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) return;
    if (isImeComposing(event, options.isComposing)) return;
    event.preventDefault();
    options.onCreateSibling();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    if (event.shiftKey) {
      options.onFocusParent?.();
    } else {
      options.onCreateChild();
    }
    return;
  }

  if (event.key === 'Escape' && options.onEscape) {
    event.preventDefault();
    options.onEscape(event.ctrlKey ? 'cancel' : 'save');
  }
};
