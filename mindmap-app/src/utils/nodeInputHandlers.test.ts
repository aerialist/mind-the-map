import { describe, it, expect, vi } from "vitest";
import { isImeComposing, handleNodeInputKeyDown } from "./nodeInputHandlers";
import type React from "react";

// Helper to create mock keyboard event
const createKeyEvent = (
  key: string,
  options: {
    shiftKey?: boolean;
    ctrlKey?: boolean;
    isComposing?: boolean;
    keyCode?: number;
  } = {}
): React.KeyboardEvent<HTMLInputElement> => {
  return {
    key,
    shiftKey: options.shiftKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    keyCode: options.keyCode ?? 0,
    nativeEvent: {
      isComposing: options.isComposing ?? false,
    },
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
};

describe("nodeInputHandlers", () => {
  describe("isImeComposing", () => {
    it("should return true when nativeEvent.isComposing is true", () => {
      const event = createKeyEvent("Enter", { isComposing: true });

      expect(isImeComposing(event, false)).toBe(true);
    });

    it("should return true when isComposing state is true", () => {
      const event = createKeyEvent("Enter");

      expect(isImeComposing(event, true)).toBe(true);
    });

    it("should return true when keyCode is 229 (IME)", () => {
      const event = createKeyEvent("Enter", { keyCode: 229 });

      expect(isImeComposing(event, false)).toBe(true);
    });

    it("should return true when key is 'Process'", () => {
      const event = createKeyEvent("Process");

      expect(isImeComposing(event, false)).toBe(true);
    });

    it("should return false when not composing", () => {
      const event = createKeyEvent("Enter");

      expect(isImeComposing(event, false)).toBe(false);
    });
  });

  describe("handleNodeInputKeyDown", () => {
    it("should call onCreateSibling on Enter", () => {
      const event = createKeyEvent("Enter");
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(options.onCreateSibling).toHaveBeenCalled();
      expect(options.onCreateChild).not.toHaveBeenCalled();
    });

    it("should not call onCreateSibling on Shift+Enter", () => {
      const event = createKeyEvent("Enter", { shiftKey: true });
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(options.onCreateSibling).not.toHaveBeenCalled();
    });

    it("should not call onCreateSibling during IME composition", () => {
      const event = createKeyEvent("Enter", { isComposing: true });
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(options.onCreateSibling).not.toHaveBeenCalled();
    });

    it("should call onCreateChild on Tab", () => {
      const event = createKeyEvent("Tab");
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(options.onCreateChild).toHaveBeenCalled();
    });

    it("should call onFocusParent on Shift+Tab", () => {
      const event = createKeyEvent("Tab", { shiftKey: true });
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
        onFocusParent: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(options.onFocusParent).toHaveBeenCalled();
      expect(options.onCreateChild).not.toHaveBeenCalled();
    });

    it("should call onEscape with 'save' on Escape", () => {
      const event = createKeyEvent("Escape");
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
        onEscape: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(options.onEscape).toHaveBeenCalledWith("save");
    });

    it("should call onEscape with 'cancel' on Ctrl+Escape", () => {
      const event = createKeyEvent("Escape", { ctrlKey: true });
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
        onEscape: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(options.onEscape).toHaveBeenCalledWith("cancel");
    });

    it("should not call onEscape if not provided", () => {
      const event = createKeyEvent("Escape");
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
      };

      // Should not throw
      expect(() => handleNodeInputKeyDown(event, options)).not.toThrow();
    });

    it("should do nothing for other keys", () => {
      const event = createKeyEvent("a");
      const options = {
        isComposing: false,
        onCreateChild: vi.fn(),
        onCreateSibling: vi.fn(),
        onEscape: vi.fn(),
      };

      handleNodeInputKeyDown(event, options);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(options.onCreateChild).not.toHaveBeenCalled();
      expect(options.onCreateSibling).not.toHaveBeenCalled();
      expect(options.onEscape).not.toHaveBeenCalled();
    });
  });
});
