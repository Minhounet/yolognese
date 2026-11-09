// Browser checks for round 8 (AC24, AC25), run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('AC24: the punch arm is a zig-zag spring, and the glove grows as it comes at the player', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await tapAt(page, page.getByTestId('secret-0')); // caught: the cooldown starts
  await page.clock.runFor(1600); // the laugh is over
  await tapAt(page, page.getByTestId('secret-1')); // during the cooldown: a punch
  const glove = page.getByTestId('meatball');
  const small = await glove.boundingBox();

  await expect(page.getByTestId('punch-arm').locator('polyline')).toHaveCount(1); // the arm is a zig-zag line
  await page.clock.runFor(400);
  const big = await glove.boundingBox();

  expect(big.width).toBeGreaterThan(small.width * 1.8); // nearer: it punches toward the player
});

test('AC25: when the player is caught, the guardian laughs and points at them, then calms down', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('guardian-laugh')).toHaveCount(0);

  await tapAt(page, page.getByTestId('secret-0')); // watched: caught

  await expect(page.getByTestId('guardian-laugh')).toHaveText('HA HA HA!');
  await expect(page.getByTestId('guardian-points')).toBeVisible();
  await page.clock.runFor(1600);
  await expect(page.getByTestId('guardian-laugh')).toHaveCount(0);
  await expect(page.getByTestId('guardian-points')).toHaveCount(0);
});
