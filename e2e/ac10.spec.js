// Browser check for AC10, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

const MISS = ['red', 'red', 'red', 'red'];

// Taps where the element is, as a finger does (see ac4.spec.js).
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function guess(page, colors) {
  for (const color of colors) await page.getByTestId(`palette-${color}`).click();
  await page.getByTestId('submit').click();
}

test('AC10: the life bar starts full, a miss costs 1, being caught costs 2, and empty life loses', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const life = page.getByTestId('life');
  await expect(life).toHaveAttribute('aria-label', 'life 10 of 10');

  await guess(page, MISS);
  if (await page.getByTestId('new-game').isVisible()) test.skip(true, 'the random secret was RRRR');
  await expect(life).toHaveAttribute('aria-label', 'life 9 of 10');

  const peg = page.getByTestId('secret-0');
  for (const left of [7, 5, 3, 1]) {
    await tapAt(page, peg);
    await expect(life).toHaveAttribute('aria-label', `life ${left} of 10`);
    await page.clock.runFor(1600);
  }
  await tapAt(page, peg);

  await expect(life).toHaveAttribute('aria-label', 'life 0 of 10');
  await expect(page.getByTestId('status')).toHaveText('Out of life. The guardian wins.');
  await expect(page.getByTestId('new-game')).toBeVisible();
});
