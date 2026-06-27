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
// scoped to the sketch's figure (the page has more than one animated sketch).
const solverFigure = (page: import("@playwright/test").Page) =>
  page
    .locator("figure")
    .filter({
      has: page.getByRole("img", {
        name: /small six-edge hole carved from a real Penrose patch/i,
      }),
    });

const unsolvableFigure = (page: import("@playwright/test").Page) =>
  page
    .locator("figure")
    .filter({
      has: page.getByRole("img", {
        name: /sixteen-edge hole with exactly one surviving completion/i,
      }),
    });

test("the geometry-only dead-end sketch mounts and honours the reduced-motion contract", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = solverFigure(page);
  await expect(
    figure.getByRole("img", {
      name: /small six-edge hole carved from a real Penrose patch/i,
    }),
  ).toBeVisible();
  // The harness mounts at the stationary end state, so reset is enabled and step
  // is disabled until the viewer rewinds. This is the reduced-motion contract
  // observed from outside.
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});

test("the unsolvable-future sketch mounts its animated canvas and controls", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = unsolvableFigure(page);
  await expect(
    figure.getByRole("img", {
      name: /sixteen-edge hole with exactly one surviving completion/i,
    }),
  ).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(figure.getByRole("button", { name: "step" })).toBeVisible();
  await expect(figure.getByRole("button", { name: "reset" })).toBeVisible();
});

test("the unsolvable-future sketch loads at its stationary end state", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // Same harness contract: mounts at t = 1 (end state), so reset is enabled and
  // step is disabled until the viewer rewinds.
  const figure = unsolvableFigure(page);
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});

const overlayFigure = (page: import("@playwright/test").Page) =>
  page.locator("figure").filter({
    has: page.getByRole("img", {
      name: /two copies of the same real Penrose tiling/i,
    }),
  });

test("the interference-overlay sketch mounts its animated canvas and controls", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = overlayFigure(page);
  await expect(
    figure.getByRole("img", { name: /two copies of the same real Penrose tiling/i }),
  ).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(figure.getByRole("button", { name: "step" })).toBeVisible();
  await expect(figure.getByRole("button", { name: "reset" })).toBeVisible();
  // The projector motion is the slider: it scrubs the turn of the top layer.
  await expect(figure.getByRole("slider", { name: "scrub" })).toBeVisible();
});

test("the interference-overlay sketch loads at its stationary end state", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // Same harness contract: mounts at t = 1 (the representative islands-and-veins
  // frame), so reset is enabled and step is disabled until the viewer rewinds.
  const figure = overlayFigure(page);
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});

test("the cut-and-project sketch renders and links its two panels on hover", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // The two-panel cut-and-project figure: a real patch in physical space and the
  // bounded shadow window in internal space. It is static (no clock), so it has no
  // control bar; the teaching link is hover.
  const figure = page
    .locator("figure")
    .filter({ has: page.getByRole("img", { name: /two linked panels/i }) });
  const svg = figure.getByRole("img", { name: /two linked panels/i });
  await svg.scrollIntoViewIfNeeded();
  await expect(svg).toBeVisible();

  // The static frame already names a seed tile's address. Hovering a different
  // tile updates the live caption to its ℤ⁵ coordinate.
  await expect(
    figure.getByText(/the shadow of lattice point/i),
  ).toBeVisible();
  const tile = svg.locator("polygon").first();
  await tile.hover();
  await expect(
    figure.getByText(/four corners.*shadows all land inside the window/i),
  ).toBeVisible();
});

const goldenFigure = (page: import("@playwright/test").Page) =>
  page.locator("figure").filter({
    has: page.getByRole("img", {
      name: /the ratio of fat to thin tiles is the golden ratio/i,
    }),
  });

test("the golden-ratio sketch mounts its animated canvas, level slider, and count readout", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = goldenFigure(page);
  await expect(
    figure.getByRole("img", { name: /the ratio of fat to thin tiles is the golden ratio/i }),
  ).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(figure.getByRole("button", { name: "step" })).toBeVisible();
  await expect(figure.getByRole("button", { name: "reset" })).toBeVisible();
  // The level is the slider; the readout shows the running thick/thin ratio.
  await expect(figure.getByRole("slider", { name: "level" })).toBeVisible();
  await expect(figure.getByText(/thick ÷ thin/i)).toBeVisible();
});

test("the golden-ratio sketch loads at its stationary deepest level", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // Same harness contract: mounts at t = 1 (the deepest level, ratio nearest phi),
  // so reset is enabled and step is disabled until the viewer rewinds.
  const figure = goldenFigure(page);
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});

const hierarchyFigure = (page: import("@playwright/test").Page) =>
  page.locator("figure").filter({
    has: page.getByRole("img", {
      name: /deflation zoom-in drawn as nested line grids/i,
    }),
  });

test("the zoom-hierarchy sketch mounts its animated canvas and depth slider", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  const figure = hierarchyFigure(page);
  await expect(
    figure.getByRole("img", { name: /deflation zoom-in drawn as nested line grids/i }),
  ).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "play", exact: true }),
  ).toBeVisible();
  await expect(figure.getByRole("button", { name: "step" })).toBeVisible();
  await expect(figure.getByRole("button", { name: "reset" })).toBeVisible();
  // The depth is the slider; the readout names the supertiles.
  await expect(figure.getByRole("slider", { name: "zoom in" })).toBeVisible();
  await expect(figure.getByText(/supertile/i).first()).toBeVisible();
});

test("the zoom-hierarchy sketch loads at its stationary deepest depth", async ({
  page,
}) => {
  await page.goto("/x/penrose");
  // Same harness contract: mounts at t = 1 (the deepest depth, where the self-
  // similarity reads hardest), so reset is enabled and step is disabled.
  const figure = hierarchyFigure(page);
  const reset = figure.getByRole("button", { name: "reset" });
  const step = figure.getByRole("button", { name: "step" });
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeEnabled();
  await expect(step).toBeDisabled();
  await reset.click();
  await expect(step).toBeEnabled();
  await expect(reset).toBeDisabled();
});
