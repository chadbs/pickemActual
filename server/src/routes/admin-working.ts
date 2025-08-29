import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';

const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
  res.json({ message: 'Admin working!', timestamp: new Date().toISOString() });
});

// Get admin dashboard stats (simplified)
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getQuery<any>(
      `SELECT 
         (SELECT COUNT(*) FROM users) as total_users,
         (SELECT COUNT(*) FROM games) as total_games,
         (SELECT COUNT(*) FROM picks) as total_picks`
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Simple fetch spreads endpoint (no complex imports)
router.post('/fetch-spreads', async (req, res) => {
  console.log('🚀 WORKING FETCH SPREADS ENDPOINT HIT!');
  
  try {
    // Get current week games
    const currentWeek = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    if (!currentWeek) {
      return res.status(404).json({ error: 'No active week found' });
    }
    
    const games = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
    
    res.json({ 
      message: 'Working fetch spreads endpoint!',
      updated: 0,
      total: games.length,
      week: currentWeek.week_number,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in fetch spreads:', error);
    res.status(500).json({ error: 'Failed to fetch spreads' });
  }
});

export default router;