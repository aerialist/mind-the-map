import { describe, it, expect, beforeEach } from "vitest";
import { useDocumentStore, computeVisibleNodeIds } from "./documentStore";
import type { NodeMap } from "../types";

// Helper to get text content from a node
const getNodeText = (nodeId: string): string => {
  const node = useDocumentStore.getState().nodes[nodeId];
  if (node && node.content.type === "text") {
    return node.content.text;
  }
  return "";
};

describe("documentStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDocumentStore.getState().newDocument();
  });

  describe("selectNode", () => {
    it("should select a node by ID", () => {
      const { selectNode } = useDocumentStore.getState();

      selectNode("root");

      const state = useDocumentStore.getState();
      expect(state.selectedNodeId).toBe("root");
      expect(state.selectedNodeIds).toEqual(["root"]);
    });

    it("should clear selection when null is passed", () => {
      const { selectNode } = useDocumentStore.getState();

      selectNode(null);

      const state = useDocumentStore.getState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedNodeIds).toEqual([]);
    });
  });

  describe("createChildNode", () => {
    it("should create a child node under the specified parent", () => {
      const { createChildNode } = useDocumentStore.getState();

      createChildNode("root");

      const state = useDocumentStore.getState();
      const root = state.nodes["root"];

      expect(root.childIds.length).toBe(1);

      const childId = root.childIds[0];
      const child = state.nodes[childId];

      expect(child).toBeDefined();
      expect(child.parentId).toBe("root");
      expect(child.content.type).toBe("text");
      expect(state.editingNodeId).toBe(childId);
    });

    it("should expand parent if collapsed", () => {
      const store = useDocumentStore.getState();
      // First create a child
      store.createChildNode("root");
      // Collapse the root
      store.toggleCollapse("root");

      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(true);

      // Create another child - should expand
      store.createChildNode("root");

      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(false);
    });
  });

  describe("deleteNode", () => {
    it("should delete a node and select its parent", () => {
      const store = useDocumentStore.getState();

      // Create a child first
      store.createChildNode("root");
      const childId = useDocumentStore.getState().nodes["root"].childIds[0];

      // Delete the child
      store.deleteNode(childId);

      const state = useDocumentStore.getState();
      expect(state.nodes[childId]).toBeUndefined();
      expect(state.nodes["root"].childIds).not.toContain(childId);
      expect(state.selectedNodeId).toBe("root");
    });

    it("should not delete root node", () => {
      const { deleteNode } = useDocumentStore.getState();

      deleteNode("root");

      const state = useDocumentStore.getState();
      expect(state.nodes["root"]).toBeDefined();
    });
  });

  describe("undo/redo", () => {
    it("should undo text changes", () => {
      const originalText = getNodeText("root");

      // Make a change
      useDocumentStore.getState().updateNodeText("root", "New text");
      expect(getNodeText("root")).toBe("New text");

      // Undo
      useDocumentStore.getState().undo();
      expect(getNodeText("root")).toBe(originalText);
    });


    it("should report canUndo and canRedo correctly", () => {
      const store = useDocumentStore.getState();

      expect(store.canUndo()).toBe(false);
      expect(store.canRedo()).toBe(false);

      // Make a change
      store.updateNodeText("root", "Changed");

      expect(useDocumentStore.getState().canUndo()).toBe(true);
      expect(useDocumentStore.getState().canRedo()).toBe(false);

      // Undo
      store.undo();

      expect(useDocumentStore.getState().canUndo()).toBe(false);
      expect(useDocumentStore.getState().canRedo()).toBe(true);
    });
  });

  describe("toggleCollapse", () => {
    it("should toggle collapse state of a node with children", () => {
      const store = useDocumentStore.getState();

      // Create a child first
      store.createChildNode("root");

      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(false);

      store.toggleCollapse("root");
      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(true);

      store.toggleCollapse("root");
      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(false);
    });

    it("should not toggle collapse for node without children", () => {
      const store = useDocumentStore.getState();

      // Root starts with no children after newDocument
      store.toggleCollapse("root");

      expect(useDocumentStore.getState().nodes["root"].isCollapsed).toBe(false);
    });
  });
});

