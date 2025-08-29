import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { initializeDatabase, runQuery, allQuery } from './database/database';
import { startScheduler } from './services/scheduler';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from './services/oddsApi';

// Import routes
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import pickRoutes from './routes/picks';
import weekRoutes from './routes/weeks';
import leaderboardRoutes from './routes/leaderboard';
import adminRoutes from './routes/admin-test';

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in production
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
if (isProduction) {
  // Try multiple possible paths for client dist
  const possiblePaths = [
    path.join(__dirname, '../../client/dist'),           // From server/dist/server/src
    path.join(__dirname, '../../../client/dist'),        // Alternative path
    path.join(process.cwd(), 'client/dist'),             // From project root
    '/app/client/dist'                                   // Railway absolute path
  ];
  
  let clientDistPath = '';
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      clientDistPath = testPath;
      break;
    }
  }
  
  if (clientDistPath && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    console.log('Serving static files from:', clientDistPath);
    app.use(express.static(clientDistPath));
  } else {
    console.error('Could not find client dist directory. Tried paths:', possiblePaths);
    console.error('Current directory:', process.cwd());
    console.error('__dirname:', __dirname);
  }
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Debug middleware to log all requests
app.use('/api', (req, res, next) => {
  console.log(`🔍 API request: ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/picks', pickRoutes);
app.use('/api/weeks', weekRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});


// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// API 404 handler - must come after all API routes
app.use('/api/*', (req, res) => {
  console.log(`❌ Unhandled API route: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'API route not found' });
});

// Serve React app for non-API routes in production
if (isProduction) {
  app.get('*', (req, res) => {
    
    // Try multiple possible paths for index.html
    const possibleIndexPaths = [
      path.join(__dirname, '../../client/dist/index.html'),
      path.join(__dirname, '../../../client/dist/index.html'),
      path.join(process.cwd(), 'client/dist/index.html'),
      '/app/client/dist/index.html'
    ];
    
    let indexPath = '';
    for (const testPath of possibleIndexPaths) {
      if (fs.existsSync(testPath)) {
        indexPath = testPath;
        break;
      }
    }
    
    if (indexPath) {
      console.log('Serving index.html from:', indexPath);
      res.sendFile(indexPath);
    } else {
      console.error('Could not find index.html. Tried paths:', possibleIndexPaths);
      res.status(404).send('Application not found');
    }
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start the automated scheduler
    startScheduler();
    console.log('Scheduler started');
    
    app.listen(PORT, () => {
      console.log(`🏈 CFB Pick'em Server running on port ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

startServer();