require('dotenv').config();
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  requestTimeout: 120000,
  responseTimeout: 120000,
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: 'https://www.klazify.com',
    env: {
      KLAZIFY_API_KEY: process.env.KLAZIFY_API_KEY,
      KLAZIFY_RATE_LIMIT_PER_MINUTE: 240,
      KLAZIFY_RATE_LIMIT_WINDOW_MS: 10000
    },
    video: false
  }
});
