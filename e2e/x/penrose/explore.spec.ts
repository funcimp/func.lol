import { expect, test } from "@playwright/test";

test("explorer mounts a canvas", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
});

test("explorer shows the seed in the HUD", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  await expect(page.getByText(/seed/i)).toBeVisible();
});
