// Shared helpers for the browser checks. Time is Playwright's clock; chance is scripted.

/**
 * Scripts the game's chance before the app loads (MathRandomSource reads
 * window.__yologneseRandom when it is defined): it returns the values queued with
 * draw(page, ...), then 0. nextInt(max) is floor(random * max), so with nothing
 * queued the secret is four reds, the first item (a food, top left) comes at 8 s,
 * the first attack (a meatball in lane 0) at 10 s.
 */
async function scriptChance(page) {
  await page.addInitScript(() => {
    window.__draws = [];
    window.__yologneseRandom = () => (window.__draws.length > 0 ? window.__draws.shift() : 0);
  });
}

/** Queues the next draws, each as [index, outOf]: nextInt(outOf) will return index. */
async function draw(page, ...picks) {
  await page.evaluate((values) => window.__draws.push(...values), picks.map(([index, outOf]) => (index + 0.5) / outOf));
}

// Taps where the element is, as a finger does: under page.clock, Playwright's
// "stable" wait counts animation frames, which the frozen clock never runs.
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function distract(page, expect) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 100, box.y + box.height / 2);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

module.exports = { scriptChance, draw, tapAt, distract };
