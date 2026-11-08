// Browser check for AC11, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';
const START = new Date('2026-01-01T12:00:00Z').getTime();

// Taps where the element is, as a finger does (see ac4.spec.js).
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC11: after a peek, peeking cools down for 5 s, a peek meanwhile does nothing and costs nothing', async ({ page }) => {
  await page.clock.install({ time: START });
  await page.goto('/');
  await page.clock.pauseAt(START + 1000); // time moves only when the check says so
  const cooldown = page.getByTestId('cooldown');
  const life = page.getByTestId('life');
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');

  await distract(page);
  await tapAt(page, page.getByTestId('secret-0')); // t = 0
  await page.clock.runFor(200); // the peg turns over
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(cooldown).toHaveAttribute('aria-label', 'peek 4% cooled');

  await tapAt(page, page.getByTestId('secret-1')); // still distracted, but cooling down
  await expect(page.getByTestId('status')).toHaveText('Still cooling down: 5 s');
  await page.clock.runFor(200);
  await expect(page.getByTestId('secret-1')).toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(1400); // t = 1800: the guardian watches again
  await tapAt(page, page.getByTestId('secret-1')); // watched, but cooling down: not caught
  await page.clock.runFor(200); // t = 2000
  await expect(life).toHaveAttribute('aria-label', 'life 10 of 10');
  await expect(page.getByTestId('status')).not.toContainText('Caught');
  await expect(cooldown).toHaveAttribute('aria-label', 'peek 40% cooled'); // 2 s of 5: the bar refills
  await page.screenshot({ path: 'test-results/ac11-mid-cooldown.png' });
  await page.clock.runFor(2000); // t = 4000
  await expect(cooldown).toHaveAttribute('aria-label', 'peek 80% cooled');

  await page.clock.runFor(1100); // t = 5100: 5 s after the peek
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');
  await distract(page);
  await tapAt(page, page.getByTestId('secret-1'));
  await page.clock.runFor(200);
  await expect(page.getByTestId('secret-1')).not.toHaveAttribute('aria-label', HIDDEN);
});

test('AC11: being caught starts the cooldown too', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  await tapAt(page, page.getByTestId('secret-0'));

  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'life 8 of 10');
  await expect(page.getByTestId('cooldown')).toHaveAttribute('aria-label', 'peek 0% cooled');
});
