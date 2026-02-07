// Load environment variables
require('dotenv').config();

const http = require('http');
const chatHandler = require('./api/chat');

const PORT = 3000;

// Add Express-like helpers to response object
function enhanceResponse(res) {
  res.status = function(code) {
    res.statusCode = code;
    return this;
  };
  
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return this;
  };
  
  return res;
}

const server = http.createServer((req, res) => {
  // ⚠️ CRITICAL: Set CORS headers FIRST, before any other logic
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.convosol.com'
  ];
  
  // Check if origin is allowed
  let allowOrigin = '*';
  for (const allowed of allowedOrigins) {
    if (origin.startsWith(allowed)) {
      allowOrigin = origin;
      break;
    }
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-id, ngrok-skip-browser-warning');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight - CORS headers set');
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Enhance response with Express-like methods
  enhanceResponse(res);
  
  // Parse request body for POST requests
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      chatHandler(req, res);
    });
  } else {
    chatHandler(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`💡 Use ngrok: ngrok http ${PORT}`);
});
