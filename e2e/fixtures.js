// Every browser check starts with a guardian that is always fooled (luck draw 1), unless the check
// sets its own luck with `test.use({ luck: 0 })`: AC18 makes one distraction in four fail at random.
const base = require('@playwright/test');

// Items are drawn as harmless food (draw 0) that no check taps, so a random bomb (AC28) never costs
// life in a long check; the item checks set `test.use({ itemDraw: null })` and fix Math.random.
// Every throw is a meatball (AC34's forks would steal pegs in checks about meatballs), unless a
// check sets `test.use({ throws: 'forks' })`.
const test = base.test.extend({
  luck: [1, { option: true }],
  itemDraw: [0, { option: true }],
  throws: ['meatballs', { option: true }],
  // The app opens on a menu (solo, or steal the sauce with friends): the checks start a solo game,
  // unless a check sets `test.use({ menu: 'stay' })`.
  menu: ['solo', { option: true }],
  // Round 15: the guardian's taunts (solo, every 40-70 s) and the bots' taunts would cut into the
  // other rounds' long checks: off unless a check sets `test.use({ guardianTaunts: true })` or
  // `botsTaunt: true`. The shell game's and the duels' draws can be fixed (`shellDraw`, `duelDraw`:
  // a number, or a list drawn in turn).
  guardianTaunts: [false, { option: true }],
  botsTaunt: [false, { option: true }],
  shellDraw: [null, { option: true }],
  duelDraw: [null, { option: true }],
  page: async ({ page, luck, itemDraw, throws, menu, guardianTaunts, botsTaunt, shellDraw, duelDraw }, use) => {
    if (menu === 'solo') {
      const open = page.goto.bind(page);
      page.goto = async (...args) => {
        const response = await open(...args);
        await page.getByTestId('solo').click();
        await page.getByTestId('secret').waitFor();
        return response;
      };
    }
    await page.addInitScript(
      ([fixedLuck, fixedItemDraw, fixedThrows, taunts, botTaunts, fixedShell, fixedDuel]) => {
        globalThis.yologneseLuck = fixedLuck;
        if (typeof fixedItemDraw === 'number') globalThis.yologneseItemDraw = fixedItemDraw;
        globalThis.yologneseThrows = fixedThrows;
        globalThis.yologneseGuardianTaunts = taunts;
        globalThis.yologneseBotsTaunt = botTaunts;
        if (fixedShell !== null) globalThis.yologneseShellDraw = fixedShell;
        if (fixedDuel !== null) globalThis.yologneseDuelDraw = fixedDuel;
      },
      [luck, itemDraw, throws, guardianTaunts, botsTaunt, shellDraw, duelDraw],
    );
    await use(page);
  },
});

module.exports = { test, expect: base.expect };
