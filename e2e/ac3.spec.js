// Browser check for AC3, run against the web build (npm run e2e).
// Time is driven by Playwright's clock, never by a sleep.
const { test, expect } = require('@playwright/test');

async function leftPupilX(page) {
  // the pupils are the circles filled with the ink colour; the left one is drawn first
  const pupils = page.getByTestId('guardian').locator('circle[fill="#3b2314"]');
  return Number(await pupils.first().getAttribute('cx'));
}

test('AC3: pointing makes the guardian look at the spot for 1.5 s, then it watches again', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const guardian = page.getByTestId('guardian');
  await expect(guardian).toHaveAttribute('aria-label', 'guardian watching');
  const watchingX = await leftPupilX(page);

  const box = await guardian.boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y); // to the right of the guardian, on empty space

  await expect(guardian).toHaveAttribute('aria-label', 'guardian looking away');
  expect(await leftPupilX(page)).toBeGreaterThan(watchingX);
  await page.clock.runFor(1400);
  await expect(guardian).toHaveAttribute('aria-label', 'guardian looking away');
  await page.clock.runFor(200);
  await expect(guardian).toHaveAttribute('aria-label', 'guardian watching');
});
