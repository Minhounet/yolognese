// Browser checks for AC1 and AC2, run against the web build (npm run export:web).
// One check per AC. The secret is random, so checks read it from the end of a lost game.
const { test, expect } = require('./fixtures');

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const MISS = ['red', 'red', 'red', 'red'];

async function guess(page, colors) {
  for (const color of colors) await page.getByTestId(`palette-${color}`).click();
  await page.getByTestId('submit').click();
}

test('AC1: a guess shows exact and misplaced feedback and stays listed', async ({ page }) => {
  await page.goto(BASE);
  await guess(page, MISS);
  await guess(page, ['blue', 'green', 'yellow', 'orange']);
  await expect(page.getByTestId('turn-0')).toBeVisible();
  await expect(page.getByTestId('turn-1')).toBeVisible();
  await expect(page.getByTestId('feedback-1')).toHaveAttribute('aria-label', /\d exact, \d misplaced/);
});

test('AC2: losing reveals the secret, and a new game starts fresh', async ({ page }) => {
  await page.goto(BASE);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await page.getByTestId('new-game').isVisible()) break;
    await guess(page, MISS);
  }
  await expect(page.getByTestId('status')).toContainText(/Out of life|You cracked it/);
  await expect(page.getByTestId('secret-0')).not.toHaveAttribute('aria-label', 'hidden peg');
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('life')).toHaveAttribute('aria-label', 'Life 10 of 10');
  await expect(page.getByTestId('turn-0')).toHaveCount(0);
  await expect(page.getByTestId('secret-0')).toHaveAttribute('aria-label', 'hidden peg');
});
