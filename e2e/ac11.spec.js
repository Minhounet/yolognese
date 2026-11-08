// Browser check for AC11, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('AC11: after a peek the cooldown bar refills for 5 s, and a peek meanwhile is refused at no cost', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const cooldown = page.getByTestId('cooldown');
  const life = page.getByTestId('life');
  await expect(cooldown).toHaveAttribute('aria-label', 'Peek ready');

  await tapAt(page, page.getByTestId('secret-0')); // watched: caught, −2
  await expect(life).toHaveAttribute('aria-label', 'Life 8 of 10');
  await expect(cooldown).toHaveAttribute('aria-label', 'Peek cooling down');

  await page.clock.runFor(2000);
  await tapAt(page, page.getByTestId('secret-1')); // still cooling: refused, no cost
  await expect(cooldown).toHaveAttribute('aria-valuenow', /^[3-5]\d$/); // refilling, about 40 %
  await page.clock.runFor(2800);
  await expect(cooldown).toHaveAttribute('aria-label', 'Peek cooling down');
  await expect(life).toHaveAttribute('aria-label', 'Life 8 of 10');

  await page.clock.runFor(400);
  await expect(cooldown).toHaveAttribute('aria-label', 'Peek ready');
  await tapAt(page, page.getByTestId('secret-1')); // ready again, still watched: caught
  await expect(life).toHaveAttribute('aria-label', 'Life 6 of 10');
});
