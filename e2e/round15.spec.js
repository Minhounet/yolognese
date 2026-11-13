// Browser checks for round 15 (PEEK-3): the action bar (AC2), the shell game (AC3), the taunt duel
// against the guardian (AC4-AC6). Solo games on the web build; time driven by Playwright's clock.
// The match's duel and the K.O. (AC1, AC7) are in steal.spec.js (they need the server).
const { test, expect } = require('./fixtures');
const { runForBlockingAttacks } = require('./support');

// Taps where the element is, as a finger does (the frozen clock never lets Playwright's "stable" wait end).
async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Misses `count` guesses: one life each. */
async function miss(page, count) {
  for (let guess = 0; guess < count; guess += 1) {
    for (const color of ['purple', 'purple', 'orange', 'orange']) await tapAt(page, page.getByTestId(`palette-${color}`));
    await tapAt(page, page.getByTestId('submit'));
  }
}

async function distract(page) {
  const box = await page.getByTestId('guardian').boundingBox();
  await page.touchscreen.tap(box.x + box.width + 120, box.y);
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
}

test('AC2: the action bar holds three charges: a peek costs one, the shell game two, the taunt needs all three', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(200);
  const bar = page.getByTestId('cooldown');
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('action-taunt')).toBeEnabled();

  await distract(page);
  await tapAt(page, page.getByTestId('secret-2')); // a peek that gets through
  await page.clock.runFor(100);
  await expect(bar).toHaveAttribute('aria-valuetext', '2 of 3 charges');
  await expect(bar).toHaveAttribute('aria-label', 'Peek ready');
  await expect(page.getByTestId('action-taunt')).toBeDisabled();
  await expect(page.getByTestId('action-shell')).toBeEnabled();
  await tapAt(page, page.getByTestId('secret-2')); // flipped back

  await tapAt(page, page.getByTestId('action-shell'));
  await page.clock.runFor(100);
  await expect(bar).toHaveAttribute('aria-valuetext', '0 of 3 charges');
  await expect(bar).toHaveAttribute('aria-label', 'Peek cooling down');
  await page.clock.runFor(5000);
  await expect(bar).toHaveAttribute('aria-valuetext', '1 of 3 charges');
  await expect(bar).toHaveAttribute('aria-label', 'Peek ready');
});

test.describe('AC3: the shell game', () => {
  // the draws fixed at 0: the 🍝 starts under the left cup; five swaps of the two left cups leave it in the middle
  test.use({ shellDraw: 0 });

  test('AC3: the 🍝 is shown, the cups swap, and finding it refills 3 life', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await miss(page, 3);
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 7 of 10');

    await tapAt(page, page.getByTestId('action-shell'));
    await page.clock.runFor(100);
    await expect(page.getByTestId('shell-sauce')).toBeVisible();
    await expect(page.getByTestId('shell-status')).toHaveText('Watch the 🍝…');
    const before = (await page.getByTestId('cup-1').boundingBox()).x; // the left cup, which ends in the middle
    await page.clock.runFor(1200);
    await expect(page.getByTestId('shell-sauce')).toHaveCount(0);
    await expect(page.getByTestId('shell-status')).toHaveText('Shuffling…');
    await page.clock.runFor(2400);
    await expect(page.getByTestId('shell-status')).toContainText('Where is the 🍝?');
    const after = (await page.getByTestId('cup-1').boundingBox()).x;
    expect(after).toBeGreaterThan(before + 40); // it moved one place to the right

    await tapAt(page, page.getByTestId('cup-1'));

    await expect(page.getByTestId('shell-status')).toHaveText('🍝 Found it! +3 life');
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
    await page.clock.runFor(1600);
    await expect(page.getByTestId('shell-game')).toHaveCount(0);
  });

  test('AC3: another cup gives nothing, and the 🍝 is shown where it was', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await miss(page, 3);
    await tapAt(page, page.getByTestId('action-shell'));
    await page.clock.runFor(3600);

    await tapAt(page, page.getByTestId('cup-2'));

    await expect(page.getByTestId('shell-status')).toHaveText('😝 Missed! The 🍝 was there');
    await expect(page.getByTestId('shell-sauce')).toBeVisible();
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 7 of 10');
  });
});

