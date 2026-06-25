import { expect, test } from "@playwright/test";

test("the landing page renders the two-tiles sketch", async ({ page }) => {
  await page.goto("/x/penrose");
  const figure = page.getByRole("img", {
    name: /two Penrose rhombi side by side/i,
  });
  await expect(figure).toBeVisible();
});

test("hovering a tile surfaces its golden-ratio detail", async ({ page }) => {
  await page.goto("/x/penrose");
  // The thick rhombus is the first of the two polygons; hovering it surfaces its
  // angle and golden-ratio detail in the live caption.
  const thick = page.locator("svg polygon").first();
  await thick.scrollIntoViewIfNeeded();
  await thick.hover();
  await expect(page.getByText(/long diagonal is exactly/i)).toBeVisible();
});

test("the dead-end sketch mounts its animated canvas and controls", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const canvas = page.getByRole("img", {
    name: /fan of Penrose rhombi laid one at a time/i,
  });
  await expect(canvas).toBeVisible();
  // Animated sketches render the harness control bar; under reduced motion play
  // is disabled but every button still mounts.
  await expect(
    page.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "step" })).toBeVisible();
  await expect(page.getByRole("button", { name: "reset" })).toBeVisible();
});

test("the dead-end sketch loads at its stationary end state", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // The harness mounts at the end state (t = 1) and never moves on load: reset is
  // enabled, step is disabled (already at the end). A reset rewinds to t = 0,
  // which flips both. This is the reduced-motion contract observed from outside.
  const reset = page.getByRole("button", { name: "reset" });
  const step = page.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});
