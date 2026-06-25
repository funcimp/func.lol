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

test("the URL gains s, t, z after a click", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();
  await canvas.click({ position: { x: 200, y: 200 } });
  await expect(page).toHaveURL(/[?&]t=/);
  await expect(page).toHaveURL(/[?&]s=/);
  await expect(page).toHaveURL(/[?&]z=/);
});

// Self-contained round-trip: pin a real tile, capture the URL it produces, reload
// that URL, and assert the same address reappears. No hardcoded coordinates, so
// the test cannot drift out of sync with the engine.
test("a pinned address round-trips through the share URL", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();

  // Click the center to pin whatever tile is under the cursor.
  await canvas.click({ position: { x: 200, y: 200 } });

  const pinned = page.getByText(/pinned/i);
  await expect(pinned).toBeVisible();
  const pinnedText = (await pinned.textContent())?.trim();
  expect(pinnedText).toBeTruthy();

  // The debounced write lands within 250ms; wait for the URL to carry t.
  await expect(page).toHaveURL(/[?&]t=/);
  const sharedUrl = page.url();

  // Reload the captured URL in a fresh context and confirm the same pin shows.
  await page.goto(sharedUrl);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/pinned/i)).toHaveText(pinnedText!);
});

// The plane is edgeless: tiles are generated per viewport, so dragging far in one
// direction never reaches a boundary. Drag many times, then confirm a tile address
// still reads under the cursor. A bounded one-patch model would run out of tiles
// and the address HUD would stop updating.
test("the plane has no edge: panning far keeps showing tiles", async ({ page }) => {
  await page.goto("/x/penrose/explore");
  const canvas = page.locator("canvas[aria-label='Penrose tiling explorer canvas']");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  const midX = box.x + box.width / 2,
    midY = box.y + box.height / 2;
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(midX, midY);
    await page.mouse.down();
    await page.mouse.move(midX - 300, midY, { steps: 5 });
    await page.mouse.up();
  }
  await page.mouse.move(midX, midY);
  await expect(page.getByText(/address/i)).toBeVisible();
});
