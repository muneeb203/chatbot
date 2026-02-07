# ConvoSol Chatbot Backend

Production-ready chatbot backend with RAG (Retrieval-Augmented Generation) for Vercel serverless deployment.

## Features

- ✅ OpenAI GPT-4o-mini streaming responses
- ✅ RAG with text-embedding-3-small
- ✅ Session-based conversation memory (20 messages)
- ✅ In-memory vector storage
- ✅ Domain-restricted API access
- ✅ API key authentication
- ✅ Rate limiting (60 req/min per IP)
- ✅ Server-Sent Events (SSE) streaming
- ✅ Zero database requirements

## Prerequisites

- Node.js 18.x or higher
- OpenAI API key
- Vercel account (for deployment)

## Installation

1. **Clone or download this repository**

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**

Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

Edit `.env` and add your values:
```env
OPENAI_API_KEY=sk-your-actual-openai-api-key
CHAT_API_KEY=your-secure-random-api-key
ALLOWED_ORIGIN=https://www.convosol.com
```

4. **Add knowledge base files**

Place your `.txt` files in the `/data` directory. The system will automatically:
- Load all `.txt` files
- Chunk them into 800-character pieces with 200-char overlap
- Generate embeddings
- Store them in memory

Example structure:
```
/data
  about.txt
  services.txt
  faq.txt
  policies.txt
  case_studies.txt
```

## Local Development

1. **Install Vercel CLI globally** (one-time setup):
```bash
npm install -g vercel
```

2. **Run the development server**:
```bash
npm run dev
```

The API will be available at `http://localhost:3000/api/chat`

**Note**: First time running `vercel dev` will ask you to login and link the project.

## Deployment to Vercel

### Option 1: Vercel CLI

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Set environment variables in Vercel dashboard**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add: `OPENAI_API_KEY`, `CHAT_API_KEY`, `ALLOWED_ORIGIN`

5. **Deploy to production**
```bash
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Add environment variables in project settings
5. Deploy

## API Usage

### Endpoint

```
POST https://your-project.vercel.app/api/chat
```

### Headers

```
Content-Type: application/json
x-api-key: your-secure-api-key
x-session-id: unique-session-identifier
Origin: https://www.convosol.com
```

### Request Body

```json
{
  "message": "What services do you offer?"
}
```

### Response

Server-Sent Events (SSE) stream:

```
data: {"content":"I"}

data: {"content":" can"}

data: {"content":" help"}

data: {"done":true}
```

## Frontend Integration Example

```javascript
async function sendMessage(message, sessionId) {
  const response = await fetch('https://your-project.vercel.app/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-secure-api-key',
      'x-session-id': sessionId
    },
    body: JSON.stringify({ message })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.content) {
          // Append token to UI
          console.log(data.content);
        }
        
        if (data.done) {
          // Stream complete
          console.log('Done');
        }
        
        if (data.error) {
          // Handle error
          console.error(data.error);
        }
      }
    }
  }
}

// Usage
const sessionId = crypto.randomUUID(); // Generate once per user session
sendMessage('Hello!', sessionId);
```

## Architecture

### File Structure

```
/api
  chat.js              # Main API endpoint
/lib
  openai.js            # OpenAI client initialization
  embeddings.js        # Load files, chunk, generate embeddings
  retriever.js         # RAG retrieval with cosine similarity
  memory.js            # Session-based conversation memory
  rateLimit.js         # IP-based rate limiting
/data
  *.txt                # Knowledge base files
```

### How It Works

1. **Cold Start**: On first request, all `.txt` files are loaded, chunked, and embedded
2. **User Query**: Frontend sends message with session ID
3. **Validation**: API key, origin, and rate limit checked
4. **Retrieval**: Query is embedded and top 3 relevant chunks retrieved
5. **Context Building**: Retrieved chunks + session history combined
6. **Streaming**: OpenAI streams response token-by-token via SSE
7. **Memory**: User message and assistant response saved to session

## Security Features

- ✅ Domain whitelist (only `https://www.convosol.com`)
- ✅ API key authentication
- ✅ Rate limiting (60 requests/minute per IP)
- ✅ CORS protection
- ✅ No data persistence (memory-only)

## Limitations

- Session memory resets on server restart (acceptable for serverless)
- In-memory storage only (suitable for small datasets)
- Rate limiting is per-instance (Vercel may spawn multiple instances)

## Troubleshooting

### "OPENAI_API_KEY is not set"
- Ensure `.env` file exists locally
- Ensure environment variables are set in Vercel dashboard

### "Rate limit exceeded"
- Wait 1 minute and try again
- Check if multiple users share the same IP

### "Unauthorized origin"
- Ensure frontend is hosted on `https://www.convosol.com`
- Update `ALLOWED_ORIGIN` in environment variables if needed

### Embeddings not initializing
- Check that `/data` directory contains `.txt` files
- Check Vercel function logs for errors

## Cost Optimization

- Model: `gpt-4o-mini` (cost-effective streaming model)
- Embeddings: `text-embedding-3-small` (lowest cost)
- Max tokens: 1000 per response
- Context: Top 3 chunks only

## Support

For issues or questions, contact your development team.

## License

Proprietary - ConvoSol
