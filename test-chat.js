const readline = require('readline');
const http = require('http');
const crypto = require('crypto');

// Configuration
const API_HOST = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';
const SESSION_ID = crypto.randomUUID();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════╗');
console.log('║     ConvoSol Chatbot Terminal         ║');
console.log('╚════════════════════════════════════════╝');
console.log(`Session ID: ${SESSION_ID}`);
console.log('Type your message and press Enter.');
console.log('Type "exit" or "quit" to end the session.\n');

/**
 * Send message to chatbot API
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ message });
    
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': SESSION_ID,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          try {
            const error = JSON.parse(errorData);
            reject(new Error(error.error || 'Request failed'));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
        return;
      }

      process.stdout.write('\n🤖 Assistant: ');
      
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                process.stdout.write(data.content);
              }
              
              if (data.done) {
                console.log('\n');
                resolve();
              }
              
              if (data.error) {
                console.error('\n❌ Error:', data.error, '\n');
                reject(new Error(data.error));
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      res.on('end', () => {
        resolve();
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main chat loop
 */
function chat() {
  rl.question('👤 You: ', async (input) => {
    const message = input.trim();
    
    // Check for exit commands
    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!\n');
      rl.close();
      process.exit(0);
      return;
    }
    
    // Ignore empty messages
    if (!message) {
      chat();
      return;
    }
    
    // Send message to API
    try {
      await sendMessage(message);
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error('💡 Make sure the backend is running: npm start\n');
    }
    
    // Continue chat loop
    chat();
  });
}

// Check if backend is running
console.log('🔍 Checking backend connection...');
const testReq = http.request({
  hostname: API_HOST,
  port: API_PORT,
  path: '/api/health',
  method: 'GET'
}, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Backend is running!\n');
    chat();
  } else {
    console.log('⚠️  Backend responded but may have issues\n');
    chat();
  }
});

testReq.on('error', (error) => {
  console.error('❌ Cannot connect to backend!');
  console.error('💡 Please start the backend first: npm start');
  console.error(`   Expected: http://${API_HOST}:${API_PORT}\n`);
  process.exit(1);
});

testReq.end();
