import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';

const router = express.Router();

// Simple test routes with different paths
router.get('/test', (req, res) => {
  res.json({ message: 'Admin test working!', timestamp: new Date().toISOString() });
});

router.get('/working', (req, res) => {
  res.json({ message: 'Admin working route!', timestamp: new Date().toISOString() });
});

router.get('/debug', (req, res) => {
  res.json({ message: 'Admin debug route!', timestamp: new Date().toISOString() });
});

// Get admin dashboard stats (simplified)
router.get('/dashboard', async (req, res) => {
  console.log('🚀 ADMIN-WORKING DASHBOARD HIT!');
  try {
    const stats = await getQuery<any>(
      `SELECT 
         (SELECT COUNT(*) FROM users) as total_users,
         (SELECT COUNT(*) FROM games) as total_games,
         (SELECT COUNT(*) FROM picks) as total_picks`
    );
    
    res.json({
      ...stats,
      message: 'FROM ADMIN-WORKING.TS!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Simple fetch spreads endpoints with different methods/paths
router.post('/fetch-spreads', async (req, res) => {
  console.log('🚀 POST FETCH SPREADS ENDPOINT HIT!');
  
  try {
    const currentWeek = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    if (!currentWeek) {
      return res.status(404).json({ error: 'No active week found' });
    }
    
    const games = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
    
    res.json({ 
      message: 'POST fetch spreads working!',
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

router.get('/fetch-spreads-test', async (req, res) => {
  console.log('🚀 GET FETCH SPREADS TEST HIT!');
  res.json({ 
    message: 'GET fetch spreads test working!',
    method: 'GET',
    timestamp: new Date().toISOString()
  });
});

export default router;