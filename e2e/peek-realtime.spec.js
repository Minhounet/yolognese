// Bug fix (user, after AC11): "When click on a peg, dont see color and plus it is disappearing."
// Real time on purpose: the AC6 checks freeze the clock, which hid the bug.
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';
const COLOUR = /^(red|yellow|green|blue|purple|orange)$/;

test('Peek at real speed: the peeked peg stays on screen, shows its colour, then turns back', async ({ page }) => {
  await page.goto('/');
  const guardian = page.getByTestId('guardian');
  const box = await guardian.boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(guardian).toHaveAttribute('aria-label', 'guardian looking away');
  const peg = page.getByTestId('secret-1');
  const pegBox = await peg.boundingBox();

  await page.touchscreen.tap(pegBox.x + pegBox.width / 2, pegBox.y + pegBox.height / 2);

  await expect(peg).toHaveAttribute('aria-label', COLOUR);
  await expect(async () => {
    const shown = await peg.boundingBox();
    expect(shown.width).toBeGreaterThan(pegBox.width * 0.9); // fully open, not squeezed away
  }).toPass({ timeout: 400 });
  await expect(peg).toHaveAttribute('aria-label', HIDDEN, { timeout: 1000 });
  await expect(async () => {
    const back = await peg.boundingBox();
    expect(back.width).toBeGreaterThan(pegBox.width * 0.9);
  }).toPass({ timeout: 1000 });
});
