// Browser checks for "steal the sauce": players in separate browser contexts (phones) and test bots,
// through the real Supabase project (rooms, sign-in and the match server; needs the network).
// Real time: the match is refereed by the server's clock, so no page clock here.
const { test, expect } = require('./fixtures');

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
test.use({ menu: 'stay', proxy, ignoreHTTPSErrors: proxy !== undefined });

const roomCode = (prefix) => `${prefix}${Date.now().toString(36).slice(-4).toUpperCase()}`;

async function joinRoom(page, room, name) {
  await page.goto('/');
  await page.getByTestId('friends').click();
  await page.getByTestId('name').fill(name);
  await page.getByTestId('code').fill(room);
  await page.getByTestId('join').click();
  await expect(page.getByTestId(`member-${name}`)).toBeVisible({ timeout: 15_000 });
}

/** A phone with the fixtures' settings (every throw a meatball, the guardian always fooled). */
async function phone(browser, extra = {}) {
  const context = await browser.newContext({ ...extra });
  const page = await context.newPage();
  await page.addInitScript(() => {
    globalThis.yologneseLuck = 1;
    globalThis.yologneseItemDraw = 0;
    globalThis.yologneseThrows = 'meatballs';
  });
  return page;
}

/** The sauce the server says this player hides, as its game screen shows it. */
async function sauceOf(page) {
  await expect(page.getByTestId('my-sauce-3')).not.toHaveAttribute('aria-label', 'empty peg', { timeout: 10_000 });
  return Promise.all([0, 1, 2, 3].map((slot) => page.getByTestId(`my-sauce-${slot}`).getAttribute('aria-label')));
}

test('Steal the sauce: three phones; each attacks the next; a crack scores, renews the sauce and turns the circle', async ({ browser }) => {
  test.setTimeout(90_000);
  const settings = { proxy, ignoreHTTPSErrors: proxy !== undefined };
  const room = roomCode('S');
  const [ann, bob, cid] = [await phone(browser, settings), await phone(browser, settings), await phone(browser, settings)];
  await joinRoom(ann, room, 'Ann');
  await joinRoom(bob, room, 'Bob');
  await joinRoom(cid, room, 'Cid');
  await expect(ann.getByTestId('room-status')).toContainText('3 in the room', { timeout: 15_000 });
  await bob.getByTestId('sauce-0').click(); // Bob changes his sauce in the room: the server keeps it, nobody else sees it
  const chosen = await Promise.all([0, 1, 2, 3].map((slot) => bob.getByTestId(`sauce-${slot}`).getAttribute('aria-label')));

  await ann.getByTestId('start-match').click();

  await expect(ann.getByTestId('target')).toHaveAttribute('aria-label', 'after Bob', { timeout: 10_000 });
  await expect(bob.getByTestId('target')).toHaveAttribute('aria-label', 'after Cid', { timeout: 10_000 });
  await expect(cid.getByTestId('target')).toHaveAttribute('aria-label', 'after Ann', { timeout: 10_000 });
  await expect(cid.getByTestId('defence')).toHaveAttribute('aria-label', 'Bob is after your sauce: 0 right');
  const bobSauce = await sauceOf(bob);
  expect(bobSauce).toEqual(chosen);

  for (const color of bobSauce) await ann.getByTestId(`palette-${color}`).click();
  await ann.getByTestId('submit').click();

  await expect(ann.getByTestId('score-Ann')).toHaveAttribute('aria-label', 'Ann 1', { timeout: 10_000 });
  await expect(cid.getByTestId('score-Ann')).toHaveAttribute('aria-label', 'Ann 1', { timeout: 10_000 });
  await expect(bob.getByTestId('status')).toContainText('Your sauce was stolen', { timeout: 10_000 });
  await expect(ann.getByTestId('target')).toHaveAttribute('aria-label', 'after Cid');
  await expect(bob.getByTestId('target')).toHaveAttribute('aria-label', 'after Ann', { timeout: 10_000 });
  await expect(cid.getByTestId('target')).toHaveAttribute('aria-label', 'after Bob', { timeout: 10_000 });
});

test.describe('Steal the sauce with test bots (one phone)', () => {
  // the match's draws fixed at 0: every sauce drawn on the phone is all red, and a bot's first guess is all red
  async function openRoomWithBots(page, bots) {
    await page.addInitScript(() => {
      globalThis.yologneseMatchDraw = 0;
    });
    await joinRoom(page, roomCode('B'), 'Ann');
    for (let bot = 1; bot <= bots; bot += 1) {
      await page.getByTestId('add-bot').click();
      await expect(page.getByTestId(`member-🤖 Bot ${bot}`)).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByTestId('room-status')).toContainText(`${bots + 1} in the room`);
    await page.getByTestId('start-match').click();
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


  test('Round 14: the bot inks the phone, which rubs it off, and the bot\'s attempts on its sauce show live', async ({ page }) => {
    test.setTimeout(90_000);
    await openRoomWithBots(page, 1);
    await expect(page.getByTestId('target')).toHaveAttribute('aria-label', 'after 🤖 Bot 1', { timeout: 10_000 });

    const ink = page.getByTestId('ink');
    await expect(ink).toBeVisible({ timeout: 25_000 }); // the bot's first ink: 12 s after the start (draws fixed at 0)
    await expect(page.getByTestId('status')).toContainText('inked you');
    const box = await ink.boundingBox();
    for (let swipe = 0; swipe < 12 && (await ink.count()) > 0; swipe += 1) {
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    await expect(ink).toHaveCount(0);

    await expect(page.getByTestId('attempt')).toHaveAttribute('aria-label', /^🤖 Bot 1 tried /, { timeout: 25_000 });
  });
});
