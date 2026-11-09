// Browser check for AC31, run against the web build (npm run e2e).
const { test, expect } = require('./fixtures');

test('AC31: each guess shows two numbers: how many in the right place, how many in the wrong place', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99; // the secret is orange x4
  });
  await page.clock.install();
  await page.goto('/');

  for (const color of ['orange', 'orange', 'red', 'red']) await page.getByTestId(`palette-${color}`).click({ force: true });
  await page.getByTestId('submit').click({ force: true });

  await expect(page.getByTestId('feedback-0-exact')).toHaveText('✅2');
  await expect(page.getByTestId('feedback-0-misplaced')).toHaveText('🔄0');
  await expect(page.getByTestId('feedback-0')).toHaveAttribute('aria-label', '2 exact, 0 misplaced');
});
