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
 * Set CORS headers - allow all origins
 */
function setCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin || '*';
  
  // Echo the request origin to allow all origins
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-id, ngrok-skip-browser-warning');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         'unknown';
}

/**
 * Vercel Serverless Function Handler
 */
module.exports = async (req, res) => {
  // Set CORS headers FIRST
  setCorsHeaders(req, res);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Validate session ID
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session ID' });
    }
    
    // Rate limiting
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    
    // Validate message
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    // Initialize embeddings
    await ensureEmbeddingsInitialized();
    
    // Retrieve context using RAG
    const context = await retrieveContext(message);
    
    // Get session history
    const history = getSessionHistory(sessionId);
    
    // Build system prompt
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
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
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
    
  } catch (error) {
    console.error('Chat API error:', error);
    
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
