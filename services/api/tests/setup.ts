process.env.REDIS_URL = '';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-32-characters-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-32-characters-long';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
process.env.WG_SERVER_PUBLIC_KEY = process.env.WG_SERVER_PUBLIC_KEY || 'xT3qBpefx5brMQ8nqMxjoD8xIa/1ukzQdpJ3JEdj6W4=';
process.env.WG_ENDPOINT = process.env.WG_ENDPOINT || 'vpn.example.com:51820';

const { resetRateLimitWindows } = require('../src/middleware/rateLimit');

beforeEach(() => {
  resetRateLimitWindows();
});
