// Browser check for the race (PEEK-2), two players in two browser contexts,
// through the real Supabase Realtime room (needs the network). Real time, no page clock.
const { test, expect } = require('@playwright/test');

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
test.use({ proxy, ignoreHTTPSErrors: proxy !== undefined });

const room = `T${Date.now().toString(36).slice(-4).toUpperCase()}`;

async function joinRoom(page, name) {
  await page.goto('/');
  await page.getByTestId('race').click();
  await page.getByTestId('name').fill(name);
  await page.getByTestId('code').fill(room);
  await page.getByTestId('join').click();
}

test('Race: two players join a room, the host starts, the first to crack wins and the other is beaten', async ({ browser }) => {
  const ann = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await ann.addInitScript(() => {
    window.__yologneseRandom = () => 0; // the host draws the secret: four reds
  });

  await joinRoom(ann, 'Ann');
  await expect(ann.getByTestId('member-Ann')).toBeVisible({ timeout: 15_000 });
  await joinRoom(bob, 'Bob');
  await expect(ann.getByTestId('member-Bob')).toBeVisible({ timeout: 15_000 });
  await expect(bob.getByTestId('room-status')).toContainText('2 in the room');

  await ann.getByTestId('mode-race').click();
  await expect(bob.getByTestId('mode-rules')).toContainText('Same secret', { timeout: 10_000 });
  await ann.getByTestId('start-race').click();

  await expect(bob.getByTestId('rival-Ann')).toBeVisible({ timeout: 10_000 });
  await expect(ann.getByTestId('rival-Bob')).toBeVisible();
  for (const color of ['red', 'red', 'red', 'blue']) await bob.getByTestId(`palette-${color}`).click();
  await bob.getByTestId('submit').click();
  await expect(ann.getByTestId('rival-Bob')).toHaveAttribute('aria-label', 'Bob: life 9, 3 right', { timeout: 10_000 });

  for (let slot = 0; slot < 4; slot += 1) await ann.getByTestId('palette-red').click();
  await ann.getByTestId('submit').click();

  await expect(ann.getByTestId('status')).toContainText('You cracked it');
  await expect(bob.getByTestId('status')).toHaveText('Ann cracked it first!', { timeout: 10_000 });
  await expect(bob.getByTestId('secret-0')).toHaveAttribute('aria-label', 'red');
});
