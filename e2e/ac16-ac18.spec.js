// Browser checks for round 4 (AC16-AC18), run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('AC16: no target is shown where the meatball will land', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const meatball = page.getByTestId('meatball');
  for (let waited = 0; waited < 21000 && !(await meatball.isVisible()); waited += 100) await page.clock.runFor(100);
  await expect(meatball).toBeVisible();
  await expect(page.getByText('🎯')).toHaveCount(0);
});

test('AC17: tapping a peg while the guardian watches gets you caught, and never distracts it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  await tapAt(page, page.getByTestId('secret-1'));

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian watching');
  await expect(page.getByTestId('dust')).toHaveCount(0);
  await expect(page.getByTestId('secret-1')).toHaveAttribute('aria-label', 'hidden peg');
});

test.describe('when the guardian sees through the trick', () => {
  test.use({ luck: 0 });

  test('AC18: pointing fails: the guardian keeps watching and punches for 1 life', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const box = await page.getByTestId('guardian').boundingBox();

    await page.touchscreen.tap(box.x + box.width + 120, box.y);

    await expect(page.getByTestId('attack-result')).toHaveText('👊 The guardian saw through it! −1 life');
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 9 of 10');
    await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian watching');
  });
});
