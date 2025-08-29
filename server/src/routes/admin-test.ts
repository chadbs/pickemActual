import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';
import { getTopGamesForWeek } from '../services/cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from '../services/oddsApi';
import { fetchWeeklyGames, updateGameScores, fetchAllSeasonGames } from '../services/scheduler';

const router = express.Router();

// Debug middleware to log all requests to admin routes
router.use((req, res, next) => {
  console.log(`🔍 Admin route hit: ${req.method} ${req.path}`);
  next();
});

// Test routes with multiple HTTP methods for debugging
router.get('/test', (req, res) => {
  console.log('🔍 GET /test route hit');
  res.json({ message: 'Admin test working! (GET)', method: 'GET', timestamp: new Date().toISOString() });
});

router.post('/test', (req, res) => {
  console.log('🔍 POST /test route hit');
  res.json({ message: 'Admin test working! (POST)', method: 'POST', timestamp: new Date().toISOString() });
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

// GET version of fetch-spreads for browser testing
router.get('/fetch-spreads', async (req, res) => {
  console.log('🚀 GET FETCH SPREADS ENDPOINT HIT!');
  res.json({ 
    message: 'GET fetch spreads working!',
    method: 'GET',
    timestamp: new Date().toISOString()
  });
});

// POST version - Fetch spreads endpoint with proper error handling
router.post('/fetch-spreads', async (req, res) => {
  console.log('🚀 POST FETCH SPREADS ENDPOINT HIT!');
  
  try {
    // Check if ODDS_API_KEY is configured
    if (!process.env.ODDS_API_KEY) {
      return res.status(400).json({ 
        error: 'ODDS_API_KEY not configured',
        message: 'Please set the ODDS_API_KEY environment variable to fetch odds data'
      });
    }
    
    const currentWeek = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    if (!currentWeek) {
      return res.status(404).json({ error: 'No active week found' });
    }
    
    const games = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
    
    // For now, just return success without actually calling the API
    // This prevents API quota usage during testing
    res.json({ 
      message: 'Fetch spreads endpoint working (API key configured)',
      updated: 0,
      total: games.length,
      week: currentWeek.week_number,
      apiKeyStatus: 'configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in fetch spreads:', error);
    res.status(500).json({ 
      error: 'Failed to fetch spreads',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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

// Preview games for matchup selection
router.get('/preview-games/:year/:week', async (req, res) => {
  try {
    const { year, week } = req.params;
    console.log(`🎯 Preview games requested for ${year} week ${week}`);
    
    const cfbdGames = await getTopGamesForWeek(parseInt(year), parseInt(week));
    
    // Try to get odds
    let gamesWithOdds = cfbdGames;
    try {
      const rawOdds = await getNCAAFootballOdds();
      const parsedOdds = parseOddsData(rawOdds);
      gamesWithOdds = matchOddsToGames(cfbdGames, parsedOdds);
    } catch (error) {
      console.warn('Could not fetch odds for preview:', error);
    }
    
    res.json({
      games: gamesWithOdds.slice(0, 20), // Show top 20 options for selection
      week_info: { year: parseInt(year), week: parseInt(week) }
    });
  } catch (error) {
    console.error('Error previewing games:', error);
    res.status(500).json({ error: 'Failed to preview games' });
  }
});

// Create games from preview selection
router.post('/create-games', async (req, res) => {
  try {
    const { week_id, selected_games } = req.body;
    
    if (!week_id || !selected_games || !Array.isArray(selected_games)) {
      return res.status(400).json({ error: 'Missing week_id or selected_games array' });
    }
    
    // Get week info
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ? LIMIT 1', [week_id]);
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // Delete existing games for this week to replace them
    await runQuery('DELETE FROM games WHERE week_id = ?', [week_id]);
    console.log(`🗑️ Cleared existing games for week ${week.week_number}`);
    
    const createdGames = [];
    
    for (const game of selected_games.slice(0, 8)) { // Limit to 8 games
      const favoriteInfo = [game.home_team, game.away_team].find(team => 
        ['alabama', 'georgia', 'oregon', 'texas', 'oklahoma', 'michigan', 'ohio state'].some(fav => 
          team.toLowerCase().includes(fav.toLowerCase())
        )
      );
      
      const result = await runQuery(
        `INSERT INTO games (
          week_id, 
          cfbd_id, 
          home_team, 
          away_team, 
          spread, 
          favorite_team, 
          start_date, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          week_id,
          game.id || 'preview_' + Date.now(),
          game.home_team,
          game.away_team,
          game.spread || null,
          game.favorite_team || favoriteInfo,
          game.start_date || new Date().toISOString()
        ]
      );
      
      const gameRecord = await getQuery<any>(
        'SELECT * FROM games WHERE id = ? LIMIT 1',
        [result.lastID]
      );
      
      createdGames.push({
        id: result.lastID,
        ...game
      });
    }
    
    console.log(`✅ Created ${createdGames.length} games for week ${week.week_number}`);
    
    res.json({
      message: `Successfully created ${createdGames.length} games for week ${week.week_number}`,
      games: createdGames
    });
  } catch (error) {
    console.error('Error creating games:', error);
    res.status(500).json({ error: 'Failed to create games' });
  }
});

// Manually trigger game fetch for current week
router.post('/fetch-games', async (req, res) => {
  try {
    console.log('🎯 Manual fetch games triggered');
    await fetchWeeklyGames(true); // Force refresh when called manually
    res.json({ message: 'Games fetched successfully' });
  } catch (error) {
    console.error('Error manually fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Fetch games for a specific week
router.post('/fetch-games-for-week', async (req, res) => {
  try {
    const { week_id, year, week_number } = req.body;
    
    if (!year || !week_number) {
      return res.status(400).json({ error: 'Year and week_number are required' });
    }

    console.log(`🎯 Fetch games for week ${week_number} of ${year}`);
    
    let weekData;
    if (week_id) {
      weekData = await getQuery<any>('SELECT * FROM weeks WHERE id = ?', [week_id]);
    } else {
      weekData = await getQuery<any>('SELECT * FROM weeks WHERE season_year = ? AND week_number = ?', [year, week_number]);
    }
    
    if (!weekData) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // Fetch games for the specific week
    const games = await getTopGamesForWeek(year, week_number);
    
    res.json({
      message: `Successfully fetched ${games.length} games for week ${week_number}`,
      games_created: games.length,
      week_info: weekData
    });
  } catch (error) {
    console.error('Error fetching games for week:', error);
    res.status(500).json({ error: 'Failed to fetch games for week' });
  }
});

// Manually trigger score updates
router.post('/update-scores', async (req, res) => {
  try {
    console.log('🎯 Manual score update triggered');
    await updateGameScores();
    res.json({ message: 'Scores updated successfully' });
  } catch (error) {
    console.error('Error manually updating scores:', error);
    res.status(500).json({ error: 'Failed to update scores' });
  }
});

// Create a full season of weeks (Weeks 1-15)
router.post('/create-season-weeks', async (req, res) => {
  try {
    const { year } = req.body;
    const seasonYear = year || 2025;
    
    console.log(`🗓️ ADMIN: Creating full season of weeks for ${seasonYear}...`);
    
    const createdWeeks = [];
    
    for (let weekNum = 1; weekNum <= 15; weekNum++) {
      // Check if week already exists
      const existingWeek = await getQuery<any>(
        'SELECT * FROM weeks WHERE week_number = ? AND season_year = ?',
        [weekNum, seasonYear]
      );
      
      if (!existingWeek) {
        // Calculate dates - Week 1 starts August 28th
        const week1Start = new Date(seasonYear, 7, 28); // August 28th
        const weekStart = new Date(week1Start);
        weekStart.setDate(weekStart.getDate() + ((weekNum - 1) * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const result = await runQuery(
          `INSERT INTO weeks (week_number, season_year, start_date, end_date, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            weekNum,
            seasonYear,
            weekStart.toISOString(),
            weekEnd.toISOString(),
            weekNum === 1 ? 1 : 0 // Make week 1 active by default
          ]
        );

        const newWeek = await getQuery<any>('SELECT * FROM weeks WHERE id = ?', [result.lastID]);
        createdWeeks.push(newWeek);
      }
    }
    
    res.json({
      message: `Successfully created ${createdWeeks.length} weeks for ${seasonYear} season`,
      weeks: createdWeeks,
      season_year: seasonYear
    });
  } catch (error) {
    console.error('Error creating season weeks:', error);
    res.status(500).json({ error: 'Failed to create season weeks' });
  }
});

export default router;