/**
 * Health check endpoint for monitoring
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return health status
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'chatbot-api'
  });
};
