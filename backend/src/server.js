require('dotenv').config();
const app = require('./app');

const { refreshNews } = require('./services/newsService');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Indufar QR Verification API`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Port        : ${PORT}`);
  console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
});

// Periodic news fetch for standalone (non-serverless) Node server deployments (every 24 hours)
const DAILY_NEWS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const newsTimer = setInterval(() => {
  console.log('[CRON] Running daily automatic news refresh...');
  refreshNews().catch((err) => console.error('[CRON] Daily news refresh failed:', err.message));
}, DAILY_NEWS_INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  clearInterval(newsTimer);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  clearInterval(newsTimer);
  server.close(() => {
    console.log('\nServer stopped.');
    process.exit(0);
  });
});

module.exports = server;
