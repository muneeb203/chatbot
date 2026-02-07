# Deployment Guide

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- OpenAI API key

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Chatbot backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `CHAT_API_KEY`: Your secure API key (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
5. Click "Deploy"

### Option B: Vercel CLI

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel --prod
```

4. **Add environment variables** via dashboard or CLI:
```bash
vercel env add OPENAI_API_KEY
vercel env add CHAT_API_KEY
```

## Step 3: Update Frontend

After deployment, update your frontend to use the production URL:

```javascript
const API_URL = 'https://your-project.vercel.app/api/chat';
```

## Step 4: Update CORS

If your frontend is on a different domain, update `api/chat.js`:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://www.convosol.com',
  'https://your-frontend-domain.com'  // Add your domain
];
```

Then redeploy:
```bash
git add .
git commit -m "Update CORS origins"
git push
```

Vercel will auto-deploy on push.

## Verify Deployment

Test your API:

```bash
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-session-id: test-123" \
  -d '{"message":"Hello"}'
```

## Troubleshooting

### "OPENAI_API_KEY not configured"
- Go to Vercel dashboard → Project → Settings → Environment Variables
- Add `OPENAI_API_KEY` with your OpenAI key
- Redeploy

### "Invalid or missing API key"
- Ensure frontend is sending `x-api-key` header
- Verify `CHAT_API_KEY` matches in both frontend and Vercel env vars

### CORS errors
- Check allowed origins in `api/chat.js`
- Ensure frontend domain is in the list
- Redeploy after changes

### Cold start delays
- First request after inactivity may take 10-15 seconds (embeddings initialization)
- Subsequent requests will be fast
- Consider upgrading to Vercel Pro for faster cold starts

## Monitoring

View logs in Vercel dashboard:
1. Go to your project
2. Click "Deployments"
3. Click on a deployment
4. Click "Functions" tab
5. View real-time logs

## Cost Optimization

- Model: `gpt-4o-mini` (~$0.15 per 1M input tokens)
- Embeddings: `text-embedding-3-small` (~$0.02 per 1M tokens)
- Vercel: Free tier includes 100GB bandwidth, 100GB-hours compute
- Estimated cost: ~$5-20/month for moderate usage

## Auto-Deploy on Push

Vercel automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push
```

Check deployment status at vercel.com/dashboard
