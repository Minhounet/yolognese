// Every browser check starts with a guardian that is always fooled (luck draw 1), unless the check
// sets its own luck with `test.use({ luck: 0 })`: AC18 makes one distraction in four fail at random.
const base = require('@playwright/test');

const test = base.test.extend({
  luck: [1, { option: true }],
  page: async ({ page, luck }, use) => {
    await page.addInitScript((value) => {
      globalThis.yologneseLuck = value;
    }, luck);
    await use(page);
  },
});

module.exports = { test, expect: base.expect };
