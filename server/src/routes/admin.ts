import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';
import { fetchWeeklyGames, updateGameScores, fetchAllSeasonGames } from '../services/scheduler';
import { getTopGamesForWeek } from '../services/cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames, checkAPIUsage } from '../services/oddsApi';

const router = express.Router();

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getQuery<any>(
      `SELECT 
         (SELECT COUNT(*) FROM users) as total_users,
         (SELECT COUNT(*) FROM weeks) as total_weeks,
         (SELECT COUNT(*) FROM games) as total_games,
         (SELECT COUNT(*) FROM picks) as total_picks,
         (SELECT COUNT(*) FROM games WHERE status = 'completed') as completed_games,
         (SELECT COUNT(*) FROM weeks WHERE is_active = 1) as active_weeks`
    );
    
    // Get current week info
    const currentWeek = await getQuery<any>(
      `SELECT w.*, COUNT(g.id) as game_count, COUNT(p.id) as pick_count
       FROM weeks w
       LEFT JOIN games g ON w.id = g.week_id
       LEFT JOIN picks p ON g.id = p.game_id
       WHERE w.is_active = 1
       GROUP BY w.id`
    );
    
    // Get recent activity
    const recentActivity = await allQuery<any>(
      `SELECT 'pick' as type, u.name, p.created_at, g.home_team, g.away_team, p.selected_team
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       ORDER BY p.created_at DESC
       LIMIT 10`
    );
    
    res.json({
      stats,
      current_week: currentWeek,
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard' });
  }
});

