# 🚀 Deploy to Render - CFB Pick'em (Alternative)

## If you prefer browser-based deployment over CLI

Render is perfect if you want to avoid command line setup!

---

## Quick Setup (3 minutes)

### Step 1: Create GitHub Repository
```bash
# Initialize git and push to GitHub
git init
git add .
git commit -m "CFB Pick'em app - ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/cfb-pickem.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click "New +" → "Web Service"
4. Connect your `cfb-pickem` repository
5. Use these settings:
   - **Name**: `cfb-pickem`
   - **Environment**: `Node`
   - **Build Command**: `npm run build:all`
   - **Start Command**: `npm run start:prod`
   - **Plan**: Free

### Step 3: Add Environment Variables
In Render dashboard:
- `NODE_ENV`: `production`
- `CFBD_API_KEY`: `your_api_key_here`
- `ODDS_API_KEY`: `your_api_key_here`

### Step 4: Deploy!
Click "Create Web Service" - Render will build and deploy automatically!

---

## ✅ Advantages of Render

- **Browser-based** - No CLI needed
- **Auto-deploys** - Push to GitHub = automatic deploy
- **Free SSL** - HTTPS included
- **Simple dashboard** - Easy to monitor
- **Git integration** - Deploy from any branch

---

## ⚠️ Render Limitations

- **Spins down** after 15min inactivity (like Railway)
- **No persistent disk** on free tier
- **SQLite resets** on each deploy (good for testing)

---

## Production Data Strategy

Since Render free tier doesn't persist SQLite:

### Option A: Use PostgreSQL
```typescript
// Replace SQLite with PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

### Option B: Use Render + External DB
- Deploy app on Render
- Use Supabase/PlanetScale for database
- Free tiers available for both

---

## Best Choice Recommendation

**For your use case: Fly.io > Render**

Because you want persistent SQLite data, and Fly.io:
- ✅ Keeps SQLite data between deploys
- ✅ Always-on (no cold starts)
- ✅ 1GB persistent storage free
- ✅ Better performance

**Use Render if:**
- ❌ You don't want to use CLI
- ❌ You're okay with database resets
- ❌ It's just for testing/demos

---

## Your App URL
After deploy: `https://cfb-pickem.onrender.com`