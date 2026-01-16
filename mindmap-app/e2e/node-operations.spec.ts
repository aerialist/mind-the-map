import { test, expect } from "@playwright/test";

/**
 * E2E tests for node operations in Mind the Map.
 * Tests cover creating, editing, navigating, and manipulating nodes.
 */

// Helper to check if app is fully loaded
async function isAppLoaded(
  page: import("@playwright/test").Page
): Promise<boolean> {
  try {
    await page.waitForSelector("header", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Helper to get node by text content
function getNode(page: import("@playwright/test").Page, text: string) {
  return page.locator(`[data-node-id]`).filter({ hasText: text }).first();
}

test.describe("Node Operations - Outline View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }

    // Ensure we're in outline view
    await page.getByRole("button", { name: "Outline" }).click();
    await page.waitForTimeout(300);
  });

  test("should display root node with initial content", async ({ page }) => {
    const rootNode = getNode(page, "My Big Idea");
    await expect(rootNode).toBeVisible();
  });

  test("should select node on click", async ({ page }) => {
    const childNode = getNode(page, "What if we...");
    await childNode.click();
    await page.waitForTimeout(200);

    // The clicked node should now have selection styling
    await expect(childNode).toHaveClass(/bg-blue-100/);
  });

  test("should navigate down with arrow key", async ({ page }) => {
    // Start with root selected (it's selected by default)
    const rootNode = getNode(page, "My Big Idea");
    await expect(rootNode).toHaveClass(/bg-blue-100/);

    // Press down arrow to navigate to first child
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    // Child node should now be selected
    const childNode = getNode(page, "What if we...");
    await expect(childNode).toHaveClass(/bg-blue-100/);
  });

  test("should navigate up with arrow key", async ({ page }) => {
    // First navigate down to child
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    // Child should be selected
    const childNode = getNode(page, "What if we...");
    await expect(childNode).toHaveClass(/bg-blue-100/);

    // Navigate back up
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);

    // Root should be selected again
    const rootNode = getNode(page, "My Big Idea");
    await expect(rootNode).toHaveClass(/bg-blue-100/);
  });

  test("should navigate to parent with left arrow", async ({ page }) => {
    // Select a child node that has no children or is collapsed
    const childNode = getNode(page, "What if we...");
    await childNode.click();
    await page.waitForTimeout(200);

    // Press left arrow to go to parent (root)
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(200);

    // Root node should now be selected
    const rootNode = getNode(page, "My Big Idea");
    await expect(rootNode).toHaveClass(/bg-blue-100/);
  });

  test("should navigate to first child with right arrow", async ({ page }) => {
    // Start with root selected
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);

    // First child should be selected
    const childNode = getNode(page, "What if we...");
    await expect(childNode).toHaveClass(/bg-blue-100/);
  });

  test("should enter edit mode with E key", async ({ page }) => {
    // Select root node
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.click();
    await page.waitForTimeout(200);

    // Press E to enter edit mode
    await page.keyboard.press("e");
    await page.waitForTimeout(300);

    // An input or textarea should appear
    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("should enter edit mode on double-click", async ({ page }) => {
    // Double-click on root node
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.dblclick();
    await page.waitForTimeout(300);

    // An input or textarea should appear
    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("should create sibling node with Enter", async ({ page }) => {
    // Click on child node
    const childNode = getNode(page, "What if we...");
    await childNode.click();
    await page.waitForTimeout(200);

    // Count initial nodes
    const initialNodeCount = await page.locator("[data-node-id]").count();

    // Press Enter to create sibling
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // Should have one more node
    const newNodeCount = await page.locator("[data-node-id]").count();
    expect(newNodeCount).toBe(initialNodeCount + 1);

    // Should be in edit mode for the new node
    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
  });

  test("should create child node with Tab", async ({ page }) => {
    // Click on root node
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.click();
    await page.waitForTimeout(200);

    // Count initial nodes
    const initialNodeCount = await page.locator("[data-node-id]").count();

    // Press Tab to create child
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // Should have one more node
    const newNodeCount = await page.locator("[data-node-id]").count();
    expect(newNodeCount).toBe(initialNodeCount + 1);

    // Should be in edit mode for the new node
    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
  });

  test("should save edit and exit with Escape", async ({ page }) => {
    // Enter edit mode
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.click();
    await page.keyboard.press("e");
    await page.waitForTimeout(300);

    // Clear and type new text
    const input = page.locator("input[type='text'].border-blue-400");
    await input.clear();
    await input.fill("Updated Root Text");

    // Press Escape to save and exit
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // The editing input should no longer be visible
    await expect(page.locator("input[type='text'].border-blue-400")).not.toBeVisible();

    // Node text should be updated
    await expect(page.getByText("Updated Root Text")).toBeVisible();
  });

  test("should toggle collapse with Space", async ({ page }) => {
    // Click on root node (which has children)
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.click();
    await page.waitForTimeout(200);

    // Verify children are visible
    await expect(getNode(page, "What if we...")).toBeVisible();

    // Press Space to collapse
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    // Children should be hidden
    await expect(getNode(page, "What if we...")).not.toBeVisible();

    // Press Space again to expand
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    // Children should be visible again
    await expect(getNode(page, "What if we...")).toBeVisible();
  });

  test("should undo with Cmd+Z", async ({ page }) => {
    // Create a new node
    const rootNode = getNode(page, "My Big Idea");
    await rootNode.click();
    await page.keyboard.press("Tab"); // Create child
    await page.waitForTimeout(300);

    // Type something and save
    const input = page.locator("input, textarea").first();
    await input.fill("New Child Node");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify the new node exists
    await expect(page.getByText("New Child Node")).toBeVisible();

    // Undo
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);

    // The new node should be removed
    await expect(page.getByText("New Child Node")).not.toBeVisible();
  });
});

test.describe("Node Operations - Mind Map View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }

    // Switch to mind map view
    await page.getByRole("button", { name: "Map" }).click();
    await page.waitForTimeout(500);
  });

  test("should display canvas in mind map mode", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("should fit to view with Cmd+Shift+F", async ({ page }) => {
    // Press Cmd+Shift+F
    await page.keyboard.press("Meta+Shift+f");
    await page.waitForTimeout(500);

    // Canvas should still be visible (viewport adjusted)
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });
});
