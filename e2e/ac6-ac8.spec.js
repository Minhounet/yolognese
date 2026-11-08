// Browser checks for AC6-AC8 (added by the user during the yolo run), against the web build.
// Time is driven by Playwright's clock, never by a sleep.
const { test, expect } = require('@playwright/test');

const HIDDEN = 'hidden peg';
const INK = '#3b2314';

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC6: a peeked peg flips back within half a second', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-1');
  await distract(page);

  const width = () => peg.evaluate((element) => element.parentElement.getBoundingClientRect().width);
  const open = await width();
  await peg.tap();
  await page.clock.runFor(60); // mid-turn: the peg is squeezed toward its edge
  expect(await width()).toBeLessThan(open * 0.8);
  await page.clock.runFor(140);
  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);
  await expect(peg).toBeVisible(); // turned over and open, not left squeezed

  await page.clock.runFor(400);
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(200);
  expect(await width()).toBeGreaterThan(open * 0.9); // back to its full size once hidden again
});

test('AC6: a peeked peg flips back as soon as the guardian looks back', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-1');
  await distract(page);
  await page.clock.runFor(1400);

  await peg.tap();
  await page.clock.runFor(200);

  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian watching');
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
});

test('AC7: the eyes change colour while the guardian looks away, and come back when it watches', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const pupil = page.getByTestId('pupil-left');
  const other = page.getByTestId('pupil-right');
  await expect(pupil).toHaveAttribute('fill', INK);
  await distract(page);

  await page.clock.runFor(200);
  await expect(pupil).not.toHaveAttribute('fill', INK);
  const first = await pupil.getAttribute('fill');
  await expect(other).toHaveAttribute('fill', first);
  await page.clock.runFor(200);
  await expect(pupil).not.toHaveAttribute('fill', first);

  await page.clock.runFor(1200);
  await expect(pupil).toHaveAttribute('fill', INK);
  await expect(other).toHaveAttribute('fill', INK);
});

test('AC8: hitting the screen raises a puff of dust where it was hit, which fades', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  await page.touchscreen.tap(60, 120);

  const dust = page.getByTestId('dust');
  await expect(dust).toHaveCount(1);
  const box = await dust.boundingBox();
  expect(Math.abs(box.x - 60)).toBeLessThan(2);
  expect(Math.abs(box.y - 120)).toBeLessThan(2);
  await page.clock.runFor(500);
  await expect(dust).toHaveCount(0);
});
