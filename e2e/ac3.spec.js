// Browser check for AC3, run against the web build (npm run e2e).
const { test, expect } = require('@playwright/test');

test('AC3: pointing makes the guardian look away for 1.5 s, then it watches again', async ({ page }) => {
  await page.goto('/');
  const guardian = page.getByTestId('guardian');
  await expect(guardian).toHaveAttribute('aria-label', 'guardian watching');

  await page.touchscreen.tap(30, 60); // top-left of the scene, away from every control

  await expect(guardian).toHaveAttribute('aria-label', 'guardian looking away');
  await page.waitForTimeout(1200);
  await expect(guardian).toHaveAttribute('aria-label', 'guardian looking away');
  await expect(guardian).toHaveAttribute('aria-label', 'guardian watching', { timeout: 1500 });
});
