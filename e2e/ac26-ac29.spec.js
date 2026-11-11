// Browser checks for round 9 (AC26-AC29), run against the web build (npm run e2e).
// Item checks fix Math.random so every draw lands on one index of the 7 kinds
// (0 food, 1 smoke, 2 xray, 3 hourglass, 4 charm, 5 present, 6 bomb). Time is Playwright's clock.
const { test, expect } = require('./fixtures');

test.use({ itemDraw: null }); // these checks fix Math.random to choose the item
const { runForBlockingAttacks } = require('./support');

const KINDS = ['food', 'smoke', 'xray', 'hourglass', 'charm', 'present', 'bomb'];

// A draw that makes a present (5 of 7 kinds) and then darkness (5 of 8 gifts, AC33 added the mix-up).
const PRESENT_THEN_DARKNESS = 0.73;

async function startWithItem(page, kind) {
  const draw = kind === 'present' ? PRESENT_THEN_DARKNESS : (KINDS.indexOf(kind) + 0.5) / KINDS.length;
  await page.addInitScript((value) => {
    Math.random = () => value;
  }, draw);
  await page.clock.install();
  await page.goto('/');
}

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function waitForItem(page) {
  const item = page.getByTestId('item');
  for (let step = 0; step < 60 && !(await item.isVisible()); step += 1) await page.clock.runFor(500);
  await expect(item).toBeVisible();
  return item;
}

test('AC28: a bomb left on the field explodes when its 4 s end: 2 life', async ({ page }) => {
  await startWithItem(page, 'bomb');
  const bomb = await waitForItem(page);
  await expect(bomb).toHaveAttribute('aria-label', 'item bomb');

  await page.clock.runFor(4100);

  await expect(page.getByTestId('explosion')).toBeVisible();
  await expect(page.getByTestId('attack-result')).toHaveText('💥 The bomb exploded! −2 life');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
});

test('AC28: a bomb tapped in time is thrown away', async ({ page }) => {
  await startWithItem(page, 'bomb');
  await tapAt(page, await waitForItem(page));
  await expect(page.getByTestId('item-note')).toContainText('Bomb thrown away!');
  await expect(page.getByTestId('attack-result')).not.toContainText('exploded');

  await runForBlockingAttacks(page, 4100); // the first meatball may come meanwhile: the shield blocks it

  await expect(page.getByTestId('explosion')).toHaveCount(0);
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC29: darkness veils the game for 4 s, then the player sees again', async ({ page }) => {
  await startWithItem(page, 'present'); // the same draw makes the present's gift darkness
  await tapAt(page, await waitForItem(page));
  await expect(page.getByTestId('darkness')).toBeVisible();

  await page.clock.runFor(3800);
  await expect(page.getByTestId('darkness')).toBeVisible();
  await page.clock.runFor(400);
  await expect(page.getByTestId('darkness')).toHaveCount(0);
});

test('AC26: the x-ray glasses fire a beam that ends on the peg they reveal', async ({ page }) => {
  await startWithItem(page, 'xray');
  await tapAt(page, await waitForItem(page));
  await expect(page.getByTestId('xray-beam')).toBeVisible();
  await page.clock.runFor(300); // the beam has reached its peg
  const revealed = page.locator('[data-testid^="secret-"]:not([aria-label="hidden peg"])');
  const peg = await revealed.boundingBox();
  const ends = await page.getByTestId('xray-beam').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [{ x: box.left, y: box.top }, { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }, { x: box.right, y: box.top }];
  });
  const near = ends.some((end) => end.x >= peg.x - 12 && end.x <= peg.x + peg.width + 12 && end.y >= peg.y - 12 && end.y <= peg.y + peg.height + 12);
  expect(near).toBe(true);
  await page.clock.runFor(700);
  await expect(page.getByTestId('xray-beam')).toHaveCount(0);
});

test('AC26: the smoke grenade leaves a cloud over the guardian', async ({ page }) => {
  await startWithItem(page, 'smoke');
  await tapAt(page, await waitForItem(page));
  await page.clock.runFor(400);
  const cloud = await page.getByTestId('smoke').boundingBox();
  const guardian = await page.getByTestId('guardian').boundingBox();
  expect(cloud.y).toBeLessThan(guardian.y + guardian.height);
  expect(cloud.y + cloud.height).toBeGreaterThan(guardian.y);
});

test('AC27: the life just lost blinks in the bar before it goes', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByTestId('life-lost')).toHaveCount(0);

  await tapAt(page, page.getByTestId('secret-0')); // watched: caught, −2

  await expect(page.getByTestId('life-lost')).toBeVisible();
  await page.clock.runFor(600);
  await expect(page.getByTestId('life-lost')).toHaveCount(0);
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
});
