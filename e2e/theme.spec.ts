import { expect, test } from "@playwright/test";

test.describe("theme toggle", () => {
  test("defaults to dark theme", async ({ page }) => {
    await page.goto("/");
    const theme = await page
      .locator("html")
      .getAttribute("data-theme");
    expect(theme).toBe("dark");
  });

  test("toggles to light and back", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", {
      name: /switch to light mode/i,
    });
    await toggle.click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "light",
    );

    const toggleBack = page.getByRole("button", {
      name: /switch to dark mode/i,
    });
    await toggleBack.click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });

  test("persists theme across page loads", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", {
      name: /switch to light mode/i,
    });
    await toggle.click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "light",
    );

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "light",
    );
  });
});