// Manually trigger game fetch for current week
router.post('/fetch-games', async (req, res) => {
  try {
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
    
    let weekData;
    if (week_id) {
      weekData = await getQuery<any>('SELECT * FROM weeks WHERE id = ?', [week_id]);
    } else {
      weekData = await getQuery<any>('SELECT * FROM weeks WHERE week_number = ? AND season_year = ?', [week_number, year]);
    }
    
    if (!weekData) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    console.log(`🏈 ADMIN: Fetching games for Week ${week_number}, ${year}...`);
    
    // Check if we already have games for this week
    const existingGames = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [weekData.id]);
    
    // Fetch games from CFBD API for the specified week
    const cfbdGames = await getTopGamesForWeek(year, week_number);
    
    // Fetch odds data
    let oddsData: any[] = [];
    try {
      const rawOdds = await getNCAAFootballOdds();
      const parsedOdds = parseOddsData(rawOdds);
      oddsData = parsedOdds;
      console.log(`Fetched odds for ${oddsData.length} games`);
    } catch (error) {
      console.warn('Failed to fetch odds, continuing without spreads:', error);
    }
    
    // Match odds to games
    const gamesWithOdds = matchOddsToGames(cfbdGames, oddsData);
    
    // Select top 8 games (prioritize favorite teams and ranked matchups)
    const selectedGames = gamesWithOdds.slice(0, 8);
    
    // Clear existing games for this week first
    if (existingGames.length > 0) {
      await runQuery('DELETE FROM games WHERE week_id = ?', [weekData.id]);
      console.log(`Cleared ${existingGames.length} existing games for Week ${week_number}`);
    }
    
    // Store games in database
    const createdGames = [];
    for (const game of selectedGames) {
      const isFavoriteGame = [game.home_team, game.away_team].some(team =>
        ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'].some(fav =>
          team.toLowerCase().includes(fav.toLowerCase())
        )
      );
      
      const result = await runQuery(
        `INSERT INTO games 
         (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
          start_time, status, is_favorite_team_game)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          weekData.id,
          game.id?.toString() || null,
          game.home_team,
          game.away_team,
          game.spread || null,
          game.favorite_team || null,
          game.start_date || new Date().toISOString(),
          'scheduled',
          isFavoriteGame
        ]
      );
      
      createdGames.push({
        id: result.lastID,
        ...game
      });
    }
    
    console.log(`✅ Successfully stored ${createdGames.length} games for Week ${week_number}, ${year}`);
    
    res.json({ 
      message: `Successfully fetched ${createdGames.length} games for Week ${week_number}, ${year}`,
      games_created: createdGames.length,
      week_info: { week_number, year, week_id: weekData.id }
    });
  } catch (error) {
    console.error('Error fetching games for week:', error);
    res.status(500).json({ error: 'Failed to fetch games for week' });
  }
});

// Fetch all season games (Weeks 1-12)
router.post('/fetch-all-games', async (req, res) => {
  try {
    await fetchAllSeasonGames();
    res.json({ message: 'All season games fetched successfully (Weeks 1-12)' });
  } catch (error) {
    console.error('Error fetching all season games:', error);
    res.status(500).json({ error: 'Failed to fetch all season games' });
  }
});

// Clean up old seasons
router.delete('/seasons/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);
    
    if (!yearNum || yearNum > 2025) {
      return res.status(400).json({ error: 'Invalid year' });
    }
    
    // Delete picks first (foreign key constraints)
    await runQuery(`DELETE FROM picks WHERE game_id IN (
      SELECT g.id FROM games g 
      JOIN weeks w ON g.week_id = w.id 
      WHERE w.season_year = ?
    )`, [yearNum]);
    
    // Delete weekly scores
    await runQuery(`DELETE FROM weekly_scores WHERE week_id IN (
      SELECT id FROM weeks WHERE season_year = ?
    )`, [yearNum]);
    
    // Delete season standings
    await runQuery('DELETE FROM season_standings WHERE season_year = ?', [yearNum]);
    
    // Delete games
    await runQuery(`DELETE FROM games WHERE week_id IN (
      SELECT id FROM weeks WHERE season_year = ?
    )`, [yearNum]);
    
    // Delete weeks
    await runQuery('DELETE FROM weeks WHERE season_year = ?', [yearNum]);
    
    res.json({ message: `Successfully deleted ${year} season data` });
  } catch (error) {
    console.error('Error deleting season:', error);
    res.status(500).json({ error: 'Failed to delete season data' });
  }
});

// Manually trigger score updates
router.post('/update-scores', async (req, res) => {
  try {
    await updateGameScores();
    res.json({ message: 'Scores updated successfully' });
  } catch (error) {
    console.error('Error manually updating scores:', error);
    res.status(500).json({ error: 'Failed to update scores' });
  }
});

// Fetch fresh spreads for current week games
router.post('/fetch-spreads', async (req, res) => {
  try {
    console.log('Manual spread fetch requested...');
    
    // Get current week games
    const currentWeek = await getQuery<any>('SELECT * FROM weeks WHERE is_active = 1 LIMIT 1');
    if (!currentWeek) {
      return res.status(404).json({ error: 'No active week found' });
    }
    
    const games = await allQuery<any>('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
    if (games.length === 0) {
      return res.status(404).json({ error: 'No games found for current week' });
    }
    
    console.log(`Found ${games.length} games for Week ${currentWeek.week_number}`);
    
    // Fetch fresh odds
    const rawOdds = await getNCAAFootballOdds();
    console.log(`Fetched ${rawOdds.length} odds from API`);
    
    const parsedOdds = parseOddsData(rawOdds);
    console.log(`Parsed ${parsedOdds.length} odds`);
    
    // Match odds to existing games
    const gamesWithOdds = matchOddsToGames(games, parsedOdds);
    let updatedCount = 0;
    
    // Update database with new spreads
    for (const game of gamesWithOdds) {
      console.log(`Checking game ${game.away_team} @ ${game.home_team}: spread=${game.spread}, favorite=${game.favorite_team}`);
      if (game.spread && game.favorite_team) {
        await runQuery(
          'UPDATE games SET spread = ?, favorite_team = ? WHERE id = ?',
          [game.spread, game.favorite_team, game.id]
        );
        updatedCount++;
        console.log(`✅ Updated spreads for ${game.away_team} @ ${game.home_team}: ${game.favorite_team} -${game.spread}`);
      } else {
        console.log(`❌ No spread data for ${game.away_team} @ ${game.home_team}`);
      }
    }
    
    res.json({ 
      message: `Successfully updated spreads for ${updatedCount} out of ${games.length} games`,
      updated: updatedCount,
      total: games.length
    });
  } catch (error) {
    console.error('Error fetching spreads:', error);
    res.status(500).json({ error: 'Failed to fetch spreads' });
  }
});

// Preview available games for a week
router.get('/preview-games/:year/:week', async (req, res) => {
  try {
    const { year, week } = req.params;
    
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
      games: gamesWithOdds.slice(0, 12), // Show top 12 options
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
    
    // Verify week exists
    const week = await getQuery<any>('SELECT * FROM weeks WHERE id = ?', [week_id]);
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // Clear existing games for this week to prevent duplicates
    await runQuery('DELETE FROM games WHERE week_id = ?', [week_id]);
    console.log(`Cleared existing games for Week ${week.week_number}`);
    
    // Try to fetch fresh odds for the selected games
    let gamesWithOdds = selected_games;
    try {
      console.log('Attempting to fetch fresh odds for selected games...');
      console.log('Sample selected game:', JSON.stringify(selected_games[0], null, 2));
      
      const rawOdds = await getNCAAFootballOdds();
      console.log(`Fetched ${rawOdds.length} odds from API`);
      if (rawOdds.length > 0) {
        console.log('Sample raw odds:', JSON.stringify(rawOdds[0], null, 2));
      }
      
      const parsedOdds = parseOddsData(rawOdds);
      console.log(`Parsed ${parsedOdds.length} odds`);
      if (parsedOdds.length > 0) {
        console.log('Sample parsed odds:', JSON.stringify(parsedOdds[0], null, 2));
      }
      
      gamesWithOdds = matchOddsToGames(selected_games, parsedOdds);
      console.log(`Successfully applied odds to ${gamesWithOdds.filter(g => g.spread).length} games`);
      
      // Log first game with/without spread for debugging
      if (gamesWithOdds.length > 0) {
        const firstGame = gamesWithOdds[0];
        console.log(`First matched game: ${firstGame.away_team} @ ${firstGame.home_team}, spread: ${firstGame.spread}, favorite: ${firstGame.favorite_team}`);
      }
    } catch (error) {
      console.warn('Could not fetch fresh odds for selected games:', error);
      console.log('Using existing spread data from preview (may be null)');
    }
    
    const createdGames = [];
    
    for (const game of gamesWithOdds.slice(0, 8)) { // Max 8 games
      const isFavoriteGame = [game.home_team, game.away_team].some(team =>
        ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'].some(fav =>
          team.toLowerCase().includes(fav.toLowerCase())
        )
      );
      
      const result = await runQuery(
        `INSERT INTO games 
         (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
          start_time, status, is_favorite_team_game)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          week_id,
          game.id?.toString() || null,
          game.home_team,
          game.away_team,
          game.spread || null,
          game.favorite_team || null,
          game.start_date || new Date().toISOString(),
          'scheduled',
          isFavoriteGame
        ]
      );
      
      const newGame = await getQuery<any>(
        'SELECT * FROM games WHERE id = ?',
        [result.lastID]
      );
      
      createdGames.push(newGame);
    }
    
    res.json({
      message: `Created ${createdGames.length} games`,
      games: createdGames
    });
  } catch (error) {
    console.error('Error creating games:', error);
    res.status(500).json({ error: 'Failed to create games' });
  }
});

