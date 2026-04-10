const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing env: ${name}`);
  }
}

async function main() {
  requireEnv('JWT_SECRET');

  // 1) Create a token
  const token = jwt.sign(
    { id: 1, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log('Test Token:', token);

  // 2) Verify locally (same logic as middleware)
  const verified = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Verified payload:', verified);

  // 3) Optional: call a protected endpoint
  if (process.argv.includes('--call')) {
    const res = await axios.get(`${API_BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('GET /api/products status:', res.status);
    console.log('GET /api/products data:', res.data);
  }
}

main().catch((err) => {
  console.error('Test token failed:', err?.response?.data || err.message);
  process.exitCode = 1;
});