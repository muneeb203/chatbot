// In-memory rate limiting
const requestCounts = new Map();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;

/**
 * Check if IP is rate limited
 * @param {string} ip - Client IP address
 * @returns {boolean} True if rate limit exceeded
 */
function isRateLimited(ip) {
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  // Add current request
  validRequests.push(now);
  requestCounts.set(ip, validRequests);
  
  return false;
}

/**
 * Clean up old rate limit data periodically
 */
function cleanupRateLimitData() {
  const now = Date.now();
  
  for (const [ip, requests] of requestCounts.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (validRequests.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, validRequests);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitData, 5 * 60 * 1000);

module.exports = { isRateLimited };
