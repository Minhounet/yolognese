// Browser check for "steal the sauce" (PEEK-3): three players in three browser contexts,
// through the real Supabase project (room, sign-in and the match server; needs the network).
// Real time, no page clock.
const { test, expect } = require('@playwright/test');

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
test.use({ proxy, ignoreHTTPSErrors: proxy !== undefined });

const room = `S${Date.now().toString(36).slice(-4).toUpperCase()}`;

async function joinRoom(browser, name) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByTestId('race').click();
  await page.getByTestId('name').fill(name);
  await page.getByTestId('code').fill(room);
  await page.getByTestId('join').click();
  await expect(page.getByTestId(`member-${name}`)).toBeVisible({ timeout: 15_000 });
  return page;
}

/** The sauce the server says this player hides, as its game screen shows it. */
async function sauceOf(page) {
  await expect(page.getByTestId('my-sauce-3')).not.toHaveAttribute('aria-label', 'empty peg', { timeout: 10_000 });
  return Promise.all([0, 1, 2, 3].map((slot) => page.getByTestId(`my-sauce-${slot}`).getAttribute('aria-label')));
}

test('Steal the sauce: each attacks the next seat; a crack scores, renews the sauce and turns the circle', async ({ browser }) => {
  test.setTimeout(90_000);
  const ann = await joinRoom(browser, 'Ann');
  const bob = await joinRoom(browser, 'Bob');
  const cid = await joinRoom(browser, 'Cid');
  await expect(ann.getByTestId('room-status')).toContainText('3 in the room', { timeout: 15_000 });
  await expect(cid.getByTestId('mode-rules')).toContainText('hides a secret');
  await bob.getByTestId('sauce-0').click(); // Bob changes his sauce in the room: the server keeps it, nobody else sees it
  const chosen = await Promise.all([0, 1, 2, 3].map((slot) => bob.getByTestId(`sauce-${slot}`).getAttribute('aria-label')));

  await ann.getByTestId('start-race').click();

  await expect(ann.getByTestId('target')).toHaveAttribute('aria-label', 'after Bob', { timeout: 10_000 });
  await expect(bob.getByTestId('target')).toHaveAttribute('aria-label', 'after Cid', { timeout: 10_000 });
  await expect(cid.getByTestId('target')).toHaveAttribute('aria-label', 'after Ann', { timeout: 10_000 });
  await expect(cid.getByTestId('defence')).toHaveAttribute('aria-label', 'Bob is after your sauce: 0 right');
  const bobSauce = await sauceOf(bob);
  expect(bobSauce).toEqual(chosen);

  for (const color of bobSauce) await ann.getByTestId(`palette-${color}`).click();
  await ann.getByTestId('submit').click();

  await expect(ann.getByTestId('score-Ann')).toHaveAttribute('aria-label', 'Ann 1');
  await expect(cid.getByTestId('score-Ann')).toHaveAttribute('aria-label', 'Ann 1', { timeout: 10_000 });
  await expect(bob.getByTestId('status')).toContainText('Your sauce was stolen', { timeout: 10_000 });
  await expect(ann.getByTestId('target')).toHaveAttribute('aria-label', 'after Cid');
  await expect(bob.getByTestId('target')).toHaveAttribute('aria-label', 'after Ann', { timeout: 10_000 });
  await expect(cid.getByTestId('target')).toHaveAttribute('aria-label', 'after Bob', { timeout: 10_000 });
});
