# 🚀 Quick Deployment Guide - CFB Pick'em

## Easiest Option: GitHub + Railway (5 minutes)

### Step 1: Upload to GitHub
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - CFB Pick'em app"

# Create GitHub repository and push
git branch -M main
git remote add origin https://github.com/yourusername/cfb-pickem.git
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "Deploy from GitHub repo"
4. Select your `cfb-pickem` repository
5. Railway will automatically detect and deploy!

### Step 3: Add API Keys
In Railway dashboard:
1. Go to your project → Variables tab
2. Add these variables:
   - `CFBD_API_KEY`: Get from [collegefootballdata.com](https://collegefootballdata.com/)
   - `ODDS_API_KEY`: Get from [the-odds-api.com](https://the-odds-api.com/)
   - `NODE_ENV`: `production`

### Step 4: Done! 🎉
- Your app will be live at `https://yourapp.up.railway.app`
- No login required - anyone can use it!
- Updates automatically when you push to GitHub

---

## Alternative: Docker (Local or VPS)

```bash
# Clone your repo
git clone https://github.com/yourusername/cfb-pickem.git
cd cfb-pickem

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Deploy with Docker
docker-compose up -d

# Access at http://localhost:3001
```

---

## Getting API Keys (Free!)

### College Football Data API (Required)
1. Visit [collegefootballdata.com](https://collegefootballdata.com/)
2. Create account → Generate API key
3. Free tier: 1000+ requests/hour (plenty!)

### The Odds API (Required)
1. Visit [the-odds-api.com](https://the-odds-api.com/)  
2. Sign up → Get API key
3. Free tier: 500 requests/month (enough for testing)

---

## Features Ready to Go

✅ **No Login Required** - Anyone with the link can play  
✅ **Real-time Updates** - Everyone sees the same data  
✅ **Admin Panel** - Select matchups each week  
✅ **Automatic Spreads** - Betting lines from real sportsbooks  
✅ **Leaderboards** - Weekly and season standings  
✅ **Mobile Friendly** - Works on phones/tablets  

---

## Updates

To update your deployed app:
```bash
git add .
git commit -m "Updated app"
git push origin main
```
Railway will automatically redeploy! 🚀

---

## Support

- Health check: `yourapp.com/api/health`
- Admin panel: `yourapp.com/admin` 
- View logs in Railway dashboard