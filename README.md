# 🏈 CFB Pick'em - College Football Pick'em Game

A real-time college football pick'em game where users can make picks against the spread and compete on leaderboards. **No login required** - anyone with the link can play!

## ✨ Features

- **🎯 No Login Required** - Anyone can play by just entering their name
- **📊 Real-time Updates** - Everyone sees the same games and picks
- **🎲 Spread Betting** - Pick winners against real sportsbook lines
- **🏆 Leaderboards** - Weekly and season-long standings
- **👑 Admin Panel** - Select which games to feature each week from top 20 options
- **📱 Mobile Friendly** - Works perfectly on phones and tablets
- **🔄 Auto-Updates** - Games and spreads update automatically
- **⚡ Smart Game Selection** - Prioritizes favorite teams and top matchups

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd cfb-pickem-claude

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run with Docker
docker-compose up -d
```

### Option 2: Development Mode
```bash
# Clone and install
git clone <your-repo-url>
cd cfb-pickem-claude
npm run install:all

# Set up environment
cp .env.example server/.env
# Edit server/.env with your API keys

# Start development servers
npm run dev
```

Access the application at **http://localhost:5177** (dev) or **http://localhost:3001** (production)

## 🔧 Configuration

You'll need API keys from:
1. **[College Football Data API](https://collegefootballdata.com/)** - Free tier available
2. **[The Odds API](https://the-odds-api.com/)** - Free tier: 500 requests/month

Add them to your `.env` file:
```bash
CFBD_API_KEY=your_cfb_data_api_key
ODDS_API_KEY=your_odds_api_key
```

## 🚀 Deployment Options

### Cloud Platforms
- **Railway** (Recommended) - One-click deployment
- **Heroku** - Classic PaaS platform  
- **Vercel** - Serverless deployment
- **DigitalOcean App Platform** - Simple container deployment

### Self-Hosted
- **Docker** - Production-ready containerized setup
- **PM2** - Process management for Node.js

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 🎯 Favorite Teams

The system prioritizes games featuring these teams:
- 🦬 **Colorado Buffaloes** 
- 🐏 **Colorado State Rams**
- 🌽 **Nebraska Cornhuskers**
- 〽️ **Michigan Wolverines**

---

**Go Team! 🏈** May the best predictor win!# Trigger Railway redeploy Mon Sep 22 11:17:27 EDT 2025
