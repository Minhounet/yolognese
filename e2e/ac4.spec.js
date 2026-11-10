// Browser check for AC4 (read through AC10's life bar and AC11's cooldown), against the web build.
// Time is driven by Playwright's clock (the game's clock reads Date.now); chance is scripted.
const { test, expect } = require('@playwright/test');
const { scriptChance, tapAt, distract } = require('./support/game');

const HIDDEN = 'hidden peg';

test.beforeEach(async ({ page }) => {
  await scriptChance(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByTestId('solo').click();
});

test('AC4: a peek while the guardian looks away shows the colour briefly', async ({ page }) => {
  const peg = page.getByTestId('secret-2');
  await distract(page, expect);

  await peg.tap();

  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(page.getByTestId('life-bar')).toHaveAttribute('aria-label', 'life 10 of 10');
  await page.clock.runFor(800);
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC4: a peek while the guardian watches is caught and costs two life', async ({ page }) => {
  const peg = page.getByTestId('secret-2');

  await peg.tap();

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(page.getByTestId('life-bar')).toHaveAttribute('aria-label', 'life 8 of 10');
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC4: a peek after the guardian looks back is caught', async ({ page }) => {
  await distract(page, expect);
  await page.clock.runFor(1600);

  await page.getByTestId('secret-1').tap();

  await expect(page.getByTestId('status')).toContainText('Caught peeking');
});

test('AC4: getting caught again and again loses the game, which then rejects peeks', async ({ page }) => {
  await page.getByTestId('lane-0').tap(); // the scripted attacks come in lane 0: block them
  const peg = page.getByTestId('secret-0');
  for (let caught = 1; caught <= 5; caught += 1) {
    await tapAt(page, peg);
    await expect(page.getByTestId('life-bar')).toHaveAttribute('aria-label', `life ${10 - 2 * caught} of 10`);
    await page.clock.runFor(5100); // past the cooldown
  }

  await expect(page.getByTestId('new-game')).toBeVisible();
  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(200); // let the peg finish turning over before tapping it
  await tapAt(page, peg); // the peg is no longer pressable: the tap must change nothing
  await expect(page.getByTestId('status')).toHaveText('Out of life. The guardian wins.');
});
