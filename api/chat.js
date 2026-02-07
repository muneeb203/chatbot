const { getOpenAIClient } = require('../lib/openai');
const { retrieveContext } = require('../lib/retriever');
const { getSessionHistory, addMessage } = require('../lib/memory');
const { isRateLimited } = require('../lib/rateLimit');
const { initializeEmbeddings } = require('../lib/embeddings');

// Initialize embeddings on cold start
let embeddingsInitialized = false;

async function ensureEmbeddingsInitialized() {
  if (!embeddingsInitialized) {
    await initializeEmbeddings();
    embeddingsInitialized = true;
  }
}

/**
 * Set CORS headers - dynamically echo origin if allowed
 */
function setCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'http://localhost:5173',
    'https://www.convosol.com'
  ];
  
  // Check if request origin is in allowed list
  let allowedOrigin = '*';
  for (const origin of allowedOrigins) {
    if (requestOrigin.startsWith(origin)) {
      allowedOrigin = requestOrigin;
      break;
    }
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-id, ngrok-skip-browser-warning');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         'unknown';
}

/**
 * Validate API key
 */
function validateApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.CHAT_API_KEY;
  
  if (!expectedKey) {
    console.error('❌ CHAT_API_KEY not set in environment');
    return { valid: false, error: 'Server configuration error' };
  }
  
  if (!apiKey) {
    console.log('❌ No x-api-key header provided');
    return { valid: false, error: 'Missing API key' };
  }
  
  if (apiKey !== expectedKey) {
    console.log('❌ Invalid API key provided');
    console.log('   Received:', apiKey.substring(0, 10) + '...');
    console.log('   Expected:', expectedKey.substring(0, 10) + '...');
    return { valid: false, error: 'Invalid API key' };
  }
  
  console.log('✅ API key validated');
  return { valid: true };
}

/**
 * Main serverless function handler
 */
module.exports = async (req, res) => {
  console.log('\n========================================');
  console.log(`📨 ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin || 'none');
  console.log('All Headers:', JSON.stringify(req.headers, null, 2));
  console.log('========================================');
  
  // ⚠️ CRITICAL: Set CORS headers BEFORE any other logic
  setCorsHeaders(req, res);
  
  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight handled');
    return res.status(200).end();
  }
  
  // Only allow POST for actual requests
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Validate API key
    const apiKeyValidation = validateApiKey(req);
    if (!apiKeyValidation.valid) {
      return res.status(403).json({ error: apiKeyValidation.error });
    }
    
    // Validate session ID
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      console.log('❌ Missing x-session-id header');
      return res.status(403).json({ error: 'Missing session ID' });
    }
    console.log('✅ Session ID:', sessionId);
    
    // Rate limiting
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP)) {
      console.log('❌ Rate limit exceeded for IP:', clientIP);
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    
    // Validate message
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      console.log('❌ Invalid message format');
      return res.status(400).json({ error: 'Invalid message format' });
    }
    console.log('📝 Message:', message.substring(0, 50) + '...');
    
    // Initialize embeddings
    await ensureEmbeddingsInitialized();
    
    // Retrieve context using RAG
    const context = await retrieveContext(message);
    
    // Get session history
    const history = getSessionHistory(sessionId);
    
    // Build system prompt with context
    const systemPrompt = `You are a helpful, conversational assistant for ConvoSol. You provide precise and accurate information based on the knowledge base provided.

IMPORTANT RULES:
- Only answer questions using the context provided below
- If the answer is not in the context, clearly state: "I don't have that information in my knowledge base."
- Be conversational, helpful, and friendly
- Do not make up or hallucinate information
- Keep responses concise but complete

CONTEXT:
${context}`;
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];
    
    // Add user message to history
    addMessage(sessionId, 'user', message);
    
    // Set SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log('🤖 Streaming response...');
    
    // Create OpenAI streaming completion
    const openai = getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000
    });
    
    let fullResponse = '';
    
    // Stream response token by token
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    
    // Add assistant response to history
    addMessage(sessionId, 'assistant', fullResponse);
    
    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
    console.log('✅ Response completed');
    
  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};
