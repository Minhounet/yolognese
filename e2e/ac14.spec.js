// Browser checks for AC14, run against the web build (npm run e2e).
// Time is driven by Playwright's clock; the lane is random, so each check reads it from the warning.
const { test, expect } = require('@playwright/test');

async function tapLane(page, lane) {
  const box = await page.getByTestId(`lane-${lane}`).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function waitForWarning(page) {
  const warning = page.getByTestId('attack-warning');
  for (let second = 0; second < 21 && !(await warning.isVisible()); second += 1) {
    await page.clock.runFor(1000);
  }
  await expect(warning).toBeVisible();
  const label = await warning.getAttribute('aria-label');
  return Number(label.replace('attack on lane ', ''));
}

test('AC14: the guardian winds up on a lane, and the shield in that lane blocks the meatball', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('shield')).toHaveAttribute('aria-label', 'shield in lane 1');

  const lane = await waitForWarning(page);
  await tapLane(page, lane);
  await expect(page.getByTestId('shield')).toHaveAttribute('aria-label', `shield in lane ${lane}`);
  await page.clock.runFor(2700);

  await expect(page.getByTestId('attack-result')).toHaveText('🛡️ Blocked!');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC14: a meatball landing outside the shield costs 2 life', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const lane = await waitForWarning(page);
  await tapLane(page, (lane + 1) % 3);
  await page.clock.runFor(2700);

  await expect(page.getByTestId('attack-result')).toHaveText('💥 Hit by a meatball! −2 life');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
});

test('AC14: the shield can be dragged from lane to lane', async ({ page }) => {
  await page.goto('/');
  const shield = page.getByTestId('shield');
  await expect(shield).toHaveAttribute('aria-label', 'shield in lane 1');
  const box = await shield.boundingBox();
  const target = await page.getByTestId('lane-2').boundingBox();
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, y, { steps: 12 });
  await page.mouse.up();

  await expect(shield).toHaveAttribute('aria-label', 'shield in lane 2');
});

test('AC14: tapping the shield moves nothing else: the guardian keeps watching', async ({ page }) => {
  await page.goto('/');
  await tapLane(page, 1); // the shield stands in lane 1
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian watching');
  await expect(page.getByTestId('dust')).toHaveCount(0);
});

test('AC15: the meatball falls from the guardian down to the player\'s zone, and takes 2.5 s', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const lane = await waitForWarning(page);
  const meatball = page.getByTestId('meatball');
  await expect(meatball).toBeVisible();
  const start = await meatball.boundingBox();
  await page.clock.runFor(1500);
  const middle = await meatball.boundingBox();
  expect(middle.y).toBeGreaterThan(start.y); // falling down the screen
  await expect(page.getByTestId('attack-result')).not.toHaveText(/Hit|Blocked/); // still in the air after 1.5 s
  await page.clock.runFor(1200);
  await expect(page.getByTestId('attack-result')).toHaveText(lane === 1 ? '🛡️ Blocked!' : '💥 Hit by a meatball! −2 life');
  await expect(page.getByTestId('meatball')).toHaveCount(0);
});

test('AC15: the player\'s zone (shield and life bar) is at the bottom of the screen', async ({ page }) => {
  await page.goto('/');
  const zone = await page.getByTestId('player-zone').boundingBox();
  const guess = await page.getByTestId('submit').boundingBox();
  expect(zone.y).toBeGreaterThan(guess.y);
  await expect(page.getByTestId('player-zone').getByTestId('life')).toBeVisible();
  await expect(page.getByTestId('player-zone').getByTestId('shield')).toBeVisible();
});
