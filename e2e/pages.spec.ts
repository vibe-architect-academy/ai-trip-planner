import { test, expect } from "@playwright/test";

/**
 * Tests that render a page.
 *
 * Every page in this app is wrapped in Clerk's provider, so without a
 * publishable key nothing renders at all and these cannot run. They are
 * skipped rather than deleted, and skipped loudly rather than quietly: the
 * reason prints in the report, so "6 skipped" is a fact somebody can act on
 * instead of a suite that looks green because it did almost nothing.
 */

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

test.describe("pages", () => {
  test.skip(
    !clerkConfigured,
    "Needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: every page renders inside ClerkProvider.",
  );

  test("the privacy page is readable by a stranger", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
    // The specific promise worth not breaking by accident.
    await expect(page.getByText(/delete everything/i)).toBeVisible();
  });

  test("a signed-out visitor cannot reach the trips list", async ({ page }) => {
    await page.goto("/trips");
    await expect(page).not.toHaveURL(/\/trips\/?$/);
  });

  test("a made-up share token opens nothing", async ({ page }) => {
    const response = await page.goto("/share/not-a-real-token-000000000000000000");
    expect(response?.status()).toBe(404);
  });

  test("the home page works at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // The failure this catches is a page that scrolls sideways on a phone,
    // which looks broken and is invisible on a laptop.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});
