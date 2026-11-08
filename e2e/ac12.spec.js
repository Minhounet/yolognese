// Browser check for AC12, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

test('AC12: a 3 minute countdown, and at 0 the game is lost and the secret shown', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const timer = page.getByTestId('timer');
  await page.clock.runFor(200);
  await expect(timer).toHaveText('⏱️ 3:00');
  await expect(page.getByTestId('secret-0')).toHaveAttribute('aria-label', 'hidden peg');

  await page.clock.runFor(61000);
  await expect(timer).toHaveText('⏱️ 1:59');
  await expect(page.getByTestId('status')).toHaveText('Crack the secret sauce!');

  await page.clock.runFor(119000);
  await expect(timer).toHaveText('⏱️ 0:00');
  await expect(page.getByTestId('status')).toHaveText("Time's up! The guardian wins.");
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', 'hidden peg');
  await expect(page.getByTestId('new-game')).toBeVisible();
});
