// Browser checks for AC14, run against the web build (npm run e2e).
// Time is driven by Playwright's clock; the lane is random, so each check reads it from the warning.
const { test, expect } = require('./fixtures');

async function tapLane(page, lane) {
  const box = await page.getByTestId(`lane-${lane}`).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function waitForWarning(page, stepMs = 100) {
  const warning = page.getByTestId('meatball');
  for (let waited = 0; waited < 21000 && !(await warning.isVisible()); waited += stepMs) {
    await page.clock.runFor(stepMs);
  }
  await expect(warning).toBeVisible();
  const label = await warning.getAttribute('aria-label');
  return Number(label.replace('meatball falling on lane ', ''));
}

test('AC14: the guardian winds up on a lane, and the shield in that lane blocks the meatball', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('shield')).toHaveAttribute('aria-label', 'shield in lane 1');

  const lane = await waitForWarning(page);
  await tapLane(page, lane);
  await expect(page.getByTestId('shield')).toHaveAttribute('aria-label', `shield in lane ${lane}`);
  await page.clock.runFor(1700);

  await expect(page.getByTestId('attack-result')).toHaveText('🛡️ Blocked!');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC14: a meatball landing outside the shield costs 2 life', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const lane = await waitForWarning(page);
  await tapLane(page, (lane + 1) % 3);
  await page.clock.runFor(1700);

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

test('AC15: the meatball falls from the guardian down to the player\'s zone, and takes 1.5 s', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(9500); // the first attack comes 10 s at the earliest
  const lane = await waitForWarning(page, 100); // seen within 100 ms of the throw
  const meatball = page.getByTestId('meatball');
  await expect(meatball).toBeVisible();
  const start = await meatball.boundingBox();
  const guardian = await page.getByTestId('guardian').boundingBox();
  expect(start.y).toBeLessThan(guardian.y + guardian.height); // it leaves from the guardian
  await page.clock.runFor(800);
  const middle = await meatball.boundingBox();
  expect(middle.y).toBeGreaterThan(start.y); // falling down the screen
  await expect(page.getByTestId('attack-result')).not.toHaveText(/Hit|Blocked/); // still in the air after 0.8 s
  await page.clock.runFor(600);
  const low = await meatball.boundingBox();
  const target = await page.getByTestId(`lane-${lane}`).boundingBox();
  expect(low.x + low.width / 2).toBeGreaterThan(target.x); // over its lane, near the ground
  expect(low.x + low.width / 2).toBeLessThan(target.x + target.width);
  expect(low.y + low.height).toBeGreaterThan(target.y - target.height * 2);
  await page.clock.runFor(300);
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

test('AC15: the shield follows the finger smoothly, between the lanes too', async ({ page }) => {
  await page.goto('/');
  const shield = page.getByTestId('shield');
  const box = await shield.boundingBox();
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 30, y, { steps: 6 }); // less than half a lane: a snapping shield would not move

  const moved = await shield.boundingBox();
  expect(moved.x + moved.width / 2).toBeGreaterThan(startX + 20);
  expect(moved.x + moved.width / 2).toBeLessThan(startX + 40);
  await page.mouse.up();
});
