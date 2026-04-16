import { expect, test } from "@playwright/test";

test.describe("constellation sharing", () => {
  test("renders a valid base62 constellation", async ({ page }) => {
    // 1Be encodes offsets [0, 30, 32]
    await page.goto("/x/prime-moments/1Be");

    await expect(page.getByText("[0, 30, 32]")).toBeVisible();
  });

  test("renders a valid dot-separated constellation", async ({ page }) => {
    await page.goto("/x/prime-moments/0.30.32");

    await expect(page.getByText("[0, 30, 32]")).toBeVisible();
  });

  test("shows invalid message for bad constellation", async ({ page }) => {
    await page.goto("/x/prime-moments/0.1.2");

    await expect(page.locator("h1")).toContainText("Invalid constellation");
  });

  test("back link returns to prime moments", async ({ page }) => {
    await page.goto("/x/prime-moments/1Be");

    await page.getByRole("link", { name: /prime moments/i }).click();
    await page.waitForURL("/x/prime-moments");

    await expect(page.locator("h1")).toContainText("Prime");
  });
});
