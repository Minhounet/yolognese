// Browser checks for AC33 (the mix-up) and AC34 (the fork), against the web build; AC32 is in ac13.spec.js.
// Time is driven by Playwright's clock.
const { test, expect } = require('./fixtures');

// Taps where the element is, as a finger does (the frozen clock never lets Playwright's "stable" wait end).
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function place(page, colors) {
  for (const color of colors) await tapAt(page, page.getByTestId(`palette-${color}`));
}

test.describe('AC34: the fork', () => {
  test.use({ throws: 'forks' });

  test('AC34: a fork falls like the meatball and, unblocked, steals a placed peg but no life', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await place(page, ['blue', 'green']);
    const fork = page.getByTestId('meatball');
    for (let step = 0; step < 50 && !(await fork.isVisible()); step += 1) await page.clock.runFor(500);
    await expect(fork).toHaveAttribute('aria-label', /^fork falling on lane \d$/);
    await expect(page.getByTestId('attack-result')).toContainText('Incoming fork');
    const lane = Number((await fork.getAttribute('aria-label')).slice(-1));
    await tapAt(page, page.getByTestId(`lane-${(lane + 1) % 3}`)); // the shield steps out of its way

    await page.clock.runFor(1700);

    await expect(page.getByTestId('attack-result')).toHaveText('🍴 The fork stole one of your pegs!');
    await expect(page.getByLabel('empty peg')).toHaveCount(3);
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
  });
});

test.describe('AC33: the mix-up', () => {
  test.use({ itemDraw: null });

  test('AC33: a present can switch two of the placed pegs', async ({ page }) => {
    // 0.8 picks a present among the 7 field items, then the mix-up among the 8 gifts, then the two placed pegs
    await page.addInitScript(() => {
      Math.random = () => 0.8;
    });
    await page.clock.install();
    await page.goto('/');
    await place(page, ['blue', 'green']);
    const item = page.getByTestId('item');
    for (let step = 0; step < 40 && !(await item.isVisible()); step += 1) await page.clock.runFor(500);
    await expect(item).toHaveAttribute('aria-label', 'item present');

    await tapAt(page, item);

    await expect(page.getByTestId('item-note')).toContainText('🎁 → 🌀');
    await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'green');
    await expect(page.getByTestId('slot-1')).toHaveAttribute('aria-label', 'blue');
  });
});
