// Browser checks for AC19, run against the web build (npm run e2e). Time is driven by Playwright's clock.
const { test, expect } = require('./fixtures');

async function tapAt(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function peekDuringCooldown(page) {
  await tapAt(page, page.getByTestId('secret-0')); // watched: caught, −2, the cooldown starts
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
  await page.clock.runFor(1000);
  await tapAt(page, page.getByTestId('secret-1')); // during the cooldown: a punch
  const fist = page.getByTestId('meatball');
  await expect(fist).toHaveAttribute('aria-label', /^punch falling on lane \d$/);
  return Number((await fist.getAttribute('aria-label')).slice(-1));
}

test('AC19: peeking during the cooldown throws a fast punch, parried by the shield in its lane', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const lane = await peekDuringCooldown(page);

  await tapAt(page, page.getByTestId(`lane-${lane}`));
  await page.clock.runFor(800);

  await expect(page.getByTestId('attack-result')).toHaveText('🛡️ Parried!');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 8 of 10');
});

test('AC19: a punch not parried costs 1 life, and it is fast (gone within 0.8 s)', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const lane = await peekDuringCooldown(page);

  await tapAt(page, page.getByTestId(`lane-${(lane + 1) % 3}`));
  await page.clock.runFor(800);

  await expect(page.getByTestId('attack-result')).toHaveText('👊 Punched! −1 life');
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 7 of 10');
  await expect(page.getByTestId('meatball')).toHaveCount(0); // the fist has landed and gone
});
