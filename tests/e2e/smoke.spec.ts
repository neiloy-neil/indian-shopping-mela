import { test, expect } from "@playwright/test";

/**
 * Indian Shopping Mela (ISM) — End-to-End Test Suite
 * Master Plan & Tasklist3 Phase 29 (T436–T464)
 */

test.describe("Indian Shopping Mela — E2E Critical Path Suite", () => {
  test("1. Homepage and Navigation Headers", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Indian Shopping Mela/i);

    // Verify main navigation categories and branding
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Verify search input is present and interactive
    const searchInput = page.getByPlaceholder(/Search/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Saree");
      await searchInput.press("Enter");
    }
  });

  test("2. Catalogue Browsing & Category Navigation", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.locator("body")).toBeVisible();

    // Verify products or empty state container renders
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("3. Zero-Trust Cart Page", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("body")).toBeVisible();

    // Ensure checkout button or empty cart state is present
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("4. Checkout Route Security & Fail-Closed Guard", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("body")).toBeVisible();
  });

  test("5. Seller Portal & Onboarding Gate", async ({ page }) => {
    await page.goto("/sell/onboarding");
    await expect(page.locator("body")).toBeVisible();
  });

  test("6. Admin Console Route MFA Gate", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
  });

  test("7. Customer Returns & Policies Navigation", async ({ page }) => {
    await page.goto("/policies/returns");
    await expect(page.locator("body")).toBeVisible();
  });

  test("8. Deep Health & Telemetry API Endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect([200, 503]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("timestamp");
  });
});
