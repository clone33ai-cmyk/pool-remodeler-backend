# AI Pool Remodeler — Backend API

Express.js backend that handles Claude Vision analysis and DALL-E 3 image generation,
avoiding browser CORS restrictions by running API calls server-side.

---

## Deploy to Railway (free, ~5 minutes)

### Step 1 — Push to GitHub
1. Go to https://github.com/new and create a new repo called `pool-remodeler-backend`
2. In your terminal:
   ```
   cd pool-remodeler-backend
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/pool-remodeler-backend.git
   git push -u origin main
   ```

### Step 2 — Deploy on Railway
1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `pool-remodeler-backend` repo
4. Railway auto-detects Node.js and deploys it

### Step 3 — Add environment variables
In Railway dashboard → your project → **Variables** tab, add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (from console.anthropic.com) |
| `OPENAI_API_KEY` | Your OpenAI API key |

Railway automatically sets `PORT` — no need to add it.

### Step 4 — Get your public URL
Go to **Settings → Networking → Generate Domain**
You'll get a URL like: `https://pool-remodeler-backend-production.up.railway.app`

### Step 5 — Update the artifact
Paste that URL into the artifact's `BACKEND_URL` constant at the top of the file.

---

## API Endpoints

### GET /
Health check — returns `{ status: "ok" }`

### POST /remodel
Analyzes pool image and generates remodeled version.

**Request:** `multipart/form-data`
- `image` — pool photo file (JPG, PNG, WEBP, max 10MB)
- `finish` — one of: `kahlua`, `dessert`, `tile`

**Response:**
```json
{
  "success": true,
  "analysisText": "1. CURRENT CONDITION: ...\n2. RECOMMENDED WORK: ...\n3. EXPECTED TRANSFORMATION: ...",
  "generatedImage": "data:image/png;base64,...",
  "finishLabel": "Kahlua"
}
```

---

## Local development

```bash
cp .env.example .env
# Fill in your API keys in .env
npm install
npm start
# Server runs on http://localhost:3001
```
