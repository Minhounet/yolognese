// Browser checks for round 7 (AC22, AC23), run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function dragTo(page, from, to) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('AC22: a colour dragged onto a slot lands in that slot, the others stay empty', async ({ page }) => {
  await page.goto('/');

  await dragTo(page, page.getByTestId('palette-green'), page.getByTestId('slot-2'));

  await expect(page.getByTestId('slot-2')).toHaveAttribute('aria-label', 'green');
  for (const slot of [0, 1, 3]) await expect(page.getByTestId(`slot-${slot}`)).toHaveAttribute('aria-label', 'empty peg');
});

test('AC22: the same drag with a finger (touch events, as on the phone)', async ({ page }) => {
  await page.goto('/');
  const start = await page.getByTestId('palette-purple').boundingBox();
  const end = await page.getByTestId('slot-3').boundingBox();
  const client = await page.context().newCDPSession(page);
  const point = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const from = point(start);
  const to = point(end);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= 12; step += 1) {
    const at = { x: from.x + ((to.x - from.x) * step) / 12, y: from.y + ((to.y - from.y) * step) / 12 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(page.getByTestId('slot-3')).toHaveAttribute('aria-label', 'purple');
  for (const slot of [0, 1, 2]) await expect(page.getByTestId(`slot-${slot}`)).toHaveAttribute('aria-label', 'empty peg');
});

test('AC22: dropping on a filled slot replaces its colour; a drop outside the slots changes nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('palette-red').click(); // a tap still fills the first empty slot
  await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'red');

  await dragTo(page, page.getByTestId('palette-blue'), page.getByTestId('slot-0'));
  await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'blue');

  await dragTo(page, page.getByTestId('palette-yellow'), page.getByTestId('guardian'));
  for (const slot of [1, 2, 3]) await expect(page.getByTestId(`slot-${slot}`)).toHaveAttribute('aria-label', 'empty peg');
  await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'blue');
});

test('AC23: the punch is a glove on an arm that stretches to its lane, then goes back to the guardian', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await tapAt(page, page.getByTestId('secret-0')); // caught: the cooldown starts
  await page.clock.runFor(1000);
  await tapAt(page, page.getByTestId('secret-1')); // during the cooldown: a punch

  await expect(page.getByTestId('punch-arm')).toHaveCount(1);
  await page.clock.runFor(250);
  const arm = await page.getByTestId('punch-arm').boundingBox();
  expect(arm.width + arm.height).toBeGreaterThan(40); // stretched out from the guardian
  await page.clock.runFor(300); // landed
  await expect(page.getByTestId('punch-returning')).toBeVisible();
  const guardian = await page.getByTestId('guardian').boundingBox();
  const landed = await page.getByTestId('punch-returning').boundingBox();
  await page.clock.runFor(150); // halfway home (the return takes 0.3 s)
  const glove = await page.getByTestId('punch-returning').boundingBox();
  expect(glove.y).toBeLessThan(landed.y); // pulled back up toward the guardian
  expect(glove.y).toBeGreaterThan(guardian.y);
  await page.clock.runFor(300);
  await expect(page.getByTestId('punch-arm')).toHaveCount(0); // home again
});
