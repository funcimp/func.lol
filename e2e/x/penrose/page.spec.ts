import { expect, test } from "@playwright/test";

test("the landing page renders the two-tiles sketch", async ({ page }) => {
  await page.goto("/x/penrose");
  const figure = page.getByRole("img", {
    name: /two Penrose rhombi side by side/i,
  });
  await expect(figure).toBeVisible();
});

test("the badge derives the experiment number from publication order", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // Penrose is the third experiment by publishedAt, so the badge must read 03,
  // computed from the labs data rather than hand-set.
  await expect(page.getByText("experiment 03")).toBeVisible();
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

// Each animated sketch carries its own control bar, so button locators must be
// scoped to the sketch's figure (the page now has more than one animated sketch).
const deadEndFigure = (page: import("@playwright/test").Page) =>
  page
    .locator("figure")
    .filter({ has: page.getByRole("img", { name: /fan of Penrose rhombi/i }) });

const solverFigure = (page: import("@playwright/test").Page) =>
  page
    .locator("figure")
    .filter({
      has: page.getByRole("img", { name: /naive greedy solver lays Penrose rhombi/i }),
    });

test("the dead-end sketch mounts its animated canvas and controls", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = deadEndFigure(page);
  await expect(
    figure.getByRole("img", { name: /fan of Penrose rhombi laid one at a time/i }),
  ).toBeVisible();
  // Animated sketches render the harness control bar; under reduced motion play
  // is disabled but every button still mounts.
  await expect(
    figure.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(figure.getByRole("button", { name: "step" })).toBeVisible();
  await expect(figure.getByRole("button", { name: "reset" })).toBeVisible();
});

test("the dead-end sketch loads at its stationary end state", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // The harness mounts at the end state (t = 1) and never moves on load: reset is
  // enabled, step is disabled (already at the end). A reset rewinds to t = 0,
  // which flips both. This is the reduced-motion contract observed from outside.
  const figure = deadEndFigure(page);
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});

test("the naive-solver sketch mounts and honours the reduced-motion contract", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = solverFigure(page);
  await expect(
    figure.getByRole("img", { name: /naive greedy solver lays Penrose rhombi/i }),
  ).toBeVisible();
  // Same harness contract as the dead-end: mounts at the stationary end state, so
  // reset is enabled and step is disabled until the viewer rewinds.
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});
