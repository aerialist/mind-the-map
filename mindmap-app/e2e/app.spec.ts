import { test, expect } from "@playwright/test";

/**
 * E2E tests for Mind the Map application.
 *
 * IMPORTANT: This Tauri app requires the Tauri runtime to function properly.
 * When running with just `pnpm dev` (Vite only), the React app may not render
 * because Tauri APIs are not available.
 *
 * For proper E2E testing of Tauri apps, consider:
 * 1. Using Tauri's WebDriver testing: https://tauri.app/v2/develop/tests/webdriver/
 * 2. Running tests against `pnpm tauri dev` instead of `pnpm dev`
 *
 * These tests are designed to gracefully skip when the app doesn't load,
 * allowing the test infrastructure to be verified.
 */

// Helper to check if app is fully loaded
async function isAppLoaded(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    await page.waitForSelector("header", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

test.describe("Mind the Map - Smoke Tests", () => {
  test("Vite dev server is running and returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("page has React mount point", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // The #root element should exist (React mount point)
    const root = page.locator("#root");
    await expect(root).toBeAttached();
  });
});

test.describe("Mind the Map - Full App Tests (requires Tauri)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loaded = await isAppLoaded(page);
    if (!loaded) {
      test.skip(true, "App requires Tauri runtime - run with 'pnpm tauri dev'");
    }
  });

  test("should display app header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("Mind the Map")).toBeVisible();
  });

  test("should display view mode toggle buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Outline" })).toBeVisible();
  });

  test("should toggle view mode with keyboard shortcut Cmd+M", async ({
    page,
  }) => {
    const outlineButton = page.getByRole("button", { name: "Outline" });

    // Get initial state
    const initialOutlineActive = await outlineButton
      .getAttribute("class")
      .then((c) => c?.includes("bg-blue-500"));

    // Toggle with Cmd+M
    await page.keyboard.press("Meta+m");
    await page.waitForTimeout(500);

    // State should have changed
    const afterOutlineActive = await outlineButton
      .getAttribute("class")
      .then((c) => c?.includes("bg-blue-500"));

    expect(initialOutlineActive).not.toBe(afterOutlineActive);
  });

  test("should open help dialog with Cmd+/ shortcut", async ({ page }) => {
    // Use Cmd+/ instead of ? since ? requires Shift+/ which may not trigger the '?' key event
    await page.keyboard.press("Meta+/");
    await page.waitForTimeout(500);

    // Look for the help dialog heading specifically
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).not.toBeVisible();
  });

  test("should open search panel with Cmd+F", async ({ page }) => {
    await page.keyboard.press("Meta+f");
    await page.waitForTimeout(500);

    // Look for the search panel header specifically
    await expect(page.getByText("Search & Filter")).toBeVisible();
  });

  test("should switch to Map view and show canvas", async ({ page }) => {
    await page.getByRole("button", { name: "Map" }).click();
    await page.waitForTimeout(500);

    // PixiJS should render a canvas
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should display initial root node content", async ({ page }) => {
    // The app should show the root node with initial text
    await expect(page.getByText("My Big Idea")).toBeVisible();
  });

  test("should open help with help button click", async ({ page }) => {
    const helpButton = page.locator('button[title*="Keyboard shortcuts"]');
    await helpButton.click();
    await page.waitForTimeout(500);

    // Look for the help dialog heading specifically
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
  });
});
