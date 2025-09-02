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

// POST version - Fetch spreads endpoint with proper error handling and locking
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
    
    // Check if spreads are locked for this week
    if (currentWeek.spreads_locked) {
      return res.status(423).json({ 
        error: 'Spreads are locked',
        message: `Spreads for Week ${currentWeek.week_number} are locked because games have started. Cannot update spreads.`,
        week: currentWeek.week_number,
        spreads_locked: true
      });
    }
    
    const games = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
    
    // For now, just return success without actually calling the API
    // This prevents API quota usage during testing
    res.json({ 
      message: 'Fetch spreads endpoint working (API key configured)',
      updated: 0,
      total: games.length,
      week: currentWeek.week_number,
      spreads_locked: false,
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
          external_game_id, 
          home_team, 
          away_team, 
          spread, 
          favorite_team, 
          start_time, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
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
          `INSERT INTO weeks (week_number, season_year, deadline, is_active)
           VALUES (?, ?, ?, ?)`,
          [
            weekNum,
            seasonYear,
            weekEnd.toISOString(), // Use week end as deadline
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

// Lock spreads for a specific week (prevent further spread updates)
router.post('/lock-spreads/:week_id', async (req, res) => {
  try {
    const { week_id } = req.params;
    
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ? LIMIT 1', [week_id]);
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    await runQuery('UPDATE weeks SET spreads_locked = 1 WHERE id = ?', [week_id]);
    
    console.log(`🔒 Locked spreads for Week ${week.week_number}`);
    
    res.json({
      message: `Spreads locked for Week ${week.week_number}`,
      week_number: week.week_number,
      spreads_locked: true
    });
  } catch (error) {
    console.error('Error locking spreads:', error);
    res.status(500).json({ error: 'Failed to lock spreads' });
  }
});

// Unlock spreads for a specific week (allow spread updates again)
router.post('/unlock-spreads/:week_id', async (req, res) => {
  try {
    const { week_id } = req.params;
    
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ? LIMIT 1', [week_id]);
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    await runQuery('UPDATE weeks SET spreads_locked = 0 WHERE id = ?', [week_id]);
    
    console.log(`🔓 Unlocked spreads for Week ${week.week_number}`);
    
    res.json({
      message: `Spreads unlocked for Week ${week.week_number}`,
      week_number: week.week_number,
      spreads_locked: false
    });
  } catch (error) {
    console.error('Error unlocking spreads:', error);
    res.status(500).json({ error: 'Failed to unlock spreads' });
  }
});

// Auto-lock spreads when first game of the week starts
router.post('/auto-lock-spreads', async (req, res) => {
  try {
    console.log('🔍 Checking for weeks that need spread locking...');
    
    const now = new Date();
    
    // Find weeks where the earliest game has started but spreads aren't locked yet
    const weeksToLock = await allQuery<any>(
      `SELECT DISTINCT w.id, w.week_number, w.season_year, 
              MIN(g.start_time) as earliest_game_time
       FROM weeks w
       JOIN games g ON w.id = g.week_id
       WHERE w.spreads_locked = 0
         AND datetime(g.start_time) <= datetime('now')
       GROUP BY w.id, w.week_number, w.season_year
       HAVING datetime(earliest_game_time) <= datetime('now')`
    );
    
    let lockedCount = 0;
    for (const week of weeksToLock) {
      await runQuery('UPDATE weeks SET spreads_locked = 1 WHERE id = ?', [week.id]);
      console.log(`🔒 Auto-locked spreads for Week ${week.week_number} (first game started)`);
      lockedCount++;
    }
    
    res.json({
      message: `Auto-locked spreads for ${lockedCount} weeks`,
      locked_weeks: weeksToLock.map(w => ({ week: w.week_number, year: w.season_year })),
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('Error auto-locking spreads:', error);
    res.status(500).json({ error: 'Failed to auto-lock spreads' });
  }
});

// Debug endpoint to check what CFBD API returns for completed games
router.get('/debug-scores/:year/:week', async (req, res) => {
  try {
    const { year, week } = req.params;
    console.log(`🔍 Debug: Checking scores for ${year} week ${week}`);
    
    const { getGameScores } = require('../services/cfbDataApi');
    const completedGames = await getGameScores(parseInt(year), parseInt(week));
    
    console.log(`Found ${completedGames.length} completed games from CFBD API`);
    completedGames.forEach((game: any) => {
      console.log(`- ${game.away_team} @ ${game.home_team}: ${game.away_points}-${game.home_points} (completed: ${game.completed})`);
    });
    
    // Also check our database games
    const dbGames = await allQuery<any>('SELECT * FROM games WHERE week_id IN (SELECT id FROM weeks WHERE season_year = ? AND week_number = ?)', [parseInt(year), parseInt(week)]);
    console.log(`Found ${dbGames.length} games in our database for this week`);
    
    res.json({
      cfbd_completed_games: completedGames,
      database_games: dbGames,
      cfbd_count: completedGames.length,
      database_count: dbGames.length
    });
  } catch (error) {
    console.error('Error in debug scores:', error);
    res.status(500).json({ error: 'Failed to debug scores' });
  }
});

// Clean up 2024 season data (games, weeks, picks, scores)
router.post('/cleanup-2024', async (req, res) => {
  try {
    console.log('🧹 Starting 2024 season data cleanup...');
    
    // Get count before deletion for reporting
    const week2024Count = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM weeks WHERE season_year = 2024');
    const game2024Count = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM games WHERE week_id IN (SELECT id FROM weeks WHERE season_year = 2024)');
    const pick2024Count = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM picks WHERE game_id IN (SELECT g.id FROM games g JOIN weeks w ON g.week_id = w.id WHERE w.season_year = 2024)');
    const weeklyScore2024Count = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM weekly_scores WHERE week_id IN (SELECT id FROM weeks WHERE season_year = 2024)');
    
    console.log(`Found 2024 data: ${week2024Count?.count || 0} weeks, ${game2024Count?.count || 0} games, ${pick2024Count?.count || 0} picks, ${weeklyScore2024Count?.count || 0} weekly scores`);
    
    // Delete in correct order (foreign key constraints)
    // 1. Delete picks first (references games)
    await runQuery('DELETE FROM picks WHERE game_id IN (SELECT g.id FROM games g JOIN weeks w ON g.week_id = w.id WHERE w.season_year = 2024)');
    console.log(`🗑️ Deleted ${pick2024Count?.count || 0} picks from 2024`);
    
    // 2. Delete weekly scores (references weeks) 
    await runQuery('DELETE FROM weekly_scores WHERE week_id IN (SELECT id FROM weeks WHERE season_year = 2024)');
    console.log(`🗑️ Deleted ${weeklyScore2024Count?.count || 0} weekly scores from 2024`);
    
    // 3. Delete games (references weeks)
    await runQuery('DELETE FROM games WHERE week_id IN (SELECT id FROM weeks WHERE season_year = 2024)');
    console.log(`🗑️ Deleted ${game2024Count?.count || 0} games from 2024`);
    
    // 4. Finally delete weeks
    await runQuery('DELETE FROM weeks WHERE season_year = 2024');
    console.log(`🗑️ Deleted ${week2024Count?.count || 0} weeks from 2024`);
    
    // Verify cleanup
    const remainingWeeks = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM weeks WHERE season_year = 2024');
    const remainingGames = await getQuery<{count: number}>('SELECT COUNT(*) as count FROM games WHERE week_id IN (SELECT id FROM weeks WHERE season_year = 2024)');
    
    console.log('✅ 2024 cleanup completed successfully');
    
    res.json({
      message: '2024 season data cleanup completed successfully',
      deleted: {
        weeks: week2024Count?.count || 0,
        games: game2024Count?.count || 0,
        picks: pick2024Count?.count || 0,
        weekly_scores: weeklyScore2024Count?.count || 0
      },
      remaining: {
        weeks_2024: remainingWeeks?.count || 0,
        games_2024: remainingGames?.count || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error cleaning up 2024 data:', error);
    res.status(500).json({ error: 'Failed to cleanup 2024 data' });
  }
});

// Manually update active week to current calculated week
router.post('/update-active-week', async (req, res) => {
  try {
    console.log('📅 Manual active week update triggered');
    
    const { getCurrentWeek } = require('../services/scheduler');
    const { year, week } = getCurrentWeek();
    
    // Get current active week for comparison
    const currentActive = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    
    // Set all weeks as inactive first
    await runQuery('UPDATE weeks SET is_active = 0 WHERE season_year = ?', [year]);
    
    // Set the calculated current week as active
    const result = await runQuery(
      'UPDATE weeks SET is_active = 1 WHERE week_number = ? AND season_year = ?',
      [week, year]
    );
    
    const newActive = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    
    console.log(`✅ Active week updated from Week ${currentActive?.week_number || 'none'} to Week ${week}`);
    
    res.json({
      message: `Active week updated to Week ${week} of ${year}`,
      previous_active: currentActive ? `Week ${currentActive.week_number}` : 'none',
      new_active: `Week ${week}`,
      year: year,
      updated_rows: result.changes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating active week:', error);
    res.status(500).json({ error: 'Failed to update active week' });
  }
});

export default router;