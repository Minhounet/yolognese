// Browser check for AC10, run against the web build (npm run export:web).
const { test, expect } = require('@playwright/test');

const MISS_UNLESS_ALL_RED = ['red', 'red', 'red', 'red'];

async function guess(page, colors) {
  for (const color of colors) await page.getByTestId(`palette-${color}`).click();
  await page.getByTestId('submit').click();
}

test('AC10: the life bar starts full, a missed guess costs 1 and being caught costs 2', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const life = page.getByTestId('life');
  await expect(life).toBeVisible();
  await expect(life).toHaveAttribute('aria-label', 'Life 10 of 10');

  await guess(page, MISS_UNLESS_ALL_RED);
  if (await page.getByTestId('new-game').isVisible()) test.skip(true, 'the secret was all red: the guess won');
  await expect(life).toHaveAttribute('aria-label', 'Life 9 of 10');

  await page.getByTestId('secret-0').tap();
  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(life).toHaveAttribute('aria-label', 'Life 7 of 10');
});
