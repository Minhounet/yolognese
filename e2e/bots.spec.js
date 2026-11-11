// Browser checks for the test bots: one page (one phone), the real Supabase project.
// Chance is scripted to 0 (the web build has EXPO_PUBLIC_SCRIPTED_CHANCE=1): every sauce
// drawn on the phone is all red, and a bot's first guess is all red.
const { test, expect } = require('@playwright/test');

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
test.use({ proxy, ignoreHTTPSErrors: proxy !== undefined });

async function openRoomWithBots(page, bots) {
  await page.addInitScript(() => {
    window.__yologneseRandom = () => 0;
  });
  await page.goto('/');
  await page.getByTestId('race').click();
  await page.getByTestId('name').fill('Ann');
  await page.getByTestId('code').fill(`B${Date.now().toString(36).slice(-4).toUpperCase()}`);
  await page.getByTestId('join').click();
  await expect(page.getByTestId('member-Ann')).toBeVisible({ timeout: 15_000 });
  for (let bot = 1; bot <= bots; bot += 1) {
    await page.getByTestId('add-bot').click();
    await expect(page.getByTestId(`member-🤖 Bot ${bot}`)).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.getByTestId('room-status')).toContainText(`${bots + 1} in the room`);
  await page.getByTestId('start-race').click();
}

test('Bots: one phone and two bots make a three-player circle', async ({ page }) => {
  await openRoomWithBots(page, 2);

  await expect(page.getByTestId('target')).toHaveAttribute('aria-label', 'after 🤖 Bot 1', { timeout: 10_000 });
  await expect(page.getByTestId('defence')).toHaveAttribute('aria-label', /^🤖 Bot 2 is after your sauce/);
  await expect(page.getByTestId('switch-in')).toBeVisible();
});

test('Bots: in a duel, the bot guesses and steals the sauce', async ({ page }) => {
  test.setTimeout(60_000);
  await openRoomWithBots(page, 1);

  await expect(page.getByTestId('target')).toHaveAttribute('aria-label', 'after 🤖 Bot 1', { timeout: 10_000 });
  await expect(page.getByTestId('status')).toContainText('Your sauce was stolen', { timeout: 15_000 });
  await expect(page.getByTestId('score-🤖 Bot 1')).toHaveAttribute('aria-label', /^🤖 Bot 1 [1-9]/);
  await expect(page.getByTestId('score-Ann')).toHaveAttribute('aria-label', 'Ann 0');
});
