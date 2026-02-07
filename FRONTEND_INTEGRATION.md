# Frontend Integration Guide

## API Configuration

**Endpoint:** 
- Local: `http://localhost:3000/api/chat`
- ngrok: `https://your-ngrok-url.ngrok-free.app/api/chat`
- Production: `https://your-project.vercel.app/api/chat`

**No API key required!** Just send the session ID.

## Required Headers

```javascript
{
  'Content-Type': 'application/json',
  'x-session-id': 'unique-session-id-per-user'
}
```

## Complete Working Example

```javascript
// ============================================
// CHATBOT API INTEGRATION WITH SSE STREAMING
// ============================================

// Configuration
const API_URL = 'http://localhost:3000/api/chat'; // Change to your backend URL

// Get or create session ID (persistent per user)
function getSessionId() {
  let sessionId = localStorage.getItem('chatbot_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('chatbot_session_id', sessionId);
  }
  return sessionId;
}

// Send message and handle streaming response
async function sendMessage(userMessage, onToken, onComplete, onError) {
  const sessionId = getSessionId();
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify({ 
        message: userMessage 
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    // Handle SSE streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.content) {
              fullResponse += data.content;
              onToken(data.content); // Call callback with each token
            }
            
            if (data.done) {
              onComplete(fullResponse); // Call callback when done
            }
            
            if (data.error) {
              onError(data.error);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error.message);
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Example: Simple console output
sendMessage(
  'What services do you offer?',
  (token) => {
    // Called for each token
    process.stdout.write(token);
  },
  (fullResponse) => {
    // Called when complete
    console.log('\n\n✅ Complete response:', fullResponse);
  },
  (error) => {
    // Called on error
    console.error('❌ Error:', error);
  }
);

// ============================================
// REACT EXAMPLE
// ============================================

import { useState } from 'react';

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);
    setCurrentResponse('');
    
    // Send to API
    await sendMessage(
      userMessage,
      (token) => {
        // Append each token to current response
        setCurrentResponse(prev => prev + token);
      },
      (fullResponse) => {
        // Add complete assistant message
        setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
        setCurrentResponse('');
        setIsLoading(false);
      },
      (error) => {
        console.error('Error:', error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${error}` 
        }]);
        setCurrentResponse('');
        setIsLoading(false);
      }
    );
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
        {currentResponse && (
          <div className="assistant streaming">
            {currentResponse}
          </div>
        )}
      </div>
      
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        disabled={isLoading}
      />
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}

// ============================================
// VANILLA JS EXAMPLE
// ============================================

const chatContainer = document.getElementById('chat-container');
const inputField = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

sendButton.addEventListener('click', async () => {
  const userMessage = inputField.value.trim();
  if (!userMessage) return;
  
  // Display user message
  appendMessage('user', userMessage);
  inputField.value = '';
  
  // Create assistant message container
  const assistantDiv = appendMessage('assistant', '');
  
  // Send and stream response
  await sendMessage(
    userMessage,
    (token) => {
      assistantDiv.textContent += token;
    },
    (fullResponse) => {
      console.log('Done:', fullResponse);
    },
    (error) => {
      assistantDiv.textContent = `Error: ${error}`;
      assistantDiv.classList.add('error');
    }
  );
});

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  chatContainer.appendChild(div);
  return div;
}

// ============================================
// TESTING IN BROWSER CONSOLE
// ============================================

// Quick test (paste in browser console):
fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-id': 'test-' + Date.now()
  },
  body: JSON.stringify({ message: 'Hello!' })
}).then(r => console.log('Success!', r)).catch(e => console.error('Error:', e));
```

## Key Points

1. **Session ID**: Generate once per user with `crypto.randomUUID()` and store in localStorage
2. **No API key needed**: Just send the session ID
3. **Streaming**: Response comes token-by-token via SSE
4. **Error handling**: Always wrap in try-catch
5. **Works with**: localhost, ngrok, and production Vercel URLs

## Testing with ngrok

1. Start backend: `npm run dev`
2. Start ngrok: `ngrok http 3000`
3. Update `API_URL` to ngrok URL
4. Test immediately - no CORS issues!
