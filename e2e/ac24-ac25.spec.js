// Browser checks for round 8 (AC24, AC25), run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('AC24: the punch arm is a zig-zag spring, and the glove grows as it comes at the player', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z')); // time moves only when the check says (the arm's samples are tight)
  await tapAt(page, page.getByTestId('secret-0')); // caught: the cooldown starts
  await page.clock.runFor(1600); // the laugh is over
  await tapAt(page, page.getByTestId('secret-1')); // during the cooldown: a punch
  const glove = page.getByTestId('meatball');
  const small = await glove.boundingBox();

  const arm = page.getByTestId('punch-arm');
  await expect(arm.locator('polyline')).toHaveCount(1); // the arm is drawn as a zig-zag line
  const folded = await arm.boundingBox();
  await page.clock.runFor(400);
  const big = await glove.boundingBox();
  const unfolded = await arm.boundingBox();

  expect(big.width).toBeGreaterThan(small.width * 1.8); // nearer: it punches toward the player
  expect(unfolded.height).toBeGreaterThan(folded.height * 2); // the spring unfolds down the screen
  // it lands at about 0.45-0.55 s and returns for 0.3 s: 0.65 s and 0.72 s are inside the return
  await page.clock.runFor(250);
  await expect(page.getByTestId('punch-returning')).toBeVisible();
  const returning = await page.getByTestId('punch-arm').boundingBox();
  await page.clock.runFor(70);
  const shorter = await page.getByTestId('punch-arm').boundingBox();
  expect(shorter.height).toBeLessThan(returning.height); // and folds back
});

test('AC25: when the player is caught, the guardian laughs and points at them, then calms down', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('guardian-laugh')).toHaveCount(0);

  await tapAt(page, page.getByTestId('secret-0')); // watched: caught

  await expect(page.getByTestId('guardian-laugh')).toHaveText('HA HA HA!');
  await expect(page.getByTestId('guardian-points')).toBeVisible();
  await page.clock.runFor(300); // the finger has popped out
  const finger = await page.getByTestId('guardian-points').boundingBox();
  expect(finger.height).toBeGreaterThan(60); // drawn big enough to see clearly (user)
  await page.clock.runFor(1100);
  await expect(page.getByTestId('guardian-laugh')).toBeVisible(); // still laughing just before 1.5 s
  await page.clock.runFor(200);
  await expect(page.getByTestId('guardian-laugh')).toHaveCount(0);
  await expect(page.getByTestId('guardian-points')).toHaveCount(0);
});
