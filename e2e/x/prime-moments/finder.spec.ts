import { expect, test } from "@playwright/test";

test.describe("prime moments finder", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/x/prime-moments");
  });

  test("renders the finder form with two empty rows", async ({ page }) => {
    const nameInputs = page.locator('input[type="text"]');
    const dateInputs = page.locator('input[type="date"]');

    await expect(nameInputs).toHaveCount(2);
    await expect(dateInputs).toHaveCount(2);
  });

  test("add and remove person rows", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add/i });
    await addButton.click();

    await expect(page.locator('input[type="date"]')).toHaveCount(3);

    const removeButtons = page.getByRole("button", { name: /remove/i });
    await removeButtons.last().click();

    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test("shows error when no dates are entered", async ({ page }) => {
    await page.getByRole("button", { name: /find prime moments/i }).click();

    const alert = page.locator('[role="alert"]', {
      hasText: "Add at least one person with a birthday",
    });
    await expect(alert).toBeVisible();
  });

  test("finds prime moments for known constellation [0, 30, 32]", async ({
    page,
  }) => {
    // Toups family: offsets [0, 30, 32]
    // Person 1 born 1983-01-14, Person 2 born 1985-07-14, Person 3 born 2015-07-16
    const dateInputs = page.locator('input[type="date"]');
    const nameInputs = page.locator('input[type="text"]');

    await nameInputs.nth(0).fill("Nathan");
    await dateInputs.nth(0).fill("1983-01-14");

    await nameInputs.nth(1).fill("Sarah");
    await dateInputs.nth(1).fill("1985-07-14");

    // Add a third person
    await page.getByRole("button", { name: /add/i }).click();
    await nameInputs.nth(2).fill("Lyra");
    await dateInputs.nth(2).fill("2015-07-16");

    await page.getByRole("button", { name: /find prime moments/i }).click();

    // Should find results with the constellation
    await expect(page.locator("h3").first()).toContainText("prime moment");

    // Should show a "view constellation" link
    const viewLink = page.getByRole("link", {
      name: /view constellation/i,
    });
    await expect(viewLink).toBeVisible();
  });

  test("same birthday deduplicates to constellation [0]", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');

    await dateInputs.nth(0).fill("2000-01-01");
    await dateInputs.nth(1).fill("2000-01-01");

    await page.getByRole("button", { name: /find prime moments/i }).click();

    // Same birthday collapses to [0] (constellations are sets)
    await expect(page.locator("h3").first()).toContainText(
      "constellation [0]",
    );
  });
});
