// Load environment variables
require('dotenv').config();

const http = require('http');
const chatHandler = require('./api/chat');
const healthHandler = require('./api/health');

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
  // Enhance response with Express-like methods
  enhanceResponse(res);
  
  // Route to appropriate handler
  if (req.url === '/api/health' || req.url === '/health') {
    healthHandler(req, res);
    return;
  }
  
  if (req.url === '/api/chat' || req.url === '/chat') {
    // Parse request body for POST requests
    if (req.method === 'POST' || req.method === 'OPTIONS') {
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
    return;
  }
  
  // 404 for other routes
  res.status(404).json({ error: 'Not found' });
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ConvoSol Chatbot Backend Server     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
  console.log('\n💡 Ready for chat! Run "npm run chat" in another terminal.\n');
});
