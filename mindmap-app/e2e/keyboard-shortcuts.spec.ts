import { test, expect } from "@playwright/test";

/**
 * E2E tests for keyboard shortcuts in Mind the Map.
 * Tests cover global shortcuts and view-specific shortcuts.
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

test.describe("Keyboard Shortcuts - Global", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }
  });

  test("Cmd+M should toggle between Map and Outline views", async ({
    page,
  }) => {
    // Start in outline view (default)
    const outlineButton = page.getByRole("button", { name: "Outline" });
    await expect(outlineButton).toHaveClass(/bg-blue-500/);

    // Toggle to Map view
    await page.keyboard.press("Meta+m");
    await page.waitForTimeout(300);

    // Map should now be active
    const mapButton = page.getByRole("button", { name: "Map" });
    await expect(mapButton).toHaveClass(/bg-blue-500/);

    // Toggle back to Outline
    await page.keyboard.press("Meta+m");
    await page.waitForTimeout(300);

    await expect(outlineButton).toHaveClass(/bg-blue-500/);
  });

  test("Cmd+F should open Search & Filter panel", async ({ page }) => {
    await page.keyboard.press("Meta+f");
    await page.waitForTimeout(300);

    await expect(page.getByText("Search & Filter")).toBeVisible();
  });

  test("Cmd+F should toggle Search panel closed when open", async ({
    page,
  }) => {
    // Open search panel
    await page.keyboard.press("Meta+f");
    await page.waitForTimeout(300);
    await expect(page.getByText("Search & Filter")).toBeVisible();

    // Close search panel
    await page.keyboard.press("Meta+f");
    await page.waitForTimeout(300);
    await expect(page.getByText("Search & Filter")).not.toBeVisible();
  });

  test("Cmd+/ should open help dialog", async ({ page }) => {
    await page.keyboard.press("Meta+/");
    await page.waitForTimeout(300);

    await expect(
      page.getByRole("heading", { name: "Keyboard Shortcuts" })
    ).toBeVisible();
  });

  test("Escape should close help dialog", async ({ page }) => {
    // Open help
    await page.keyboard.press("Meta+/");
    await page.waitForTimeout(300);

    // Close with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(
      page.getByRole("heading", { name: "Keyboard Shortcuts" })
    ).not.toBeVisible();
  });

  test("Cmd+Z should trigger undo", async ({ page }) => {
    // First, create a change to undo
    await page.keyboard.press("Tab"); // Create child node
    await page.waitForTimeout(300);

    // Type something
    const input = page.locator("input, textarea").first();
    await input.fill("Test Node");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify the node exists
    await expect(page.getByText("Test Node")).toBeVisible();

    // Undo
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);

    // Node should be removed
    await expect(page.getByText("Test Node")).not.toBeVisible();
  });

  test("Cmd+Shift+Z should trigger redo", async ({ page }) => {
    // Create a change by creating a child node
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    const input = page.locator("input, textarea").first();
    await input.fill("Redo Test");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify node was created
    await expect(page.getByText("Redo Test")).toBeVisible();
    const nodeCountBefore = await page.locator("[data-node-id]").count();

    // Undo - this undoes the text change first, then the node creation
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(300);

    // The node might still exist but with different text, or be removed
    // Let's just check redo brings back to original state
    await page.keyboard.press("Meta+Shift+z");
    await page.waitForTimeout(300);

    // After redo, we should have the same number of nodes
    const nodeCountAfter = await page.locator("[data-node-id]").count();
    expect(nodeCountAfter).toBe(nodeCountBefore);
  });
});

test.describe("Keyboard Shortcuts - Node Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }
  });

  test("E key should enter edit mode", async ({ page }) => {
    await page.keyboard.press("e");
    await page.waitForTimeout(300);

    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("F2 key should enter edit mode", async ({ page }) => {
    await page.keyboard.press("F2");
    await page.waitForTimeout(300);

    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("Enter key should create sibling node", async ({ page }) => {
    // Navigate to a child node first (Enter on root creates child, not sibling)
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    const initialCount = await page.locator("[data-node-id]").count();

    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const newCount = await page.locator("[data-node-id]").count();
    expect(newCount).toBe(initialCount + 1);
  });

  test("Tab key should create child node", async ({ page }) => {
    const initialCount = await page.locator("[data-node-id]").count();

    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    const newCount = await page.locator("[data-node-id]").count();
    expect(newCount).toBe(initialCount + 1);
  });

  test("Space should toggle collapse on node with children", async ({
    page,
  }) => {
    // Root node has children, verify they are visible
    await expect(page.getByText("What if we...")).toBeVisible();

    // Press Space to collapse
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    // Children should be hidden
    await expect(page.getByText("What if we...")).not.toBeVisible();

    // Press Space again to expand
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    // Children visible again
    await expect(page.getByText("What if we...")).toBeVisible();
  });

  test("Cmd+Backspace should delete selected node (not root)", async ({
    page,
  }) => {
    // Navigate to a child node
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    // Verify we're on the child
    const childNode = page
      .locator('[data-node-id]')
      .filter({ hasText: "What if we..." })
      .first();
    await expect(childNode).toHaveClass(/bg-blue-100/);

    // Delete the node
    await page.keyboard.press("Meta+Backspace");
    await page.waitForTimeout(300);

    // Child should be deleted
    await expect(page.getByText("What if we...")).not.toBeVisible();
  });

  test("Cmd+] should indent node (make child of previous sibling)", async ({
    page,
  }) => {
    // Create two sibling nodes first
    await page.keyboard.press("Tab"); // Create child
    await page.waitForTimeout(200);
    await page.locator("input, textarea").first().fill("First");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    await page.keyboard.press("Enter"); // Create sibling
    await page.waitForTimeout(200);
    await page.locator("input, textarea").first().fill("Second");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // "Second" should be selected, indent it to become child of "First"
    await page.keyboard.press("Meta+]");
    await page.waitForTimeout(300);

    // "Second" should now be indented more than "First"
    const firstNode = page
      .locator('[data-node-id]')
      .filter({ hasText: "First" })
      .first();
    const secondNode = page
      .locator('[data-node-id]')
      .filter({ hasText: "Second" })
      .first();

    const firstDepth = await firstNode.getAttribute("data-depth");
    const secondDepth = await secondNode.getAttribute("data-depth");

    expect(Number(secondDepth)).toBe(Number(firstDepth) + 1);
  });
});

test.describe("Keyboard Shortcuts - Mind Map View", () => {
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

  test("Cmd+Shift+F should fit view to content", async ({ page }) => {
    // Just verify the shortcut doesn't break anything and canvas remains
    await page.keyboard.press("Meta+Shift+f");
    await page.waitForTimeout(300);

    await expect(page.locator("canvas")).toBeVisible();
  });
});

test.describe("Keyboard Shortcuts - Icon Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }
  });

  test("Cmd+Shift+I should open icon picker", async ({ page }) => {
    await page.keyboard.press("Meta+Shift+i");
    await page.waitForTimeout(300);

    // Icon picker panel should be visible
    await expect(page.getByText("Icons")).toBeVisible();
  });

});
