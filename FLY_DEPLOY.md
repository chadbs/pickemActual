# 🚀 Deploy to Fly.io - CFB Pick'em

## Why Fly.io is Best for Your App

✅ **Keep SQLite** - No database migration needed
✅ **Always-on** - No cold starts like Railway
✅ **Persistent data** - 1GB free storage
✅ **Fast deployment** - Docker-based
✅ **Free tier** - Perfect for small apps

---

## Quick Setup (5 minutes)

### Step 1: Install & Authenticate Fly.io CLI
```bash
# CLI is already installed at C:\Users\chads\.fly\bin\flyctl.exe

# Authenticate (opens browser)
flyctl auth signup
# OR if you have account: flyctl auth login
```

### Step 2: Create App & Volume
```bash
# In your project directory
cd C:\Users\chads\code\pickemdeploy

# Create app (will prompt for app name)
flyctl apps create cfb-pickem-app

# Create persistent volume for SQLite database
flyctl volumes create cfb_data --size 1 --region ord
```

### Step 3: Set Environment Variables
```bash
# Add your API keys (get these from your Railway config or .env)
flyctl secrets set CFBD_API_KEY="your_cfbd_api_key_here"
flyctl secrets set ODDS_API_KEY="your_odds_api_key_here"
flyctl secrets set NODE_ENV="production"
```

### Step 4: Deploy!
```bash
# Deploy your app
flyctl deploy

# Your app will be live at: https://cfb-pickem-app.fly.dev
```

---

## Files Already Created

✅ `fly.toml` - Fly.io configuration
✅ `Dockerfile` - Updated with correct port
✅ Persistent volume setup for SQLite
✅ Health checks configured

---

## What Happens During Deploy

1. 🏗️ **Builds Docker image** using your existing Dockerfile
2. 📁 **Mounts persistent volume** to `/app/server/data` for SQLite
3. 🔐 **Injects secrets** as environment variables
4. 🚀 **Starts your app** on https://cfb-pickem-app.fly.dev
5. ❤️ **Health monitoring** via `/api/health` endpoint

---

## Managing Your App

```bash
# View logs
flyctl logs

# Check status
flyctl status

# Scale up/down
flyctl scale count 1

# SSH into machine
flyctl ssh console

# Update app
flyctl deploy
```

---

## Configuration Details

### fly.toml Settings
- **Region**: Chicago (ord) - change if needed
- **Memory**: 256MB (free tier)
- **Volume**: 1GB persistent storage
- **Auto-scaling**: Disabled (keeps 1 machine always running)
- **Health checks**: GET /api/health every 30s

### Persistent Data
- SQLite database stored in `/app/server/data/cfb_pickem.db`
- Data persists between deployments
- 1GB storage included in free tier

---

## Free Tier Limits

✅ **3 shared-cpu-1x machines**
✅ **3GB persistent volume storage**
✅ **160GB outbound data transfer**
✅ **Unlimited inbound data**

Your app uses ~5% of free tier limits - plenty of room!

---

## Troubleshooting

### If deploy fails:
```bash
# Check logs
flyctl logs

# Try building locally first
docker build -t cfb-pickem .
docker run -p 3001:3001 cfb-pickem
```

### If app won't start:
```bash
# SSH into machine
flyctl ssh console

# Check if volume is mounted
ls -la /app/server/data/

# Check environment variables
env | grep NODE_ENV
```

### If database is empty:
The app will automatically create tables on first run. No migration needed!

---

## Migration from Railway

Your data will be fresh (empty database) since we can't migrate from Railway SQLite.

But this is actually good for a clean production start! 🎉

---

## Next Steps After Deploy

1. ✅ Test the live app
2. ✅ Create first week's games via admin panel
3. ✅ Share URL with friends
4. ✅ Monitor via `flyctl logs`

**Your app will be available at:** `https://cfb-pickem-app.fly.dev`

---

## Cost Estimate

- **Small usage**: FREE (within limits)
- **Medium usage**: $0-3/month
- **Heavy usage**: $5-10/month

Much cheaper than other platforms! 💰