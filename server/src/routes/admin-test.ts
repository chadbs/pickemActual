import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';
import { getTopGamesForWeek } from '../services/cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from '../services/oddsApi';
import { fetchWeeklyGames, updateGameScores, fetchAllSeasonGames } from '../services/scheduler';
import { scrapeGamesForWeek } from '../services/webScraper';
import { scrapeAllSpreads, matchSpreadToGames } from '../services/spreadScraper';

const router = express.Router();

// Debug middleware to log all requests to admin routes
router.use((req, res, next) => {
  console.log(`🔍 Admin route hit: ${req.method} ${req.path}`);
  next();
});

// Test routes with multiple HTTP methods for debugging
router.get('/test', (req, res) => {
  console.log('🔍 GET /test route hit');
  res.json({
    message: 'Admin test working! (GET)',
    method: 'GET',
    version: '2.0-SCRAPED-GAMES-ENDPOINT-ADDED',
    newEndpoints: ['/admin/scraped-games/:year/:week'],
    timestamp: new Date().toISOString()
  });
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

    let cfbdGames: any[] = [];
    try {
      cfbdGames = await getTopGamesForWeek(parseInt(year), parseInt(week));
    } catch (apiError: any) {
      console.warn('CFBD API Error (likely rate limit):', apiError.message);

      // Return a fallback message when API is rate limited
      if (apiError.message?.includes('429') || apiError.message?.includes('quota')) {
        return res.json({
          games: [],
          week_info: { year: parseInt(year), week: parseInt(week) },
          error: 'College Football Data API quota exceeded. Please try again later or contact support.',
          api_limited: true
        });
      }

      // For other API errors, return empty games list
      console.error('Failed to fetch games from CFBD API:', apiError);
    }

    // Try to get odds if we have games
    let gamesWithOdds = cfbdGames;
    if (cfbdGames.length > 0) {
      try {
        const rawOdds = await getNCAAFootballOdds();
        const parsedOdds = parseOddsData(rawOdds);
        gamesWithOdds = matchOddsToGames(cfbdGames, parsedOdds);
      } catch (error) {
        console.warn('Could not fetch odds for preview:', error);
      }
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

// Get scraped games for selection (alternative to top-games when API fails)
router.get('/scraped-games/:year/:week', async (req, res) => {
  try {
    const { year, week } = req.params;
    const targetYear = parseInt(year) || 2025;
    const targetWeek = parseInt(week) || 1;

    console.log(`Getting scraped games for selection: ${targetYear} Week ${targetWeek}`);

    // Import scraper
    const { scrapeGamesForWeek } = await import('../services/webScraper');
    const scrapedGames = await scrapeGamesForWeek(targetYear, targetWeek);

    if (scrapedGames.length === 0) {
      return res.json({
        games: [],
        week: targetWeek,
        year: targetYear,
        totalAvailable: 0,
        selectedCount: 0,
        dataSource: 'web_scraping',
        message: 'No games found via scraping',
        timestamp: new Date().toISOString()
      });
    }

    // Apply intelligent scoring like we do for API games
    const { isFavoriteTeam } = await import('../services/cfbDataApi');

    const popularPrograms = new Set([
      'Alabama', 'Georgia', 'Texas', 'Oklahoma', 'USC', 'Notre Dame', 'Michigan', 'Ohio State',
      'Penn State', 'Florida', 'LSU', 'Auburn', 'Tennessee', 'Florida State', 'Miami', 'Clemson',
      'Oregon', 'Washington', 'UCLA', 'Stanford', 'Wisconsin', 'Iowa', 'Michigan State', 'Nebraska',
      'Colorado', 'Colorado State', 'Utah', 'Arizona State', 'Arizona', 'BYU', 'TCU', 'Baylor',
      'Texas A&M', 'Ole Miss', 'Mississippi State', 'Arkansas', 'Kentucky', 'Vanderbilt', 'South Carolina',
      'North Carolina', 'NC State', 'Duke', 'Wake Forest', 'Virginia', 'Virginia Tech', 'Louisville',
      'Kansas', 'Kansas State', 'Oklahoma State', 'Texas Tech', 'Houston', 'Cincinnati', 'UCF',
      'West Virginia', 'Pittsburgh', 'Syracuse', 'Boston College', 'Maryland', 'Rutgers'
    ]);

    // Remove duplicates based on team matchup
    const uniqueGames = [];
    const seenMatchups = new Set();

    for (const game of scrapedGames) {
      const matchupKey = [game.home_team, game.away_team].sort().join(' vs ');
      if (!seenMatchups.has(matchupKey)) {
        seenMatchups.add(matchupKey);
        uniqueGames.push(game);
      }
    }

    console.log(`Removed duplicates: ${scrapedGames.length} -> ${uniqueGames.length} unique games`);

    // Score games for selection
    const scoredGames = uniqueGames.map((game: any) => {
      let score = 0;

      // HIGHEST PRIORITY: Favorite team games
      if (isFavoriteTeam(game.home_team) || isFavoriteTeam(game.away_team)) {
        score += 10000;
        console.log(`Favorite team game (scraped): ${game.away_team} @ ${game.home_team}`);
      }

      // HIGH PRIORITY: Both teams are popular programs
      if (popularPrograms.has(game.home_team) && popularPrograms.has(game.away_team)) {
        score += 500;
        console.log(`Popular matchup (scraped): ${game.away_team} @ ${game.home_team}`);
      }
      // MEDIUM: One team is popular program
      else if (popularPrograms.has(game.home_team) || popularPrograms.has(game.away_team)) {
        score += 250;
      }

      // Convert to API-like format for consistency
      return {
        id: parseInt(game.id) || Math.floor(Math.random() * 1000000),
        season: targetYear,
        week: targetWeek,
        seasonType: 'regular',
        startDate: game.start_date,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        home_team: game.home_team,
        away_team: game.away_team,
        start_date: game.start_date,
        completed: game.completed,
        selection_score: score,
        source: 'web_scraping'
      };
    });

    // Sort by score and return top 20
    const topGames = scoredGames
      .sort((a, b) => b.selection_score - a.selection_score)
      .slice(0, 20);

    console.log(`Top 20 scraped games for selection:`, topGames.slice(0, 10).map((g: any) => `${g.away_team} @ ${g.home_team} (${g.selection_score})`));

    // Check which games are already selected for this week
    const weekData = await getQuery(`
      SELECT * FROM weeks
      WHERE week_number = ? AND season_year = ?
    `, [targetWeek, targetYear]);

    let selectedGameIds: string[] = [];
    if (weekData) {
      const selectedGames = await allQuery(`
        SELECT external_game_id FROM games WHERE week_id = ?
      `, [(weekData as any).id]);
      selectedGameIds = selectedGames.map((g: any) => g.external_game_id).filter(Boolean);
    }

    // Add selection status to each game
    const gamesWithStatus = topGames.map((game: any) => ({
      ...game,
      isSelected: selectedGameIds.includes(game.id?.toString())
    }));

    res.json({
      games: gamesWithStatus,
      week: targetWeek,
      year: targetYear,
      totalAvailable: topGames.length,
      selectedCount: selectedGameIds.length,
      dataSource: 'web_scraping',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error scraping games for selection:', error);
    res.status(500).json({
      error: 'Failed to scrape games',
      details: error.message,
      games: [],
      week: parseInt(req.params.week) || 1,
      year: parseInt(req.params.year) || 2025,
      totalAvailable: 0,
      selectedCount: 0,
      dataSource: 'web_scraping',
      timestamp: new Date().toISOString()
    });
  }
});

// Get top 20 games for selection
router.get('/top-games/:year/:week', async (req, res) => {
  try {
    const { year, week } = req.params;
    const targetYear = parseInt(year) || 2025;
    const targetWeek = parseInt(week) || 1;

    console.log(`Getting top 20 games for ${targetYear} Week ${targetWeek}`);

    // Check if CFBD API key is configured
    if (!process.env.CFBD_API_KEY) {
      return res.status(400).json({
        error: 'CFBD API not configured',
        message: 'College Football Data API key is not set. Please use the scraping options instead.',
        games: [],
        week: targetWeek,
        year: targetYear,
        totalAvailable: 0,
        selectedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Get top games from CFBD API
    const topGames = await getTopGamesForWeek(targetYear, targetWeek);

    // Check which games are already selected for this week
    const weekData = await getQuery(`
      SELECT * FROM weeks
      WHERE week_number = ? AND season_year = ?
    `, [targetWeek, targetYear]);

    let selectedGameIds: string[] = [];
    if (weekData) {
      const selectedGames = await allQuery(`
        SELECT external_game_id FROM games WHERE week_id = ?
      `, [(weekData as any).id]);
      selectedGameIds = selectedGames.map((g: any) => g.external_game_id).filter(Boolean);
    }

    // Add selection status to each game
    const gamesWithStatus = topGames.map((game: any) => ({
      ...game,
      isSelected: selectedGameIds.includes((game as any).id?.toString())
    }));

    res.json({
      games: gamesWithStatus,
      week: targetWeek,
      year: targetYear,
      totalAvailable: topGames.length,
      selectedCount: selectedGameIds.length,
      dataSource: (topGames[0] as any)?.source || 'cfbd_api', // Indicate data source
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting top games:', error);

    // Handle cases where API quota exceeded but scraping fallback succeeded
    if (error.message?.includes('quota exceeded') && !error.message?.includes('Both API and scraping failed')) {
      // This should not happen anymore due to automatic fallback, but keep for safety
      return res.status(400).json({
        error: 'CFBD API quota exceeded',
        message: 'Monthly API call limit reached. Automatic fallback to scraping should have worked.',
        suggestedAction: 'Try again or use "🕷️ Scrape Games" button directly',
        games: [],
        week: parseInt(req.params.week) || 1,
        year: parseInt(req.params.year) || 2025,
        totalAvailable: 0,
        selectedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Handle other API errors
    if (error.message?.includes('CFBD API error')) {
      return res.status(400).json({
        error: 'CFBD API error',
        message: error.message,
        suggestedAction: 'Use "🕷️ Scrape Games" button instead',
        games: [],
        week: parseInt(req.params.week) || 1,
        year: parseInt(req.params.year) || 2025,
        totalAvailable: 0,
        selectedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to get top games',
      details: error.message
    });
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
    
    // Import and use getCurrentWeek function
    const schedulerModule = await import('../services/scheduler');
    // Manually calculate current week since function is not exported
    const now = new Date();
    const year = 2025;
    const season2025Start = new Date(2025, 7, 25); // August 25, 2025 (Monday)
    
    let week = 1;
    if (now >= season2025Start) {
      const timeDiff = now.getTime() - season2025Start.getTime();
      const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
      week = Math.max(1, Math.min(15, Math.floor(daysDiff / 7) + 1));
    }
    
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

// Update spread for a specific game (only if no spread exists)
router.post('/update-game-spread/:game_id', async (req, res) => {
  try {
    const { game_id } = req.params;
    const { spread, favorite_team } = req.body;
    
    if (!spread || !favorite_team) {
      return res.status(400).json({ error: 'Spread and favorite_team are required' });
    }
    
    // Get the current game
    const game = await getQuery<any>('SELECT * FROM games WHERE id = ? LIMIT 1', [game_id]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Check if game already has a spread (don't allow overriding API spreads)
    if (game.spread !== null && game.spread !== undefined) {
      return res.status(403).json({ 
        error: 'Cannot update spread - game already has an online spread',
        current_spread: game.spread,
        current_favorite: game.favorite_team
      });
    }
    
    // Check if spreads are locked for this week
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ? LIMIT 1', [game.week_id]);
    if (week?.spreads_locked) {
      return res.status(423).json({ 
        error: 'Cannot update spread - spreads are locked for this week',
        week: week.week_number
      });
    }
    
    // Update the game with manual spread
    await runQuery(
      'UPDATE games SET spread = ?, favorite_team = ? WHERE id = ?',
      [parseFloat(spread), favorite_team, game_id]
    );
    
    console.log(`📝 Admin manually set spread for ${game.away_team} @ ${game.home_team}: ${favorite_team} -${spread}`);
    
    res.json({
      message: '🎯 Manual spread set successfully!',
      game: `${game.away_team} @ ${game.home_team}`,
      spread: parseFloat(spread),
      favorite_team: favorite_team,
      preview: `${favorite_team} -${spread}`,
      updated_by: 'admin',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating game spread:', error);
    res.status(500).json({ error: 'Failed to update game spread' });
  }
});

// Clear manual spread for a specific game (only if manually set)
router.delete('/clear-game-spread/:game_id', async (req, res) => {
  try {
    const { game_id } = req.params;
    
    // Get the current game
    const game = await getQuery<any>('SELECT * FROM games WHERE id = ? LIMIT 1', [game_id]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Check if spreads are locked for this week
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ? LIMIT 1', [game.week_id]);
    if (week?.spreads_locked) {
      return res.status(423).json({ 
        error: 'Cannot clear spread - spreads are locked for this week',
        week: week.week_number
      });
    }
    
    // Clear the manual spread
    await runQuery(
      'UPDATE games SET spread = NULL, favorite_team = NULL WHERE id = ?',
      [game_id]
    );
    
    console.log(`🗑️ Admin cleared manual spread for ${game.away_team} @ ${game.home_team}`);
    
    res.json({
      message: '🗑️ Manual spread cleared successfully!',
      game: `${game.away_team} @ ${game.home_team}`,
      action: 'cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing game spread:', error);
    res.status(500).json({ error: 'Failed to clear game spread' });
  }
});

// Delete a user and all their associated data
router.delete('/delete-user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // Get the user first to confirm they exist and get their name
    const user = await getQuery<any>('SELECT * FROM users WHERE id = ? LIMIT 1', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deletion of admin users (safety check)
    if (user.is_admin) {
      return res.status(403).json({ 
        error: 'Cannot delete admin users',
        user_name: user.name
      });
    }
    
    // Start transaction to ensure data consistency
    await runQuery('BEGIN TRANSACTION');
    
    try {
      // Delete user's picks first (foreign key constraint)
      const picksDeleted = await runQuery('DELETE FROM picks WHERE user_id = ?', [user_id]);
      
      // Delete the user
      const userDeleted = await runQuery('DELETE FROM users WHERE id = ?', [user_id]);
      
      // Commit transaction
      await runQuery('COMMIT');
      
      console.log(`🗑️ Admin deleted user: ${user.name} (ID: ${user_id})`);
      console.log(`   - Picks deleted: ${picksDeleted.changes}`);
      
      res.json({
        message: `🗑️ User "${user.name}" deleted successfully!`,
        deleted_user: {
          id: parseInt(user_id),
          name: user.name,
          email: user.email
        },
        picks_deleted: picksDeleted.changes,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Rollback transaction on error
      await runQuery('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Clean up orphaned user data (picks, leaderboard entries for users that no longer exist)
router.post('/cleanup-orphaned-data', async (req, res) => {
  try {
    console.log('🧹 Starting orphaned data cleanup...');
    
    // Get all current valid user IDs
    const currentUsers = await allQuery<any>('SELECT id FROM users');
    const currentUserIds = currentUsers.map(u => u.id);
    console.log(`Found ${currentUserIds.length} current users:`, currentUserIds);
    
    // Find orphaned picks (picks from users that no longer exist)
    const orphanedPicks = await allQuery<any>(
      `SELECT DISTINCT user_id, COUNT(*) as pick_count
       FROM picks 
       WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY user_id`,
      currentUserIds
    );
    
    // Find orphaned weekly scores
    const orphanedWeeklyScores = await allQuery<any>(
      `SELECT DISTINCT user_id, COUNT(*) as score_count
       FROM weekly_scores 
       WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY user_id`,
      currentUserIds
    );
    
    // Find orphaned season standings
    const orphanedSeasonStandings = await allQuery<any>(
      `SELECT DISTINCT user_id, COUNT(*) as standing_count
       FROM season_standings 
       WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY user_id`,
      currentUserIds
    );
    
    let deletedCounts = {
      picks: 0,
      weekly_scores: 0,
      season_standings: 0,
      orphaned_users: new Set()
    };
    
    // Collect all orphaned user IDs
    [...orphanedPicks, ...orphanedWeeklyScores, ...orphanedSeasonStandings].forEach(item => {
      deletedCounts.orphaned_users.add(item.user_id);
    });
    
    if (deletedCounts.orphaned_users.size === 0) {
      return res.json({
        message: '✅ No orphaned data found - database is clean!',
        details: {
          current_users: currentUserIds.length,
          orphaned_users: 0,
          deleted: deletedCounts
        }
      });
    }
    
    console.log(`Found orphaned data for ${deletedCounts.orphaned_users.size} deleted users:`, Array.from(deletedCounts.orphaned_users));
    
    // Delete orphaned picks
    if (orphanedPicks.length > 0) {
      const picksToDelete = orphanedPicks.map(p => p.user_id);
      const pickResult = await runQuery(
        `DELETE FROM picks WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})`,
        currentUserIds
      );
      deletedCounts.picks = pickResult.changes || 0;
      console.log(`Deleted ${deletedCounts.picks} orphaned picks`);
    }
    
    // Delete orphaned weekly scores
    if (orphanedWeeklyScores.length > 0) {
      const weeklyResult = await runQuery(
        `DELETE FROM weekly_scores WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})`,
        currentUserIds
      );
      deletedCounts.weekly_scores = weeklyResult.changes || 0;
      console.log(`Deleted ${deletedCounts.weekly_scores} orphaned weekly scores`);
    }
    
    // Delete orphaned season standings
    if (orphanedSeasonStandings.length > 0) {
      const seasonResult = await runQuery(
        `DELETE FROM season_standings WHERE user_id NOT IN (${currentUserIds.map(() => '?').join(',')})`,
        currentUserIds
      );
      deletedCounts.season_standings = seasonResult.changes || 0;
      console.log(`Deleted ${deletedCounts.season_standings} orphaned season standings`);
    }
    
    const totalDeleted = deletedCounts.picks + deletedCounts.weekly_scores + deletedCounts.season_standings;
    
    res.json({
      message: `🧹 Successfully cleaned up orphaned data! Removed ${totalDeleted} records from ${deletedCounts.orphaned_users.size} deleted users.`,
      details: {
        current_users: currentUserIds.length,
        orphaned_users: Array.from(deletedCounts.orphaned_users),
        deleted: {
          picks: deletedCounts.picks,
          weekly_scores: deletedCounts.weekly_scores,
          season_standings: deletedCounts.season_standings,
          total: totalDeleted
        }
      }
    });
    
  } catch (error) {
    console.error('Error cleaning up orphaned data:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup orphaned data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get orphaned data preview (to see what would be deleted without actually deleting)
router.get('/preview-orphaned-data', async (req, res) => {
  try {
    // Get all current valid user IDs
    const currentUsers = await allQuery<any>('SELECT id, name FROM users ORDER BY id');
    const currentUserIds = currentUsers.map(u => u.id);
    
    if (currentUserIds.length === 0) {
      return res.json({
        message: 'No users found in system',
        orphaned_data: []
      });
    }
    
    // Find orphaned data with details
    const orphanedData = await allQuery<any>(
      `SELECT 
        'picks' as table_name,
        p.user_id,
        COUNT(*) as record_count,
        MIN(p.created_at) as first_record,
        MAX(p.created_at) as last_record
       FROM picks p
       WHERE p.user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY p.user_id
       
       UNION ALL
       
       SELECT 
        'weekly_scores' as table_name,
        ws.user_id,
        COUNT(*) as record_count,
        MIN(ws.created_at) as first_record,
        MAX(ws.updated_at) as last_record
       FROM weekly_scores ws
       WHERE ws.user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY ws.user_id
       
       UNION ALL
       
       SELECT 
        'season_standings' as table_name,
        ss.user_id,
        COUNT(*) as record_count,
        MIN(ss.created_at) as first_record,
        MAX(ss.updated_at) as last_record
       FROM season_standings ss
       WHERE ss.user_id NOT IN (${currentUserIds.map(() => '?').join(',')})
       GROUP BY ss.user_id
       
       ORDER BY user_id, table_name`,
      [...currentUserIds, ...currentUserIds, ...currentUserIds]
    );
    
    // Group by user_id for easier reading
    const groupedOrphans: { [key: string]: any } = {};
    orphanedData.forEach(item => {
      if (!groupedOrphans[item.user_id]) {
        groupedOrphans[item.user_id] = {
          user_id: item.user_id,
          tables: {},
          total_records: 0
        };
      }
      groupedOrphans[item.user_id].tables[item.table_name] = {
        count: item.record_count,
        first_record: item.first_record,
        last_record: item.last_record
      };
      groupedOrphans[item.user_id].total_records += item.record_count;
    });
    
    res.json({
      message: `Found orphaned data for ${Object.keys(groupedOrphans).length} deleted users`,
      current_users: currentUsers,
      orphaned_data: Object.values(groupedOrphans),
      summary: {
        current_user_count: currentUsers.length,
        orphaned_user_count: Object.keys(groupedOrphans).length,
        total_orphaned_records: Object.values(groupedOrphans).reduce((sum: number, user: any) => sum + user.total_records, 0)
      }
    });
    
  } catch (error) {
    console.error('Error previewing orphaned data:', error);
    res.status(500).json({ 
      error: 'Failed to preview orphaned data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Scrape data without using API credits
router.post('/scrape-games', async (req, res) => {
  try {
    console.log('🕷️ SCRAPE GAMES ENDPOINT HIT!');
    
    const { week, year } = req.body;
    const targetYear = year || 2025;
    const targetWeek = week || 1;
    
    console.log(`Scraping games for ${targetYear} Week ${targetWeek}...`);
    
    // Get current active week if not specified
    let weekData: any;
    if (!week) {
      weekData = await getQuery(`
        SELECT * FROM weeks 
        WHERE is_active = 1 AND season_year = ?
        ORDER BY week_number DESC LIMIT 1
      `, [targetYear]);
      
      if (!weekData) {
        return res.status(400).json({ 
          error: 'No active week found and no week specified' 
        });
      }
    } else {
      weekData = await getQuery(`
        SELECT * FROM weeks 
        WHERE week_number = ? AND season_year = ?
      `, [targetWeek, targetYear]);
      
      if (!weekData) {
        return res.status(400).json({ 
          error: `Week ${targetWeek} of ${targetYear} not found in database` 
        });
      }
    }
    
    // Clear existing games for this week
    await runQuery('DELETE FROM games WHERE week_id = ?', [weekData.id]);
    console.log(`Cleared existing games for Week ${weekData.week_number}`);
    
    // Scrape new games
    let scrapedGames = await scrapeGamesForWeek(targetYear, weekData.week_number);
    
    if (scrapedGames.length === 0) {
      return res.json({ 
        message: 'No games found via scraping',
        week: weekData.week_number,
        year: targetYear,
        gamesStored: 0
      });
    }
    
    // Try to scrape spreads too
    let spreadsAdded = 0;
    try {
      console.log('🎰 Also scraping spread data...');
      const scrapedSpreads = await scrapeAllSpreads();
      if (scrapedSpreads.length > 0) {
        scrapedGames = matchSpreadToGames(scrapedGames, scrapedSpreads);
        spreadsAdded = scrapedGames.filter(g => g.spread).length;
        console.log(`✅ Added spreads to ${spreadsAdded} games`);
      }
    } catch (error) {
      console.warn('Spread scraping failed, continuing without spreads:', error);
    }
    
    // Store scraped games in database
    let storedCount = 0;
    for (const game of scrapedGames.slice(0, 8)) { // Limit to 8 games
      try {
        await runQuery(`
          INSERT INTO games 
          (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
           start_time, status, is_favorite_team_game)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          weekData.id,
          game.id || null,
          game.home_team,
          game.away_team,
          game.spread || null,
          game.favorite_team || null,
          game.start_date || new Date().toISOString(),
          game.completed ? 'completed' : 'scheduled',
          false // Will calculate favorite teams later
        ]);
        storedCount++;
      } catch (error) {
        console.warn(`Error storing game ${game.home_team} vs ${game.away_team}:`, error);
      }
    }
    
    res.json({
      message: `Successfully scraped and stored games for Week ${weekData.week_number}`,
      week: weekData.week_number,
      year: targetYear,
      gamesFound: scrapedGames.length,
      gamesStored: storedCount,
      spreadsAdded: spreadsAdded,
      source: 'web_scraping',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error in scrape-games endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to scrape games',
      details: error.message 
    });
  }
});

// Scrape spreads only (without replacing games)
router.post('/scrape-spreads', async (req, res) => {
  try {
    console.log('🎰 SCRAPE SPREADS ENDPOINT HIT!');
    
    const { week, year } = req.body;
    const targetYear = year || 2025;
    const targetWeek = week || null;
    
    // Get games to update spreads for
    let games: any[];
    if (targetWeek) {
      const weekData: any = await getQuery(`
        SELECT * FROM weeks 
        WHERE week_number = ? AND season_year = ?
      `, [targetWeek, targetYear]);
      
      if (!weekData) {
        return res.status(400).json({ 
          error: `Week ${targetWeek} of ${targetYear} not found` 
        });
      }
      
      games = await allQuery(`
        SELECT * FROM games WHERE week_id = ?
      `, [weekData.id]);
    } else {
      // Get all games without spreads
      games = await allQuery(`
        SELECT g.*, w.week_number FROM games g
        JOIN weeks w ON g.week_id = w.id
        WHERE (g.spread IS NULL OR g.favorite_team IS NULL)
        AND w.season_year = ?
        ORDER BY w.week_number DESC
      `, [targetYear]);
    }
    
    if (games.length === 0) {
      return res.json({
        message: 'No games found that need spreads',
        updated: 0
      });
    }
    
    console.log(`Found ${games.length} games that need spreads`);
    
    // Scrape spreads from multiple sources
    const scrapedSpreads = await scrapeAllSpreads();
    
    if (scrapedSpreads.length === 0) {
      return res.json({
        message: 'No spreads found via scraping',
        updated: 0,
        sources: ['espn', 'sports-reference', 'vegas-insider']
      });
    }
    
    // Match and update spreads
    const gamesWithSpreads = matchSpreadToGames(games, scrapedSpreads);
    
    let updatedCount = 0;
    for (const game of gamesWithSpreads) {
      if (game.spread && game.favorite_team) {
        try {
          await runQuery(`
            UPDATE games 
            SET spread = ?, favorite_team = ? 
            WHERE id = ?
          `, [game.spread, game.favorite_team, game.id]);
          updatedCount++;
        } catch (error) {
          console.warn(`Error updating spread for game ${game.id}:`, error);
        }
      }
    }
    
    res.json({
      message: `Updated spreads for ${updatedCount} games`,
      totalGames: games.length,
      spreadsFound: scrapedSpreads.length,
      updated: updatedCount,
      sources: ['espn', 'sports-reference', 'vegas-insider'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Error in scrape-spreads endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to scrape spreads',
      details: error.message 
    });
  }
});

// Manual active week check endpoint
router.post('/ensure-active-week', async (req, res) => {
  try {
    console.log('🔄 Manual active week check triggered');
    
    // Import the ensureActiveWeekExists function (we need to make it available)
    const { ensureActiveWeekExists } = await import('../services/scheduler');
    await ensureActiveWeekExists(2025);
    
    // Get current active week to confirm
    const activeWeek = await getQuery<any>(
      'SELECT * FROM weeks WHERE is_active = 1 AND season_year = 2025'
    );
    
    res.json({
      success: true,
      message: 'Active week check completed',
      active_week: activeWeek || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in manual active week check:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to ensure active week',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;