// Browser checks for AC13, run against the web build (npm run e2e).
// Each check fixes Math.random before the page loads, so every draw lands on the same index:
// the item kind is that index (0 food, 1 smoke, 2 xray, 3 hourglass, 4 charm, 5 present, 6 bomb);
// a present's gift is drawn the same way among 7 gifts (5 darkness, 6 bomb).
// Time is driven by Playwright's clock.
const { test, expect } = require('./fixtures');

test.use({ itemDraw: null }); // these checks fix Math.random to choose the item

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
  for (let step = 0; step < 40 && !(await item.isVisible()); step += 1) await page.clock.runFor(500);
  await expect(item).toBeVisible();
  return item;
}

test('AC13: an item appears for 4 s, then goes', async ({ page }) => {
  await startWithItem(page, 'food');
  const item = await waitForItem(page);
  await expect(item).toHaveAttribute('aria-label', 'item food');
  await page.clock.runFor(4100);
  await expect(page.getByTestId('item')).toHaveCount(0);
});

test('AC13: food gives back 3 life', async ({ page }) => {
  await startWithItem(page, 'food');
  await tapAt(page, page.getByTestId('secret-0')); // caught: 8
  await page.clock.runFor(5100);
  await tapAt(page, page.getByTestId('secret-0')); // caught: 6
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 6 of 10');

  await tapAt(page, await waitForItem(page));

  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 9 of 10');
  await expect(page.getByTestId('item-note')).toContainText('+3 life');
});

test('AC13: a smoke bomb blinds the guardian: a peek is safe', async ({ page }) => {
  await startWithItem(page, 'smoke');
  await tapAt(page, await waitForItem(page));
  await expect(page.getByTestId('smoke')).toBeVisible();

  await tapAt(page, page.getByTestId('secret-2'));

  await expect(page.getByTestId('secret-2')).not.toHaveAttribute('aria-label', 'hidden peg');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
  await expect(page.getByTestId('status')).not.toContainText('Caught');
});

test('AC13, AC32: x-ray glasses show a hidden peg for a moment only', async ({ page }) => {
  await startWithItem(page, 'xray');
  const hiddenBefore = await page.getByLabel('hidden peg').count();
  await tapAt(page, await waitForItem(page));

  await expect(page.getByLabel('hidden peg')).toHaveCount(hiddenBefore - 1);
  const revealed = page.locator('[data-testid^="secret-"]:not([aria-label="hidden peg"])');
  await expect(revealed).toBeVisible(); // seen, not only labelled: a flip once left it squeezed to nothing
  await page.clock.runFor(1500);
  await expect(page.getByLabel('hidden peg')).toHaveCount(hiddenBefore);
});

test('AC13: an hourglass adds 30 seconds', async ({ page }) => {
  await startWithItem(page, 'hourglass');
  const item = await waitForItem(page);
  const before = await page.getByTestId('timer').textContent();
  await tapAt(page, item);
  await page.clock.runFor(200);

  const [, minutes, seconds] = before.match(/(\d):(\d\d)/).map(Number);
  const expected = minutes * 60 + seconds + 30;
  await expect(page.getByTestId('timer')).toHaveText(
    new RegExp(`${Math.floor(expected / 60)}:${String(expected % 60).padStart(2, '0')}|${Math.floor((expected - 1) / 60)}:${String((expected - 1) % 60).padStart(2, '0')}`),
  );
});

test('AC13: a shield charm blocks the next meatball wherever the shield is', async ({ page }) => {
  await startWithItem(page, 'charm');
  await tapAt(page, await waitForItem(page));
  await expect(page.getByTestId('item-note')).toContainText('Shield charm');

  const warning = page.getByTestId('meatball');
  for (let step = 0; step < 200 && !(await warning.isVisible()); step += 1) await page.clock.runFor(100);
  const lane = Number((await warning.getAttribute('aria-label')).slice(-1));
  await tapAt(page, page.getByTestId(`lane-${(lane + 1) % 3}`)); // the shield moves out of the meatball's lane
  await expect(page.getByTestId('laser-shield')).toBeVisible(); // the charm's green laser (AC26)
  await page.clock.runFor(1700);

  await expect(page.getByTestId('attack-result')).toHaveText('🛡️ Blocked!');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC13: a present turns into another item, named on screen (here darkness, AC29)', async ({ page }) => {
  await startWithItem(page, 'present');
  const item = await waitForItem(page);
  await expect(item).toHaveAttribute('aria-label', 'item present');
  await tapAt(page, item);

  await expect(page.getByTestId('item-note')).toContainText('🎁 → 🌑'); // the same draw picks darkness among the gifts
  await expect(page.getByTestId('darkness')).toBeVisible();
});
