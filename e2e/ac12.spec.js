// Browser check for AC12, run against the web build (npm run e2e).
// The page clock is paused: time moves only when the check says so.
const { test, expect } = require('@playwright/test');

const START = new Date('2026-01-01T12:00:00Z').getTime();

test('AC12: a game lasts 3 minutes, shown as a countdown; at 0 it is lost and the secret shown', async ({ page }) => {
  await page.clock.install({ time: START });
  await page.goto('/');
  await page.clock.pauseAt(START + 1000);
  const time = page.getByTestId('time');
  await page.clock.runFor(200);
  await expect(time).toHaveAttribute('aria-label', 'time 3:00 left');
  await expect(time).toContainText('3:00');

  await page.clock.runFor(60000);
  await expect(time).toHaveAttribute('aria-label', /time 2:0\d left/);

  await page.clock.runFor(120000);
  await expect(time).toHaveAttribute('aria-label', 'time 0:00 left');
  await expect(page.getByTestId('status')).toHaveText("Time's up! The guardian wins.");
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', 'hidden peg');
  await expect(page.getByTestId('new-game')).toBeVisible();
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'life 10 of 10');

  await page.getByTestId('new-game').click();
  await page.clock.runFor(200);
  await expect(time).toHaveAttribute('aria-label', 'time 3:00 left');
});
