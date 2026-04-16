import { expect, test } from "@playwright/test";

test.describe("top-level navigation", () => {
  test("home page renders and links to prime moments", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("func.lol");

    const link = page.getByRole("link", { name: "Prime Moments" });
    await expect(link).toBeVisible();
  });

  test("experiments index lists prime moments", async ({ page }) => {
    await page.goto("/x");
    await expect(page).toHaveTitle(/experiments/i);

    const card = page.getByRole("link", { name: /prime moments/i });
    await expect(card).toBeVisible();
  });

  test("home -> prime moments navigation", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Prime Moments" }).click();
    await page.waitForURL("/x/prime-moments");

    await expect(page.locator("h1")).toContainText("Prime");
  });
});
