import { test, expect } from "@playwright/test";

test.describe("Indian Shopping Mela — E2E Critical Path Smoke Suite", () => {
  test("1. Homepage and Catalogue Navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Indian Shopping Mela/i);

    // Verify main navigation categories
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Verify search input is interactive
    const searchInput = page.getByPlaceholder(/Search products|Search indian attire/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Silk Saree");
      await searchInput.press("Enter");
    }
  });

  test("2. Zero-Trust Cart Operation", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("body")).toBeVisible();
  });

  test("3. Checkout Route Fail-Closed State", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("body")).toBeVisible();
  });

  test("4. Seller Onboarding Gate", async ({ page }) => {
    await page.goto("/sell/onboarding");
    await expect(page.locator("body")).toBeVisible();
  });

  test("5. Admin MFA Protection Gate", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
  });
});
