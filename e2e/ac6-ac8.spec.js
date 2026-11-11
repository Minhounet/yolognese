// Browser checks for AC6-AC8 (added by the user during the yolo run), against the web build.
// Time is driven by Playwright's clock, never by a sleep.
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

const HIDDEN = 'hidden peg';
const INK = '#3b2314';

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC6: a peeked peg turns over with an animation, and turns back when the player taps it (AC20)', async ({ page }) => {
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

  await page.clock.runFor(600);
  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN); // no automatic flip back
  await tapAt(page, peg);
  await page.clock.runFor(200);
  await expect(peg).toHaveAttribute('aria-label', HIDDEN);
  expect(await width()).toBeGreaterThan(open * 0.9); // back to its full size once hidden again
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC20: a peg left up when the guardian looks back gets the player caught', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-1');
  await distract(page);
  await peg.tap();
  await expect(peg).not.toHaveAttribute('aria-label', HIDDEN);

  await page.clock.runFor(1700); // the distraction ends: the guardian looks back

  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian watching');
  await expect(page.getByTestId('status')).toContainText('Caught peeking');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
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

test('AC20: a game that ends with a peg up starts the next one clean (no false "caught")', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await distract(page);
  await tapAt(page, page.getByTestId('secret-0'));
  for (let attempt = 0; attempt < 10 && !(await page.getByTestId('new-game').isVisible()); attempt += 1) {
    for (const color of ['red', 'red', 'red', 'red']) await page.getByTestId(`palette-${color}`).click({ force: true });
    await page.getByTestId('submit').click({ force: true });
  }
  await expect(page.getByTestId('new-game')).toBeVisible();
  await page.clock.runFor(1600); // New game ignores taps for 1.5 s after the end

  await page.getByTestId('new-game').click({ force: true });
  for (let tick = 0; tick < 3; tick += 1) {
    await page.clock.runFor(100);
    expect(await page.getByTestId('status').textContent()).toBe('Crack the secret sauce!');
  }
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC20: one peg up at a time: another peg cannot be turned while one is up', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await distract(page);
  await page.getByTestId('secret-0').tap();
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', HIDDEN);

  await tapAt(page, page.getByTestId('secret-1'));
  await page.clock.runFor(300);

  await expect(page.getByTestId('secret-1')).toHaveAttribute('aria-label', HIDDEN);
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});
