import { describe, it, expect } from "vitest";
import {
  parseHtmlToNodes,
  parsedNodesToNodeMap,
  nodesToHtml,
  nodesToPlainText,
  parseIndentedTextToNodes,
  nodesToMiroFormat,
} from "./index";
import type { NodeMap } from "../../types";

describe("clipboard", () => {
  describe("parseHtmlToNodes", () => {
    it("should parse simple ul/li structure", () => {
      const html = `
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;

      const result = parseHtmlToNodes(html);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("Item 1");
      expect(result[1].text).toBe("Item 2");
    });

    it("should parse nested ul/li structure", () => {
      const html = `
        <ul>
          <li>Parent
            <ul>
              <li>Child 1</li>
              <li>Child 2</li>
            </ul>
          </li>
        </ul>
      `;

      const result = parseHtmlToNodes(html);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Parent");
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].text).toBe("Child 1");
      expect(result[0].children[1].text).toBe("Child 2");
    });

    it("should return empty array for invalid HTML", () => {
      const html = "<div>No list here</div>";

      const result = parseHtmlToNodes(html);

      expect(result).toEqual([]);
    });

    it("should handle Workflowy-style HTML", () => {
      const html = `
        <ul>
          <li>
            <div class="name">
              <span class="innerContentContainer">Workflowy Item</span>
            </div>
          </li>
        </ul>
      `;

      const result = parseHtmlToNodes(html);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Workflowy Item");
    });
  });

  describe("parsedNodesToNodeMap", () => {
    it("should convert parsed nodes to NodeMap", () => {
      const parsedNodes = [
        {
          text: "Parent",
          children: [
            { text: "Child 1", children: [] },
            { text: "Child 2", children: [] },
          ],
        },
      ];

      const { nodes, rootIds } = parsedNodesToNodeMap(parsedNodes, "target");

      expect(rootIds).toHaveLength(1);

      const rootNode = nodes[rootIds[0]];
      expect(rootNode.content).toEqual({ type: "text", text: "Parent" });
      expect(rootNode.parentId).toBe("target");
      expect(rootNode.childIds).toHaveLength(2);

      const child1 = nodes[rootNode.childIds[0]];
      expect(child1.content).toEqual({ type: "text", text: "Child 1" });
      expect(child1.parentId).toBe(rootIds[0]);
    });

    it("should handle empty text with 'Untitled'", () => {
      const parsedNodes = [{ text: "", children: [] }];

      const { nodes, rootIds } = parsedNodesToNodeMap(parsedNodes, "target");

      const node = nodes[rootIds[0]];
      expect(node.content).toEqual({ type: "text", text: "Untitled" });
    });
  });

  describe("nodesToHtml", () => {
    it("should convert nodes to HTML ul/li structure", () => {
      const nodes: NodeMap = {
        node1: {
          id: "node1",
          parentId: null,
          childIds: ["node2"],
          content: { type: "text", text: "Parent" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
        node2: {
          id: "node2",
          parentId: "node1",
          childIds: [],
          content: { type: "text", text: "Child" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = nodesToHtml(nodes, ["node1"]);

      expect(result).toBe("<ul><li>Parent<ul><li>Child</li></ul></li></ul>");
    });

    it("should escape HTML special characters", () => {
      const nodes: NodeMap = {
        node1: {
          id: "node1",
          parentId: null,
          childIds: [],
          content: { type: "text", text: "<script>alert('xss')</script>" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = nodesToHtml(nodes, ["node1"]);

      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });
  });

  describe("nodesToPlainText", () => {
    it("should convert nodes to indented plain text", () => {
      const nodes: NodeMap = {
        node1: {
          id: "node1",
          parentId: null,
          childIds: ["node2"],
          content: { type: "text", text: "Parent" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
        node2: {
          id: "node2",
          parentId: "node1",
          childIds: [],
          content: { type: "text", text: "Child" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = nodesToPlainText(nodes, ["node1"]);

      expect(result).toBe("Parent\n\tChild");
    });

    it("should use custom indent character", () => {
      const nodes: NodeMap = {
        node1: {
          id: "node1",
          parentId: null,
          childIds: ["node2"],
          content: { type: "text", text: "Parent" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
        node2: {
          id: "node2",
          parentId: "node1",
          childIds: [],
          content: { type: "text", text: "Child" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const result = nodesToPlainText(nodes, ["node1"], "  ");

      expect(result).toBe("Parent\n  Child");
    });
  });

  describe("parseIndentedTextToNodes", () => {
    it("should parse tab-indented text", () => {
      const text = "Parent\n\tChild 1\n\tChild 2";

      const result = parseIndentedTextToNodes(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Parent");
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].text).toBe("Child 1");
      expect(result[0].children[1].text).toBe("Child 2");
    });

    it("should parse space-indented text", () => {
      const text = "Parent\n  Child 1\n    Grandchild";

      const result = parseIndentedTextToNodes(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Parent");
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].text).toBe("Child 1");
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].text).toBe("Grandchild");
    });

    it("should handle multiple root nodes", () => {
      const text = "Root 1\nRoot 2\nRoot 3";

      const result = parseIndentedTextToNodes(text);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Root 1");
      expect(result[1].text).toBe("Root 2");
      expect(result[2].text).toBe("Root 3");
    });

    it("should skip empty lines", () => {
      const text = "Item 1\n\nItem 2\n\n\nItem 3";

      const result = parseIndentedTextToNodes(text);

      expect(result).toHaveLength(3);
    });

    it("should return empty array for empty input", () => {
      const result = parseIndentedTextToNodes("");

      expect(result).toEqual([]);
    });
  });

  describe("nodesToMiroFormat", () => {
    it("should generate TSV and HTML table format", () => {
      const nodes: NodeMap = {
        node1: {
          id: "node1",
          parentId: null,
          childIds: ["node2"],
          content: { type: "text", text: "Root" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
        node2: {
          id: "node2",
          parentId: "node1",
          childIds: [],
          content: { type: "text", text: "Child" },
          position: { x: 0, y: 0, source: "auto" },
          isCollapsed: false,
        },
      };

      const { html, text } = nodesToMiroFormat(nodes, ["node1"]);

      // TSV format: Root in first column, Child in second column
      expect(text).toContain("Root");
      expect(text).toContain("Child");
      expect(text).toContain("\t"); // Tab separator

      // HTML table format
      expect(html).toContain("<table>");
      expect(html).toContain("<tr>");
      expect(html).toContain("<td>");
      expect(html).toContain("Root");
      expect(html).toContain("Child");
    });
  });
});
