// Browser checks for two phone bugs (user): life "reset" when it ran out, and a cooldown bar that jumped.
const { test, expect } = require('./fixtures');
const { runForBlockingAttacks } = require('./support');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('AC35: a tap right after the game is lost does not start a new game; New game works 1.5 s later', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const peg = page.getByTestId('secret-0');
  for (let caught = 1; caught <= 5; caught += 1) {
    await tapAt(page, peg);
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', `Life ${10 - 2 * caught} of 10`, { timeout: 2000 });
    if (caught < 5) await runForBlockingAttacks(page, 5100); // past the 5 s peek cooldown
  }
  const newGame = page.getByTestId('new-game');
  await expect(newGame).toBeVisible();

  await tapAt(page, newGame); // the next tap, meant for the game that just ended
  await page.clock.runFor(200);
  await expect(page.getByTestId('status')).toHaveText('Out of life. The guardian wins.');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 0 of 10');

  await page.clock.runFor(1400);
  await tapAt(page, newGame);
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
});

test('AC11: the action bar refills progressively: seen part-filled, then fuller, then full (15 s from empty, round 15)', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');
  const track = await page.getByTestId('cooldown').boundingBox();
  await tapAt(page, page.getByTestId('secret-0')); // watched: caught, the bar is emptied
  const drawn = async () => (await page.getByTestId('cooldown-fill').boundingBox()).width / track.width;
  const between = (low, high) => async () => {
    const part = await drawn();
    return part > low && part < high;
  };

  await expect.poll(between(0.1, 0.4), { intervals: [50], timeout: 7000 }).toBe(true);
  await expect.poll(between(0.5, 0.8), { intervals: [50], timeout: 9000 }).toBe(true);
  await expect.poll(drawn, { intervals: [100], timeout: 9000 }).toBeGreaterThan(0.99);
  await expect(page.getByTestId('cooldown')).toHaveAttribute('aria-label', 'Peek ready');
});
