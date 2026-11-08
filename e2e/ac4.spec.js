// Browser check for AC4, run against the web build (npm run e2e).
// Time is driven by Playwright's clock (the game's clock reads Date.now).
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';

// Taps where the element is, as a finger does: under page.clock, Playwright's
// "stable" wait counts animation frames, which the frozen clock never runs.
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC4: a peek while the guardian looks away shows the colour briefly', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-2');
  await distract(page);

  await peg.tap();

  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(page.getByTestId('status')).toContainText('10 attempts left');
  await page.clock.runFor(800);
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC4: a peek while the guardian watches is caught and costs one attempt', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-2');

  await peg.tap();

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(page.getByTestId('status')).toContainText('9 attempts left');
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC4: a peek after the guardian looks back is caught', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await distract(page);
  await page.clock.runFor(1600);

  await page.getByTestId('secret-1').tap();

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
});

test('AC4: getting caught on every attempt loses the game, which then rejects peeks', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-0');
  for (let caught = 1; caught <= 10; caught += 1) {
    await tapAt(page, peg);
    await expect(page.getByTestId('status')).toContainText(
      caught < 10 ? `${10 - caught} attempts left` : 'Out of attempts',
      { timeout: 2000 },
    );
    await page.clock.runFor(1600);
  }

  await expect(page.getByTestId('new-game')).toBeVisible();
  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(200); // let the peg finish turning over before tapping it
  await tapAt(page, peg); // the peg is no longer pressable: the tap must change nothing
  await expect(page.getByTestId('status')).toHaveText('Out of attempts. The guardian wins.');
});
