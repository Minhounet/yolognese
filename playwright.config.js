// Checks run against the static web build served on :8081 (npm run e2e builds it first).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  reporter: 'line',
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:8081' },
  webServer: {
    command: 'python3 -m http.server 8081 --directory dist',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
  },
});
