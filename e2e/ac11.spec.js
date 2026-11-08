// Browser check for AC11, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';

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
  await page.clock.install();
  await page.goto('/');
  const cooldown = page.getByTestId('cooldown');
  const life = page.getByTestId('life');
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');

  await distract(page);
  await tapAt(page, page.getByTestId('secret-0'));
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(cooldown).toHaveAttribute('aria-label', 'peek cooling down');

  await tapAt(page, page.getByTestId('secret-1')); // still distracted, but cooling down
  await page.clock.runFor(200);
  await expect(page.getByTestId('secret-1')).toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(1400); // the guardian watches again
  await tapAt(page, page.getByTestId('secret-1')); // watched, but cooling down: not caught
  await page.clock.runFor(200);
  await expect(life).toHaveAttribute('aria-label', 'life 10 of 10');
  await expect(page.getByTestId('status')).not.toContainText('Caught');
  await expect(cooldown).toHaveAttribute('aria-label', 'peek cooling down');

  await page.clock.runFor(3400); // 5 s after the peek
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');
  await distract(page);
  await tapAt(page, page.getByTestId('secret-1'));
  await expect(page.getByTestId('secret-1')).not.toHaveAttribute('aria-label', HIDDEN);
});

test('AC11: being caught starts the cooldown too', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  await tapAt(page, page.getByTestId('secret-0'));

  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'life 8 of 10');
  await expect(page.getByTestId('cooldown')).toHaveAttribute('aria-label', 'peek cooling down');
});
