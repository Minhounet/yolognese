// Browser checks for round 2 (AC10-AC16), against the web build.
// Time is Playwright's clock; chance is scripted (see support/game.js): the secret is four reds,
// the first item comes at 8 s top left, the first attack at 10 s in lane 0; the shield starts in lane 1.
const { test, expect } = require('@playwright/test');
const { scriptChance, draw, tapAt, distract } = require('./support/game');

const HIDDEN = 'hidden peg';
const KINDS = ['food', 'smoke', 'xray', 'hourglass', 'charm', 'present'];
const kind = (name) => [KINDS.indexOf(name), KINDS.length];

test.beforeEach(async ({ page }) => {
  await scriptChance(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByTestId('solo').click();
});

const life = (page) => page.getByTestId('life-bar');
const status = (page) => page.getByTestId('status');

test('AC10: the player starts with a full life bar, and a miss costs one', async ({ page }) => {
  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
  for (const color of ['blue', 'blue', 'blue', 'blue']) await tapAt(page, page.getByTestId(`palette-${color}`));
  await tapAt(page, page.getByTestId('submit'));

  await expect(life(page)).toHaveAttribute('aria-label', 'life 9 of 10');
});

test('AC11: after a peek, peeking is unavailable for 5 s and costs nothing', async ({ page }) => {
  const cooldown = page.getByTestId('cooldown-bar');
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');
  await distract(page, expect);
  await tapAt(page, page.getByTestId('secret-0'));
  await expect(cooldown).toHaveAttribute('aria-label', 'peek cooling down');
  await page.clock.runFor(1600); // the guardian watches again

  await tapAt(page, page.getByTestId('secret-1'));

  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
  await expect(status(page)).not.toContainText('Caught');
  await page.clock.runFor(3500);
  await expect(cooldown).toHaveAttribute('aria-label', 'peek ready');
});

test('AC12: the game lasts 3 minutes, then is lost and the secret shown', async ({ page }) => {
  await page.getByTestId('lane-0').tap(); // block the scripted attacks
  await expect(page.getByTestId('timer')).toContainText('3:00');
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('timer')).toContainText('2:00');

  await page.clock.runFor(120_000);

  await expect(status(page)).toHaveText("Time's up! The guardian wins.");
  await expect(page.getByTestId('secret-0')).toHaveAttribute('aria-label', 'red');
});

test('AC13: an item shows for 4 s; food gives life back', async ({ page }) => {
  await tapAt(page, page.getByTestId('secret-0')); // caught: 8 of 10
  await page.clock.runFor(8000);
  const food = page.getByTestId('item-food');
  await expect(food).toBeVisible();

  await tapAt(page, food);

  await expect(status(page)).toContainText('+3 life');
  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
  await expect(food).toHaveCount(0);
});

test('AC13: an item not collected is gone after 4 s', async ({ page }) => {
  await page.clock.runFor(8000);
  await expect(page.getByTestId('item-food')).toBeVisible();

  await page.clock.runFor(4000);

  await expect(page.getByTestId('item-food')).toHaveCount(0);
});

test('AC13: x-ray glasses show one peg for a moment only', async ({ page }) => {
  await draw(page, kind('xray'));
  await page.clock.runFor(8000);
  await draw(page, [2, 4]); // the third peg
  await tapAt(page, page.getByTestId('item-xray'));

  await expect(page.getByTestId('secret-2')).toHaveAttribute('aria-label', 'red');
  await expect(page.getByTestId('secret-0')).toHaveAttribute('aria-label', HIDDEN);
  await page.clock.runFor(1500);
  await expect(page.getByTestId('secret-2')).toHaveAttribute('aria-label', HIDDEN);
});

test('AC13: a smoke bomb blinds the guardian: peeks are safe', async ({ page }) => {
  await draw(page, kind('smoke'));
  await page.clock.runFor(8000);
  await tapAt(page, page.getByTestId('item-smoke'));
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian blinded');

  await tapAt(page, page.getByTestId('secret-3'));

  await expect(page.getByTestId('secret-3')).toHaveAttribute('aria-label', 'red');
  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
});

test('AC14: the guardian warns, throws in a lane, and the shield there blocks it', async ({ page }) => {
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('attack')).toHaveAttribute('aria-label', 'meatball attack in lane 0');
  await expect(page.getByTestId('guardian')).toHaveAttribute('aria-label', 'guardian attacking');

  await page.getByTestId('lane-0').tap();
  await page.clock.runFor(1000);

  await expect(status(page)).toContainText('Blocked');
  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
});

test('AC14: the shield can be dragged to a lane', async ({ page }) => {
  const shield = page.getByTestId('shield');
  await expect(shield).toHaveAttribute('aria-label', 'shield in lane 1');
  const from = await shield.boundingBox();
  const to = await page.getByTestId('lane-2').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(shield).toHaveAttribute('aria-label', 'shield in lane 2');
});

test('AC14: a throw in a lane without the shield costs two life', async ({ page }) => {
  await page.clock.runFor(11_000);

  await expect(status(page)).toContainText('Ouch');
  await expect(life(page)).toHaveAttribute('aria-label', 'life 8 of 10');
});

test('AC15: a bad present switches two of the placed pegs', async ({ page }) => {
  for (const color of ['blue', 'green']) await tapAt(page, page.getByTestId(`palette-${color}`));
  await draw(page, kind('present'));
  await page.clock.runFor(8000);
  await draw(page, [1, 2], [0, 2], [0, 2], [0, 1]); // bad, mix-up, first placed peg, the other one
  await tapAt(page, page.getByTestId('item-present'));

  await expect(status(page)).toContainText('switched places');
  await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'green');
  await expect(page.getByTestId('slot-1')).toHaveAttribute('aria-label', 'blue');
});

test('AC16: the fork steals a placed peg when the shield is not in its lane', async ({ page }) => {
  for (const color of ['blue', 'green']) await tapAt(page, page.getByTestId(`palette-${color}`));
  await page.clock.runFor(9000);
  await draw(page, [2, 3], [0, 3]); // a fork, lane 0
  await page.clock.runFor(1000);
  await expect(page.getByTestId('attack')).toHaveAttribute('aria-label', 'fork attack in lane 0');
  await draw(page, [0, 10001], [1, 2]); // next attack delay, the second placed peg

  await page.clock.runFor(1000);

  await expect(status(page)).toContainText('stole');
  await expect(page.getByTestId('slot-0')).toHaveAttribute('aria-label', 'blue');
  await expect(page.getByTestId('slot-1')).toHaveAttribute('aria-label', 'empty peg');
  await expect(life(page)).toHaveAttribute('aria-label', 'life 10 of 10');
});
