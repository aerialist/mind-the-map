import { describe, it, expect } from "vitest";
import {
  getVisibleNodeIds,
  getNextNodeId,
  getPreviousNodeId,
  getParentNodeId,
  getFirstChildNodeId,
  getLastChildNodeId,
  getNextSiblingNodeId,
  getPreviousSiblingNodeId,
  getFirstSiblingNodeId,
  getLastSiblingNodeId,
  getDownNodeId,
  getUpNodeId,
} from "./index";
import type { NodeMap } from "../../types";

// Helper to create test nodes
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
    childIds: ["grandchild1", "grandchild2"],
    content: { type: "text", text: "Child 1" },
    position: { x: 0, y: 0, source: "auto" },
    isCollapsed: false,
  },
  child2: {
    id: "child2",
    parentId: "root",
    childIds: [],
    content: { type: "text", text: "Child 2" },
    position: { x: 0, y: 0, source: "auto" },
    isCollapsed: false,
  },
  grandchild1: {
    id: "grandchild1",
    parentId: "child1",
    childIds: [],
    content: { type: "text", text: "Grandchild 1" },
    position: { x: 0, y: 0, source: "auto" },
    isCollapsed: false,
  },
  grandchild2: {
    id: "grandchild2",
    parentId: "child1",
    childIds: [],
    content: { type: "text", text: "Grandchild 2" },
    position: { x: 0, y: 0, source: "auto" },
    isCollapsed: false,
  },
});

