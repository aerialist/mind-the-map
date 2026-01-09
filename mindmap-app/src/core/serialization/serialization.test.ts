import { describe, it, expect } from "vitest";
import { serialize, deserialize, getDocumentTitle } from "./index";
import type { NodeMap } from "../../types";

describe("serialization", () => {
  const createTestNodes = (): NodeMap => ({
    root: {
      id: "root",
      parentId: null,
      childIds: ["child1"],
      content: { type: "text", text: "My Document" },
      position: { x: 0, y: 0, source: "auto" },
      isCollapsed: false,
    },
    child1: {
      id: "child1",
      parentId: "root",
      childIds: [],
      content: { type: "text", text: "Child Node" },
      position: { x: 100, y: 50, source: "manual" },
      isCollapsed: false,
      icons: [{ type: "priority", value: 1 }],
    },
  });

  describe("serialize", () => {
    it("should serialize nodes to JSON string", () => {
      const nodes = createTestNodes();

      const result = serialize(nodes, "root", "Test Title");
      const parsed = JSON.parse(result);

      expect(parsed.version).toBe("1.0.0");
      expect(parsed.metadata.title).toBe("Test Title");
      expect(parsed.rootId).toBe("root");
      expect(parsed.nodes).toEqual(nodes);
    });

    it("should use default title when not provided", () => {
      const nodes = createTestNodes();

      const result = serialize(nodes, "root");
      const parsed = JSON.parse(result);

      expect(parsed.metadata.title).toBe("Untitled");
    });

    it("should include createdAt and modifiedAt timestamps", () => {
      const nodes = createTestNodes();

      const result = serialize(nodes, "root");
      const parsed = JSON.parse(result);

      expect(parsed.metadata.createdAt).toBeDefined();
      expect(parsed.metadata.modifiedAt).toBeDefined();

      // Timestamps should be valid ISO strings
      expect(() => new Date(parsed.metadata.createdAt)).not.toThrow();
      expect(() => new Date(parsed.metadata.modifiedAt)).not.toThrow();
    });

    it("should produce formatted JSON with indentation", () => {
      const nodes = createTestNodes();

      const result = serialize(nodes, "root");

      // Formatted JSON should contain newlines
      expect(result).toContain("\n");
    });
  });

  describe("deserialize", () => {
    it("should deserialize valid JSON to nodes", () => {
      const nodes = createTestNodes();
      const serialized = serialize(nodes, "root", "Test");

      const result = deserialize(serialized);

      expect(result.rootId).toBe("root");
      expect(result.title).toBe("Test");
      expect(result.nodes.root).toBeDefined();
      expect(result.nodes.child1).toBeDefined();
    });

    it("should throw error for missing version", () => {
      const invalid = JSON.stringify({ rootId: "root", nodes: {} });

      expect(() => deserialize(invalid)).toThrow("missing version");
    });

    it("should throw error for missing rootId", () => {
      const invalid = JSON.stringify({ version: "1.0.0", nodes: {} });

      expect(() => deserialize(invalid)).toThrow("missing required fields");
    });

    it("should throw error for missing nodes", () => {
      const invalid = JSON.stringify({ version: "1.0.0", rootId: "root" });

      expect(() => deserialize(invalid)).toThrow("missing required fields");
    });

    it("should throw error if root node not found in nodes", () => {
      const invalid = JSON.stringify({
        version: "1.0.0",
        rootId: "root",
        nodes: { other: {} },
      });

      expect(() => deserialize(invalid)).toThrow("root node not found");
    });

    it("should use 'Untitled' when metadata.title is missing", () => {
      const file = {
        version: "1.0.0",
        rootId: "root",
        nodes: {
          root: {
            id: "root",
            parentId: null,
            childIds: [],
            content: { type: "text", text: "Root" },
            position: { x: 0, y: 0, source: "auto" },
            isCollapsed: false,
          },
        },
      };

      const result = deserialize(JSON.stringify(file));

      expect(result.title).toBe("Untitled");
    });

    it("should throw error for invalid JSON", () => {
      expect(() => deserialize("not valid json")).toThrow();
    });
  });

  describe("getDocumentTitle", () => {
    it("should return root node text as title", () => {
      const nodes = createTestNodes();

      const result = getDocumentTitle(nodes, "root");

      expect(result).toBe("My Document");
    });

    it("should return 'Untitled' for empty root text", () => {
      const nodes: NodeMap = {
        root: {
          id: "root",
          parentId: null,
          childIds: [],
          content: { type: "text", text: "" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = getDocumentTitle(nodes, "root");

      expect(result).toBe("Untitled");
    });

    it("should return 'Untitled' if root node not found", () => {
      const nodes: NodeMap = {};

      const result = getDocumentTitle(nodes, "nonexistent");

      expect(result).toBe("Untitled");
    });
  });
});
