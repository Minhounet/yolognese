// Browser check for AC4, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC4: a peek while the guardian looks away shows the colour briefly', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-2');
  await distract(page);

  await peg.tap();

  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(page.getByTestId('status')).toContainText('10 attempts left');
  await page.clock.runFor(800);
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC4: a peek while the guardian watches is caught and costs one attempt', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-2');

  await peg.tap();

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(page.getByTestId('status')).toContainText('9 attempts left');
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});