describe("navigation", () => {
  describe("getVisibleNodeIds", () => {
    it("should return all nodes in DFS order when none are collapsed", () => {
      const nodes = createTestNodes();
      const result = getVisibleNodeIds(nodes, "root");

      expect(result).toEqual([
        "root",
        "child1",
        "grandchild1",
        "grandchild2",
        "child2",
      ]);
    });

    it("should skip children of collapsed nodes", () => {
      const nodes = createTestNodes();
      nodes.child1.isCollapsed = true;

      const result = getVisibleNodeIds(nodes, "root");

      expect(result).toEqual(["root", "child1", "child2"]);
    });

    it("should handle root-only tree", () => {
      const nodes: NodeMap = {
        root: {
          id: "root",
          parentId: null,
          childIds: [],
          content: { type: "text", text: "Root" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = getVisibleNodeIds(nodes, "root");

      expect(result).toEqual(["root"]);
    });
  });

  describe("getNextNodeId", () => {
    it("should return the next node in visible order", () => {
      const nodes = createTestNodes();

      expect(getNextNodeId(nodes, "root", "root")).toBe("child1");
      expect(getNextNodeId(nodes, "root", "child1")).toBe("grandchild1");
      expect(getNextNodeId(nodes, "root", "grandchild1")).toBe("grandchild2");
      expect(getNextNodeId(nodes, "root", "grandchild2")).toBe("child2");
    });

    it("should return null for the last visible node", () => {
      const nodes = createTestNodes();

      expect(getNextNodeId(nodes, "root", "child2")).toBeNull();
    });

    it("should return null for non-existent node", () => {
      const nodes = createTestNodes();

      expect(getNextNodeId(nodes, "root", "nonexistent")).toBeNull();
    });
  });

  describe("getPreviousNodeId", () => {
    it("should return the previous node in visible order", () => {
      const nodes = createTestNodes();

      expect(getPreviousNodeId(nodes, "root", "child2")).toBe("grandchild2");
      expect(getPreviousNodeId(nodes, "root", "grandchild2")).toBe(
        "grandchild1"
      );
      expect(getPreviousNodeId(nodes, "root", "grandchild1")).toBe("child1");
      expect(getPreviousNodeId(nodes, "root", "child1")).toBe("root");
    });

    it("should return null for the first node (root)", () => {
      const nodes = createTestNodes();

      expect(getPreviousNodeId(nodes, "root", "root")).toBeNull();
    });
  });

  describe("getParentNodeId", () => {
    it("should return the parent node ID", () => {
      const nodes = createTestNodes();

      expect(getParentNodeId(nodes, "child1")).toBe("root");
      expect(getParentNodeId(nodes, "grandchild1")).toBe("child1");
    });

    it("should return null for root node", () => {
      const nodes = createTestNodes();

      expect(getParentNodeId(nodes, "root")).toBeNull();
    });

    it("should return null for non-existent node", () => {
      const nodes = createTestNodes();

      expect(getParentNodeId(nodes, "nonexistent")).toBeNull();
    });
  });

  describe("getFirstChildNodeId", () => {
    it("should return the first child node ID", () => {
      const nodes = createTestNodes();

      expect(getFirstChildNodeId(nodes, "root")).toBe("child1");
      expect(getFirstChildNodeId(nodes, "child1")).toBe("grandchild1");
    });

    it("should return null for collapsed node", () => {
      const nodes = createTestNodes();
      nodes.child1.isCollapsed = true;

      expect(getFirstChildNodeId(nodes, "child1")).toBeNull();
    });

    it("should return null for node without children", () => {
      const nodes = createTestNodes();

      expect(getFirstChildNodeId(nodes, "child2")).toBeNull();
      expect(getFirstChildNodeId(nodes, "grandchild1")).toBeNull();
    });
  });

  describe("getLastChildNodeId", () => {
    it("should return the last child node ID", () => {
      const nodes = createTestNodes();

      expect(getLastChildNodeId(nodes, "root")).toBe("child2");
      expect(getLastChildNodeId(nodes, "child1")).toBe("grandchild2");
    });

    it("should return null for collapsed node", () => {
      const nodes = createTestNodes();
      nodes.child1.isCollapsed = true;

      expect(getLastChildNodeId(nodes, "child1")).toBeNull();
    });

    it("should return null for node without children", () => {
      const nodes = createTestNodes();

      expect(getLastChildNodeId(nodes, "child2")).toBeNull();
      expect(getLastChildNodeId(nodes, "grandchild1")).toBeNull();
    });
  });

  describe("getNextSiblingNodeId", () => {
    it("should return the next sibling", () => {
      const nodes = createTestNodes();

      expect(getNextSiblingNodeId(nodes, "child1")).toBe("child2");
      expect(getNextSiblingNodeId(nodes, "grandchild1")).toBe("grandchild2");
    });

    it("should return null for last sibling", () => {
      const nodes = createTestNodes();

      expect(getNextSiblingNodeId(nodes, "child2")).toBeNull();
      expect(getNextSiblingNodeId(nodes, "grandchild2")).toBeNull();
    });

    it("should return null for root node", () => {
      const nodes = createTestNodes();

      expect(getNextSiblingNodeId(nodes, "root")).toBeNull();
    });
  });

  describe("getPreviousSiblingNodeId", () => {
    it("should return the previous sibling", () => {
      const nodes = createTestNodes();

      expect(getPreviousSiblingNodeId(nodes, "child2")).toBe("child1");
      expect(getPreviousSiblingNodeId(nodes, "grandchild2")).toBe(
        "grandchild1"
      );
    });

    it("should return null for first sibling", () => {
      const nodes = createTestNodes();

      expect(getPreviousSiblingNodeId(nodes, "child1")).toBeNull();
      expect(getPreviousSiblingNodeId(nodes, "grandchild1")).toBeNull();
    });

    it("should return null for root node", () => {
      const nodes = createTestNodes();

      expect(getPreviousSiblingNodeId(nodes, "root")).toBeNull();
    });
  });

  describe("getFirstSiblingNodeId", () => {
    it("should return the first sibling", () => {
      const nodes = createTestNodes();

      expect(getFirstSiblingNodeId(nodes, "child2")).toBe("child1");
      expect(getFirstSiblingNodeId(nodes, "grandchild2")).toBe("grandchild1");
    });

    it("should return null for root node", () => {
      const nodes = createTestNodes();

      expect(getFirstSiblingNodeId(nodes, "root")).toBeNull();
    });
  });

  describe("getLastSiblingNodeId", () => {
    it("should return the last sibling", () => {
      const nodes = createTestNodes();

      expect(getLastSiblingNodeId(nodes, "child1")).toBe("child2");
      expect(getLastSiblingNodeId(nodes, "grandchild1")).toBe("grandchild2");
    });

    it("should return null for root node", () => {
      const nodes = createTestNodes();

      expect(getLastSiblingNodeId(nodes, "root")).toBeNull();
    });
  });

  describe("getDownNodeId", () => {
    it("should return next sibling first", () => {
      const nodes = createTestNodes();

      expect(getDownNodeId(nodes, "child1")).toBe("child2");
    });

    it("should return first child when no next sibling", () => {
      const nodes = createTestNodes();
      // child2 has no next sibling but also no children
      // grandchild2 has no next sibling and no children
      // So test with root which has child1 as next viable option through first child
      nodes.root.childIds = ["child1"]; // Remove child2 to test first child path

      expect(getDownNodeId(nodes, "root")).toBe("child1");
    });

    it("should return parent next sibling when no siblings or children", () => {
      const nodes = createTestNodes();

      // grandchild2 -> should go to child2 (parent's next sibling)
      expect(getDownNodeId(nodes, "grandchild2")).toBe("child2");
    });

    it("should return null when no more nodes below", () => {
      const nodes = createTestNodes();

      expect(getDownNodeId(nodes, "child2")).toBeNull();
    });
  });

  describe("getUpNodeId", () => {
    it("should return previous sibling first", () => {
      const nodes = createTestNodes();

      expect(getUpNodeId(nodes, "child2")).toBe("child1");
      expect(getUpNodeId(nodes, "grandchild2")).toBe("grandchild1");
    });

    it("should return parent when no previous sibling", () => {
      const nodes = createTestNodes();

      expect(getUpNodeId(nodes, "child1")).toBe("root");
      expect(getUpNodeId(nodes, "grandchild1")).toBe("child1");
    });

    it("should return null for root", () => {
      const nodes = createTestNodes();

      expect(getUpNodeId(nodes, "root")).toBeNull();
    });
  });
});