test.describe('AC4-AC5: taunting the guardian', () => {
  // offered: insults 0, 1, 2; the guardian picks another comeback (draw 1), after 1 s; it gives 2 life (draw 1)
  test.use({ duelDraw: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0] });

  test('AC4: the taunt offers three insults; the guardian misses its comeback: +2 life, shown 2.5 s', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await miss(page, 2);

    await tapAt(page, page.getByTestId('action-taunt'));
    await expect(page.getByTestId('insult-0')).toBeVisible();
    await expect(page.getByTestId('insult-2')).toBeVisible();
    await tapAt(page, page.getByTestId('insult-1'));
    await page.clock.runFor(100);
    await expect(page.getByTestId('duel-waiting')).toContainText('The guardian looks for a comeback');
    await page.clock.runFor(1000);

    await expect(page.getByTestId('duel-result')).toHaveText('🏆 You win! ❤️ +2 life from the guardian');
    await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
    await page.clock.runFor(2300);
    await expect(page.getByTestId('duel-result')).toBeVisible();
    await page.clock.runFor(300);
    await expect(page.getByTestId('duel-result')).toHaveCount(0);
  });
});

test.describe('AC5-AC6: the guardian taunts the player', () => {
  test.use({ guardianTaunts: true });

  test.describe('the flip and the dizzy guardian', () => {
    // all draws 2: the guardian taunts at 40 s with insult 2, comebacks 3, 4, 2; it would be dizzy, the player upside down
    test.use({ duelDraw: 2 });

    test('AC6, AC5: the guardian taunts after 40 s; a wrong comeback turns the screen upside down for 8 s', async ({ page }) => {
      await page.clock.install();
      await page.goto('/');
      await runForBlockingAttacks(page, 39_900);
      await expect(page.getByTestId('duel')).toHaveCount(0);
      await page.clock.runFor(300);
      await expect(page.getByTestId('duel-insult')).toHaveText('“You cook spaghetti like a tourist!”');
      for (const comeback of [2, 3, 4]) await expect(page.getByTestId(`comeback-${comeback}`)).toBeVisible();

      await tapAt(page, page.getByTestId('comeback-3'));

      await expect(page.getByTestId('duel-result')).toHaveText('😖 The guardian wins! 🙃 Upside down for 8 s');
      await expect(page.getByTestId('upside-down')).toHaveCount(1);
      const turned = await page.getByTestId('scene').evaluate((scene) => getComputedStyle(scene).transform);
      expect(turned).toMatch(/^matrix\(-1, .*-1, 0, 0\)$/);
      await runForBlockingAttacks(page, 8100);
      await expect(page.getByTestId('upside-down')).toHaveCount(0);
    });

    test('AC4, AC5: the insult\'s own comeback wins; the guardian is dizzy and looks away', async ({ page }) => {
      await page.clock.install();
      await page.goto('/');
      await runForBlockingAttacks(page, 40_200);

      await tapAt(page, page.getByTestId('comeback-2'));

      await expect(page.getByTestId('duel-result')).toHaveText('🏆 You win! 😵 The guardian is dizzy: peek now!');
      await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian looking away');
    });
  });

  test.describe('the lying palette', () => {
    // the taunt at 40 s (draw 0), insult 2, comebacks 3, 4, 2; the player's penalty: the palette (draw 1), shifted by one
    test.use({ duelDraw: [0, 2, 2, 2, 2, 0, 1, 0, 0] });

    test('AC5: a lost duel makes the palette lie for 10 s: red places yellow', async ({ page }) => {
      await page.clock.install();
      await page.goto('/');
      await runForBlockingAttacks(page, 40_200);
      await tapAt(page, page.getByTestId('comeback-4'));
      await expect(page.getByTestId('scrambled')).toBeVisible();

      await tapAt(page, page.getByTestId('palette-red'));
      await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'yellow');
      await runForBlockingAttacks(page, 10_100);
      await expect(page.getByTestId('scrambled')).toHaveCount(0);
      await tapAt(page, page.getByTestId('palette-red'));
      await expect(page.getByTestId('slot-1')).toHaveAttribute('aria-label', 'red');
    });
  });
});
