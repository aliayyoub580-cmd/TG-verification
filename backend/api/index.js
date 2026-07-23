// Vercel serverless entry point for the Express app
require('dotenv').config();
const app = require('../src/app');

module.exports = app;
