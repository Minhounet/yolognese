// Shared by checks that run the game clock for long (AC14's attacks would otherwise hit at random).
const STEP_MS = 900; // under the 1 s warning, so every attack is seen before it lands

/** Runs the clock for `ms`, moving the shield to every lane the guardian warns of, as a player would. */
async function runForBlockingAttacks(page, ms) {
  const warning = page.getByTestId('attack-warning');
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    await page.clock.runFor(Math.min(STEP_MS, ms - elapsed));
    if (await warning.isVisible()) {
      const lane = (await warning.getAttribute('aria-label')).replace('attack on lane ', '');
      if ((await page.getByTestId('shield').getAttribute('aria-label')) === `shield in lane ${lane}`) continue;
      // a tap where the lane is, as a finger does: under page.clock, Playwright's "stable" wait never ends
      const box = await page.getByTestId(`lane-${lane}`).boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
}

module.exports = { runForBlockingAttacks };
