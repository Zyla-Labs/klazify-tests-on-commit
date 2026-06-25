require('dotenv').config();
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  requestTimeout: 120000,
  responseTimeout: 120000,
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: 'https://www.klazify.com',
    env: {
      KLAZIFY_API_KEY: process.env.KLAZIFY_API_KEY
    },
    video: false
  }
});