describe("computeVisibleNodeIds", () => {
  const createTestNodes = (): NodeMap => ({
    root: {
      id: "root",
      parentId: null,
      childIds: ["child1", "child2"],
      content: { type: "text", text: "Root" },
      position: { x: 0, y: 0, source: "auto" },
      isCollapsed: false,
    },
    child1: {
      id: "child1",
      parentId: "root",
      childIds: ["grandchild1"],
      content: { type: "text", text: "Child 1" },
      position: { x: 0, y: 0, source: "auto" },
      isCollapsed: false,
      icons: [{ type: "priority", value: 1 }],
    },
    child2: {
      id: "child2",
      parentId: "root",
      childIds: [],
      content: { type: "text", text: "Child 2" },
      position: { x: 0, y: 0, source: "auto" },
      isCollapsed: false,
      icons: [{ type: "status", value: "done" }],
    },
    grandchild1: {
      id: "grandchild1",
      parentId: "child1",
      childIds: [],
      content: { type: "text", text: "Grandchild 1" },
      position: { x: 0, y: 0, source: "auto" },
      isCollapsed: false,
    },
  });

  it("should return all nodes when no filters are active", () => {
    const nodes = createTestNodes();
    const visible = computeVisibleNodeIds(nodes, "root", [], []);

    expect(visible.size).toBe(4);
    expect(visible.has("root")).toBe(true);
    expect(visible.has("child1")).toBe(true);
    expect(visible.has("child2")).toBe(true);
    expect(visible.has("grandchild1")).toBe(true);
  });

  it("should filter to show only nodes with matching icons", () => {
    const nodes = createTestNodes();
    const visible = computeVisibleNodeIds(
      nodes,
      "root",
      [{ type: "priority", value: 1 }],
      []
    );

    // Should show: root (always), child1 (matches), grandchild1 is NOT shown (doesn't match)
    expect(visible.has("root")).toBe(true);
    expect(visible.has("child1")).toBe(true);
    expect(visible.has("child2")).toBe(false);
    expect(visible.has("grandchild1")).toBe(false);
  });

  it("should show ancestors of matching nodes", () => {
    const nodes = createTestNodes();
    // Add icon to grandchild
    nodes.grandchild1.icons = [{ type: "flag", value: "red" }];

    const visible = computeVisibleNodeIds(
      nodes,
      "root",
      [{ type: "flag", value: "red" }],
      []
    );

    // Should show: root, child1 (ancestor), grandchild1 (matches)
    expect(visible.has("root")).toBe(true);
    expect(visible.has("child1")).toBe(true);
    expect(visible.has("grandchild1")).toBe(true);
    expect(visible.has("child2")).toBe(false);
  });

  it("should hide nodes with hidden icon filters", () => {
    const nodes = createTestNodes();
    const visible = computeVisibleNodeIds(
      nodes,
      "root",
      [],
      [{ type: "status", value: "done" }]
    );

    // child2 has done status, should be hidden
    expect(visible.has("root")).toBe(true);
    expect(visible.has("child1")).toBe(true);
    expect(visible.has("grandchild1")).toBe(true);
    expect(visible.has("child2")).toBe(false);
  });

  it("should combine active and hidden filters", () => {
    const nodes = createTestNodes();
    // Add priority to grandchild as well
    nodes.grandchild1.icons = [{ type: "priority", value: 1 }];

    const visible = computeVisibleNodeIds(
      nodes,
      "root",
      [{ type: "priority", value: 1 }], // Show only priority 1
      [{ type: "status", value: "done" }] // Hide done status
    );

    // child1 and grandchild1 have priority 1
    // child2 has done status (would be hidden anyway since it doesn't match active filter)
    expect(visible.has("root")).toBe(true);
    expect(visible.has("child1")).toBe(true);
    expect(visible.has("grandchild1")).toBe(true);
    expect(visible.has("child2")).toBe(false);
  });
});
