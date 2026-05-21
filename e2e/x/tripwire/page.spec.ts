import { test, expect } from "@playwright/test"

import { FIXTURE_AGGREGATES } from "../../fixtures/aggregates"

// Loads /x/tripwire and asserts that the hero numbers come from the fake
// blob server seeded with FIXTURE_AGGREGATES. If this fails, either the
// blob fetch path is broken or the fake didn't seed.
test("tripwire page renders hero numbers from the seeded aggregates", async ({ page }) => {
  await page.goto("/x/tripwire")
  await expect(page.locator("h1")).toContainText("tripwire")

  const { lifetime } = FIXTURE_AGGREGATES
  await expect(page.getByText(String(lifetime.totalEvents), { exact: true })).toBeVisible()
  await expect(page.getByText(String(lifetime.distinctIps), { exact: true })).toBeVisible()
  await expect(page.getByText(String(lifetime.distinctPaths), { exact: true })).toBeVisible()
  await expect(page.getByText(String(lifetime.distinctAsns), { exact: true })).toBeVisible()
})
