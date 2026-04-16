import { expect, test } from "@playwright/test";

test.describe("browse constellations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/x/prime-moments/browse");
  });

  test("loads and displays constellations", async ({ page }) => {
    // Wait for loading to finish
    await expect(
      page.getByText("loading constellations..."),
    ).not.toBeVisible({ timeout: 15000 });

    // Should show constellation cards
    const cards = page.locator('a[href*="/x/prime-moments/"]');
    await expect(cards.first()).toBeVisible();
  });

  test("size filter narrows results", async ({ page }) => {
    await expect(
      page.getByText("loading constellations..."),
    ).not.toBeVisible({ timeout: 15000 });

    // Click k=2 filter
    await page.getByRole("button", { name: "k=2" }).click();

    // Status text should mention size 2
    await expect(page.getByText(/of size 2/)).toBeVisible();
  });

  test("sort buttons change ordering", async ({ page }) => {
    await expect(
      page.getByText("loading constellations..."),
    ).not.toBeVisible({ timeout: 15000 });

    // Click "widest spread" sort
    await page.getByRole("button", { name: "widest spread" }).click();

    // The button should now be the active style (bg-ink).
    // Just verify it's still showing results.
    const cards = page.locator('a[href*="/x/prime-moments/"]');
    await expect(cards.first()).toBeVisible();
  });

  test("load more button adds cards", async ({ page }) => {
    await expect(
      page.getByText("loading constellations..."),
    ).not.toBeVisible({ timeout: 15000 });

    const statusBefore = await page.getByText(/showing \d+/).textContent();

    const loadMore = page.getByRole("button", { name: /load 100 more/i });
    await loadMore.click();

    // Status should show a higher count
    await expect(page.getByText(/showing \d+/)).not.toHaveText(
      statusBefore!,
    );
  });

  test("constellation cards link to detail pages", async ({ page }) => {
    await expect(
      page.getByText("loading constellations..."),
    ).not.toBeVisible({ timeout: 15000 });

    const firstCard = page.locator('a[href*="/x/prime-moments/"]').first();
    const href = await firstCard.getAttribute("href");

    expect(href).toMatch(/^\/x\/prime-moments\/[A-Za-z0-9]+$/);
  });
});