// Recalculate all scores and standings
router.post('/recalculate', async (req, res) => {
  try {
    // Recalculate weekly scores
    const weeks = await allQuery<any>('SELECT * FROM weeks ORDER BY season_year, week_number');
    
    for (const week of weeks) {
      const users = await allQuery<any>('SELECT * FROM users');
      
      for (const user of users) {
        const userPicks = await allQuery<any>(
          `SELECT p.*, g.status, g.spread_winner 
           FROM picks p 
           JOIN games g ON p.game_id = g.id 
           WHERE p.user_id = ? AND g.week_id = ?`,
          [user.id, week.id]
        );
        
        const completedPicks = userPicks.filter(p => p.status === 'completed' && p.spread_winner !== null);
        const correctPicks = completedPicks.filter(p => p.selected_team === p.spread_winner).length;
        const totalPicks = completedPicks.length;
        const percentage = totalPicks > 0 ? (correctPicks / totalPicks) * 100 : 0;
        
        // Update pick correctness
        for (const pick of userPicks) {
          if (pick.status === 'completed' && pick.spread_winner !== null) {
            const isCorrect = pick.selected_team === pick.spread_winner;
            await runQuery('UPDATE picks SET is_correct = ? WHERE id = ?', [isCorrect, pick.id]);
          }
        }
        
        // Update weekly score
        if (totalPicks > 0) {
          await runQuery(
            `INSERT OR REPLACE INTO weekly_scores 
             (user_id, week_id, correct_picks, total_picks, percentage)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, week.id, correctPicks, totalPicks, percentage]
          );
        }
      }
    }
    
    // Recalculate season standings
    const seasons = await allQuery<any>('SELECT DISTINCT season_year FROM weeks ORDER BY season_year');
    
    for (const season of seasons) {
      const users = await allQuery<any>('SELECT * FROM users');
      
      for (const user of users) {
        const seasonStats = await getQuery<any>(
          `SELECT 
             SUM(ws.correct_picks) as total_correct,
             SUM(ws.total_picks) as total_picks
           FROM weekly_scores ws
           JOIN weeks w ON ws.week_id = w.id
           WHERE ws.user_id = ? AND w.season_year = ?`,
          [user.id, season.season_year]
        );
        
        if (seasonStats && seasonStats.total_picks > 0) {
          const seasonPercentage = (seasonStats.total_correct / seasonStats.total_picks) * 100;
          
          await runQuery(
            `INSERT OR REPLACE INTO season_standings 
             (user_id, season_year, total_correct, total_picks, season_percentage)
             VALUES (?, ?, ?, ?, ?)`,
            [user.id, season.season_year, seasonStats.total_correct, seasonStats.total_picks, seasonPercentage]
          );
        }
      }
    }
    
    res.json({ message: 'All scores and standings recalculated successfully' });
  } catch (error) {
    console.error('Error recalculating scores:', error);
    res.status(500).json({ error: 'Failed to recalculate scores' });
  }
});

// Get API usage stats
router.get('/api-usage', async (req, res) => {
  try {
    const oddsUsage = await checkAPIUsage();
    
    res.json({
      odds_api: {
        remaining: oddsUsage.remaining,
        used: oddsUsage.used,
        limit: 500 // Free tier limit
      },
      cfbd_api: {
        limit: 1000, // Free tier limit
        note: "CFBD usage tracking not implemented in API"
      }
    });
  } catch (error) {
    console.error('Error fetching API usage:', error);
    res.status(500).json({ error: 'Failed to fetch API usage' });
  }
});

// Create a full season of weeks (Weeks 1-15)
router.post('/create-season-weeks', async (req, res) => {
  try {
    const { year } = req.body;
    const seasonYear = year || new Date().getFullYear();
    
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
        weekStart.setDate(week1Start.getDate() + (weekNum - 1) * 7);
        
        // Deadline is Saturday 8 PM of that week
        const deadline = new Date(weekStart);
        deadline.setDate(weekStart.getDate() + (6 - weekStart.getDay())); // Go to Saturday
        deadline.setHours(20, 0, 0, 0); // 8 PM
        
        // Current week is active, future weeks are upcoming, past weeks are completed
        const now = new Date();
        let status = 'upcoming';
        let isActive = false;
        
        if (deadline < now) {
          status = 'completed';
        } else if (weekNum === getCurrentWeek().week && seasonYear === getCurrentWeek().year) {
          status = 'active';
          isActive = true;
        }
        
        const result = await runQuery(
          'INSERT INTO weeks (week_number, season_year, deadline, is_active, status) VALUES (?, ?, ?, ?, ?)',
          [weekNum, seasonYear, deadline.toISOString(), isActive, status]
        );
        
        createdWeeks.push({
          id: result.lastID,
          week_number: weekNum,
          season_year: seasonYear,
          deadline: deadline.toISOString(),
          is_active: isActive,
          status
        });
      }
    }
    
    console.log(`✅ Created ${createdWeeks.length} weeks for ${seasonYear} season`);
    
    res.json({ 
      message: `Created ${createdWeeks.length} weeks for ${seasonYear} season`,
      weeks: createdWeeks,
      season_year: seasonYear
    });
  } catch (error) {
    console.error('Error creating season weeks:', error);
    res.status(500).json({ error: 'Failed to create season weeks' });
  }
});

// Get current week calculation (helper function)
const getCurrentWeek = () => {
  const now = new Date();
  const year = now.getFullYear();
  const currentDate = now.getDate();
  const currentMonth = now.getMonth();
  
  let week = 1;
  
  if (currentMonth === 7) { // August
    week = currentDate >= 28 ? 1 : 1;
  } else if (currentMonth >= 8) { // September or later
    const week1Start = new Date(year, 7, 28);
    const weeksSinceWeek1 = Math.floor((now.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    week = Math.max(1, Math.min(15, weeksSinceWeek1 + 1));
  }
  
  return { year, week };
};

// Reset app - clear all user data
router.post('/reset-app', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_ALL_DATA') {
      return res.status(400).json({ error: 'Must provide confirmation string "RESET_ALL_DATA"' });
    }
    
    console.log('🔥 ADMIN: Resetting all user data...');
    
    // Clear all user data (keep games and weeks structure)
    await runQuery('DELETE FROM picks');
    await runQuery('DELETE FROM weekly_scores');
    await runQuery('DELETE FROM season_standings');
    await runQuery('DELETE FROM users');
    
    // Reset game completion status to allow fresh picks
    await runQuery('UPDATE games SET status = "scheduled", home_score = NULL, away_score = NULL, spread_winner = NULL');
    
    console.log('✅ All user data cleared successfully');
    
    res.json({ 
      message: 'App reset successfully - all users, picks, and scores cleared',
      warning: 'Games and weeks preserved but reset to scheduled status'
    });
  } catch (error) {
    console.error('Error resetting app:', error);
    res.status(500).json({ error: 'Failed to reset app data' });
  }
});

// Database maintenance
router.post('/maintenance', async (req, res) => {
  try {
    const { action } = req.body;
    
    switch (action) {
      case 'cleanup_old_data':
        // Remove data older than 2 years
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
        
        await runQuery('DELETE FROM picks WHERE game_id IN (SELECT g.id FROM games g JOIN weeks w ON g.week_id = w.id WHERE w.season_year < ?)', [cutoffDate.getFullYear()]);
        await runQuery('DELETE FROM weekly_scores WHERE week_id IN (SELECT id FROM weeks WHERE season_year < ?)', [cutoffDate.getFullYear()]);
        await runQuery('DELETE FROM games WHERE week_id IN (SELECT id FROM weeks WHERE season_year < ?)', [cutoffDate.getFullYear()]);
        await runQuery('DELETE FROM weeks WHERE season_year < ?', [cutoffDate.getFullYear()]);
        
        res.json({ message: 'Old data cleaned up successfully' });
        break;
        
      case 'reset_app':
        // Redirect to dedicated reset endpoint for safety
        return res.status(400).json({ error: 'Use /admin/reset-app endpoint for app reset' });
        
      case 'vacuum':
        await runQuery('VACUUM');
        res.json({ message: 'Database vacuumed successfully' });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid maintenance action' });
    }
  } catch (error) {
    console.error('Error performing maintenance:', error);
    res.status(500).json({ error: 'Failed to perform maintenance' });
  }
});

// Export data
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { year } = req.query;
    
    let data;
    
    switch (type) {
      case 'picks':
        data = await allQuery<any>(
          `SELECT p.*, u.name as user_name, g.home_team, g.away_team, g.spread, w.week_number, w.season_year
           FROM picks p
           JOIN users u ON p.user_id = u.id
           JOIN games g ON p.game_id = g.id
           JOIN weeks w ON g.week_id = w.id
           ${year ? 'WHERE w.season_year = ?' : ''}
           ORDER BY w.season_year, w.week_number, g.start_time, u.name`,
          year ? [year] : []
        );
        break;
        
      case 'leaderboard':
        data = await allQuery<any>(
          `SELECT u.name, ws.*, w.week_number, w.season_year
           FROM users u
           JOIN weekly_scores ws ON u.id = ws.user_id
           JOIN weeks w ON ws.week_id = w.id
           ${year ? 'WHERE w.season_year = ?' : ''}
           ORDER BY w.season_year, w.week_number, ws.percentage DESC`,
          year ? [year] : []
        );
        break;
        
      case 'games':
        data = await allQuery<any>(
          `SELECT g.*, w.week_number, w.season_year
           FROM games g
           JOIN weeks w ON g.week_id = w.id
           ${year ? 'WHERE w.season_year = ?' : ''}
           ORDER BY w.season_year, w.week_number, g.start_time`,
          year ? [year] : []
        );
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    res.json({
      type,
      year: year || 'all',
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;