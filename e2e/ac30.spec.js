// Browser check for AC30, run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

test('AC30: after many guesses the newest is always on screen; the oldest give way, 10 at most', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99; // the secret is orange x4, so red x4 always misses
  });
  await page.clock.install();
  await page.goto('/');

  for (let guess = 0; guess < 9; guess += 1) {
    for (let slot = 0; slot < 4; slot += 1) await page.getByTestId('palette-red').click({ force: true });
    await page.getByTestId('submit').click({ force: true });
  }

  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 1 of 10');
  await expect(page.getByTestId('turn-8')).toBeInViewport(); // the 9th, newest guess
  await expect(page.getByTestId('turn-8')).toContainText('#9');
  const shown = await page.locator('[data-testid^="turn-"]').count();
  expect(shown).toBeLessThanOrEqual(10);
  for (let index = 9 - shown; index < 9; index += 1) await expect(page.getByTestId(`turn-${index}`)).toBeInViewport();
  if (shown < 9) await expect(page.getByTestId('turn-0')).toHaveCount(0); // the oldest gave way
});
