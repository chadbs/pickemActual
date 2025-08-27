# CFB Pick'em - Deployment Guide

This guide covers multiple deployment options for the CFB Pick'em application.

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites
- [Docker](https://www.docker.com/get-started) and Docker Compose installed
- API keys from [College Football Data](https://collegefootballdata.com/) and [The Odds API](https://the-odds-api.com/)

### Steps

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd cfb-pickem-claude
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose up -d
   ```

4. **Access Application**
   - Open http://localhost:3001
   - The application serves both frontend and API from port 3001

## 🌐 Cloud Deployment Options

### Railway (Recommended)
1. Fork this repository
2. Connect to [Railway](https://railway.app)
3. Deploy from GitHub
4. Add environment variables:
   - `CFBD_API_KEY`: Your College Football Data API key
   - `ODDS_API_KEY`: Your Odds API key
   - `NODE_ENV`: production

### Heroku
1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. ```bash
   heroku create your-app-name
   heroku config:set CFBD_API_KEY=your_key
   heroku config:set ODDS_API_KEY=your_key
   heroku config:set NODE_ENV=production
   git push heroku main
   ```

### DigitalOcean App Platform
1. Connect your GitHub repository
2. Set build command: `npm run build:all`
3. Set run command: `npm run start:prod`
4. Add environment variables in the dashboard

### Vercel (Serverless)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Add environment variables in Vercel dashboard

## 🔧 Manual Deployment (VPS/Dedicated Server)

### Prerequisites
- Node.js 18+ 
- PM2 (process manager)
- Nginx (reverse proxy)

### Setup Steps

1. **Server Setup**
   ```bash
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install PM2
   sudo npm install -g pm2

   # Clone repository
   git clone <your-repo-url>
   cd cfb-pickem-claude
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Build and Deploy**
   ```bash
   npm install
   npm run build:all
   ```

4. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. **Nginx Configuration** (optional, for custom domain)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CFBD_API_KEY` | Yes | College Football Data API key |
| `ODDS_API_KEY` | Yes | The Odds API key |
| `NODE_ENV` | No | Set to 'production' for production |
| `PORT` | No | Server port (default: 3001) |

## 🔍 Getting API Keys

### College Football Data API
1. Visit [collegefootballdata.com](https://collegefootballdata.com/)
2. Create an account
3. Generate an API key (free tier available)

### The Odds API
1. Visit [the-odds-api.com](https://the-odds-api.com/)
2. Sign up for an account
3. Get your API key (free tier: 500 requests/month)

## 🏗️ Build Scripts

- `npm run build:all` - Build both client and server
- `npm run build:client` - Build frontend only  
- `npm run build:server` - Build backend only
- `npm run start:prod` - Start production server

## 🐛 Troubleshooting

### Common Issues

1. **API keys not working**
   - Verify keys are correct in environment
   - Check API usage limits

2. **Database issues**
   - Ensure data directory has write permissions
   - SQLite database is created automatically

3. **Port conflicts**
   - Change PORT environment variable
   - Check if port 3001 is available

### Health Check
Visit `/api/health` to verify the server is running:
```bash
curl http://localhost:3001/api/health
```

## 🔄 Updates

To update your deployment:
```bash
git pull
npm install
npm run build:all
pm2 reload cfb-pickem  # or restart your deployment
```

## 📊 Monitoring

- Application logs: `pm2 logs cfb-pickem`
- Health endpoint: `/api/health` 
- Admin dashboard: `/admin` (when logged in as admin)

## 🛡️ Security Notes

- Keep API keys secure and never commit them to version control
- Use environment variables for all sensitive configuration
- Consider setting up HTTPS in production
- Regular updates to dependencies

## 💡 Tips

- The application includes automatic game fetching
- Games are updated every 6 hours
- Scores update every 15 minutes during game times
- Database backups: SQLite file is in `server/data/`