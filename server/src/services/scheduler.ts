import cron from 'node-cron';
import { getTopGamesForWeek, getGameScores, isFavoriteTeam } from './cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from './oddsApi';
import { fetchGamesWithFallback, fetchScoresWithFallback } from './hybridDataFetcher';
import { cleanupAPIUsageLogs } from './apiUsageMonitor';
import { runQuery, allQuery, getQuery } from '../database/database';
import { Week, Game } from '../../../shared/types';

// Get current college football week based on Monday-to-Sunday cycles
const getCurrentWeek = (): { year: number; week: number } => {
  const now = new Date();
  const year = 2025; // Current CFB season
  
  // College Football 2025 Season Week Schedule (Monday to Sunday cycles):
  // Week 1: Monday Aug 25 - Sunday Aug 31 (games primarily Thu-Sat Aug 28-30)
  // Week 2: Monday Sep 1 - Sunday Sep 7 (games primarily Thu-Sat Sep 4-6)
  // Week 3: Monday Sep 8 - Sunday Sep 14 (games primarily Thu-Sat Sep 11-13)
  // etc.
  
  // Season starts Monday August 25th, 2025
  const season2025Start = new Date(2025, 7, 25); // August 25, 2025 (Monday)
  
  // Before season starts, show Week 1
  if (now < season2025Start) {
    console.log(`Pre-season: ${now.toDateString()}, showing Week 1`);
    return { year, week: 1 };
  }
  
  // Calculate which week we're in based on Monday-to-Sunday cycles
  const timeDiff = now.getTime() - season2025Start.getTime();
  const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
  const weekNumber = Math.floor(daysDiff / 7) + 1; // +1 because week 1 starts on day 0
  
  // Cap at week 15 (end of regular season)
  const week = Math.max(1, Math.min(15, weekNumber));
  
  // Debug info
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  console.log(`Current: ${currentDay} ${now.toDateString()}, Season Week: ${week}, Days since season start: ${daysDiff}`);
  
  return { year, week };
};

// Update active week to match current calculated week
const updateActiveWeek = async (): Promise<void> => {
  const { year, week } = getCurrentWeek();
  
  try {
    // Set all weeks in the season as inactive first
    await runQuery('UPDATE weeks SET is_active = 0 WHERE season_year = ?', [year]);
    
    // Set the current week as active
    const result = await runQuery(
      'UPDATE weeks SET is_active = 1 WHERE week_number = ? AND season_year = ?',
      [week, year]
    );
    
    if (result.changes > 0) {
      console.log(`✅ Updated active week to Week ${week} of ${year}`);
    } else {
      console.log(`⚠️ Week ${week} of ${year} not found in database - may need to be created`);
      // Fallback: Ensure we always have an active week
      await ensureActiveWeekExists(year);
    }
  } catch (error) {
    console.error('Error updating active week:', error);
    // Fallback: Ensure we always have an active week even if update fails
    await ensureActiveWeekExists(year);
  }
};

// Fallback to ensure there's always an active week
export const ensureActiveWeekExists = async (year: number): Promise<void> => {
  try {
    // Check if any week is currently active
    const activeWeek = await getQuery<Week>(
      'SELECT * FROM weeks WHERE is_active = 1 AND season_year = ?',
      [year]
    );
    
    if (activeWeek) {
      console.log(`✅ Active week already exists: Week ${activeWeek.week_number}`);
      return;
    }
    
    console.log('⚠️ No active week found, setting fallback...');
    
    // Find the week closest to today's date
    const allWeeks = await allQuery<Week>(
      'SELECT * FROM weeks WHERE season_year = ? ORDER BY week_number ASC',
      [year]
    );
    
    if (allWeeks.length === 0) {
      console.log('No weeks exist in database - this should not happen');
      return;
    }
    
    // Calculate current week using simpler logic
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentDate = now.getDate();
    
    let fallbackWeek = 1;
    
    // Simple month-based fallback logic
    if (currentMonth === 7) { // August - Week 1-2
      fallbackWeek = currentDate > 31 ? 2 : 1;
    } else if (currentMonth === 8) { // September - Week 2-5  
      fallbackWeek = Math.min(5, Math.floor(currentDate / 7) + 2);
    } else if (currentMonth === 9) { // October - Week 6-9
      fallbackWeek = Math.min(9, Math.floor(currentDate / 7) + 6);
    } else if (currentMonth === 10) { // November - Week 10-13
      fallbackWeek = Math.min(13, Math.floor(currentDate / 7) + 10);
    } else if (currentMonth <= 6) { // Jan-July: Use Week 1 (pre-season)
      fallbackWeek = 1;
    } else { // December: Use Week 13
      fallbackWeek = 13;
    }
    
    // Make sure the week exists in database
    const targetWeek = allWeeks.find(w => w.week_number === fallbackWeek) || allWeeks[0];
    
    await runQuery('UPDATE weeks SET is_active = 1 WHERE id = ?', [targetWeek.id]);
    
    console.log(`✅ Set fallback active week: Week ${targetWeek.week_number} of ${year}`);
    
  } catch (error) {
    console.error('Error in ensureActiveWeekExists:', error);
  }
};

// Create or update current week
const ensureCurrentWeek = async (): Promise<Week> => {
  const { year, week } = getCurrentWeek();
  
  // First update which week should be active
  await updateActiveWeek();
  
  // Check if week already exists
  const existingWeek = await getQuery<Week>(
    'SELECT * FROM weeks WHERE week_number = ? AND season_year = ?',
    [week, year]
  );
  
  if (existingWeek) {
    return existingWeek;
  }
  
  // Calculate deadline (Saturday 8 PM of game week)
  const season2025Start = new Date(2025, 7, 25); // August 25, 2025 (Monday) 
  const weekStartDate = new Date(season2025Start.getTime() + ((week - 1) * 7 * 24 * 60 * 60 * 1000));
  const deadline = new Date(weekStartDate);
  deadline.setDate(deadline.getDate() + 6); // Sunday of that week
  deadline.setHours(20, 0, 0, 0); // 8 PM
  
  // Create new week
  const result = await runQuery(
    `INSERT INTO weeks (week_number, season_year, deadline, is_active, status)
     VALUES (?, ?, ?, ?, ?)`,
    [week, year, deadline.toISOString(), true, 'active']
  );
  
  const newWeek: Week = {
    id: result.lastID!,
    week_number: week,
    season_year: year,
    deadline: deadline.toISOString(),
    is_active: true,
    status: 'active'
  };
  
  console.log(`Created new week: ${year} Week ${week} (deadline: ${deadline.toDateString()})`);
  return newWeek;
};

// Fetch and store games for all weeks 1-12
export const fetchAllSeasonGames = async (): Promise<void> => {
  try {
    console.log('Starting full season games fetch (Weeks 1-12)...');
    const year = 2025;
    
    for (let week = 1; week <= 12; week++) {
      console.log(`\n=== Fetching Week ${week} ===`);
      
      // Ensure week exists in database
      let weekData = await getQuery<Week>(
        'SELECT * FROM weeks WHERE week_number = ? AND season_year = ?',
        [week, year]
      );
      
      if (!weekData) {
        // Calculate deadline (Saturday 8 PM of game week)
        const baseDate = new Date(year, 7, 24); // August 24th as season start
        const weekStartDate = new Date(baseDate.getTime() + ((week - 1) * 7 * 24 * 60 * 60 * 1000));
        const deadline = new Date(weekStartDate);
        deadline.setDate(deadline.getDate() + (6 - deadline.getDay())); // Next Saturday
        deadline.setHours(20, 0, 0, 0); // 8 PM
        
        const result = await runQuery(
          `INSERT INTO weeks (week_number, season_year, deadline, is_active, status)
           VALUES (?, ?, ?, ?, ?)`,
          [week, year, deadline.toISOString(), week === 1, 'active'] // Set Week 1 as active
        );
        
        weekData = {
          id: result.lastID!,
          week_number: week,
          season_year: year,
          deadline: deadline.toISOString(),
          is_active: week === 2,
          status: 'active'
        };
        
        console.log(`Created Week ${week}: ${year}`);
      }
      
      // Check if we already have games for this week
      const existingGames = await allQuery<Game>(
        'SELECT * FROM games WHERE week_id = ?',
        [weekData.id]
      );
      
      if (existingGames.length >= 8) {
        console.log(`Week ${week} already has ${existingGames.length} games, skipping`);
        continue;
      }
      
      // Clear existing games if any
      if (existingGames.length > 0) {
        await runQuery('DELETE FROM games WHERE week_id = ?', [weekData.id]);
        console.log(`Cleared ${existingGames.length} existing games for Week ${week}`);
      }
      
      try {
        // Fetch games from CFBD API
        const cfbdGames = await getTopGamesForWeek(year, week);
        
        if (cfbdGames.length === 0) {
          console.log(`No games found for Week ${week}, skipping`);
          continue;
        }
        
        // Fetch odds data
        let oddsData: any[] = [];
        try {
          const rawOdds = await getNCAAFootballOdds();
          const parsedOdds = parseOddsData(rawOdds);
          oddsData = parsedOdds;
          console.log(`Fetched odds for ${oddsData.length} games for Week ${week}`);
        } catch (error) {
          console.warn(`Failed to fetch odds for Week ${week}:`, error);
        }
        
        // Match odds to games
        const gamesWithOdds = matchOddsToGames(cfbdGames, oddsData);
        
        const gamesWithSpreads = gamesWithOdds.filter(g => g.spread);
        console.log(`Successfully matched spreads for ${gamesWithSpreads.length} out of ${gamesWithOdds.length} games for Week ${week}`);
        
        // Select top 8 games
        const selectedGames = gamesWithOdds.slice(0, 8);
        
        // Store games in database
        for (const game of selectedGames) {
          const isFavoriteGame = [game.home_team, game.away_team].some(team =>
            team && isFavoriteTeam(team)
          );
          
          await runQuery(
            `INSERT OR REPLACE INTO games 
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
        }
        
        console.log(`✅ Successfully stored ${selectedGames.length} games for Week ${week}`);
        
      } catch (error) {
        console.error(`Error fetching games for Week ${week}:`, error);
        continue;
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🏈 Full season games fetch completed!');
    
  } catch (error) {
    console.error('Error in fetchAllSeasonGames:', error);
  }
};

// Fetch and store games for current week
export const fetchWeeklyGames = async (forceRefresh: boolean = false): Promise<void> => {
  try {
    console.log('Starting weekly games fetch...');
    
    const currentWeek = await ensureCurrentWeek();
    const { year, week } = getCurrentWeek();
    
    // Check if we already have games for this week
    const existingGames = await allQuery<Game>(
      'SELECT * FROM games WHERE week_id = ?',
      [currentWeek.id]
    );
    
    if (existingGames.length >= 8 && !forceRefresh) {
      console.log(`Week ${week} already has ${existingGames.length} games, skipping fetch`);
      return;
    }
    
    if (forceRefresh && existingGames.length > 0) {
      console.log(`Force refresh requested, clearing ${existingGames.length} existing games for Week ${week}`);
      await runQuery('DELETE FROM games WHERE week_id = ?', [currentWeek.id]);
    }
    
    // Use hybrid fetcher (API + fallback)
    const gamesWithOdds = await fetchGamesWithFallback(year, week);
    
    const gamesWithSpreads = gamesWithOdds.filter(g => g.spread);
    console.log(`Successfully matched spreads for ${gamesWithSpreads.length} out of ${gamesWithOdds.length} games`);
    
    // Filter out games with invalid data
    const validGames = gamesWithOdds.filter(game => {
      return game.home_team && 
             game.away_team && 
             (game.start_date || (game as any).startDate) &&
             typeof game.home_team === 'string' && 
             typeof game.away_team === 'string';
    });
    
    // Select top 8 games (prioritize favorite teams and ranked matchups)
    const selectedGames = validGames.slice(0, 8);
    
    // Store games in database
    for (const game of selectedGames) {
      const isFavoriteGame = [game.home_team, game.away_team].some(team =>
        team && isFavoriteTeam(team)
      );
      
      await runQuery(
        `INSERT OR REPLACE INTO games 
         (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
          start_time, status, is_favorite_team_game)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          currentWeek.id,
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
    }
    
    console.log(`Successfully stored ${selectedGames.length} games for Week ${week}`);
    
  } catch (error) {
    console.error('Error in fetchWeeklyGames:', error);
  }
};

// Update game scores
export const updateGameScores = async (): Promise<void> => {
  try {
    console.log('Starting score updates...');
    
    const { year } = getCurrentWeek();
    
    // Check multiple weeks for completed games (current and recent weeks)
    let allCompletedGames: any[] = [];
    for (let weekOffset = 0; weekOffset <= 4; weekOffset++) {
      try {
        const targetWeek = Math.max(1, getCurrentWeek().week - weekOffset);
        console.log(`Checking Week ${targetWeek} for completed games...`);
        const weekCompletedGames = await getGameScores(year, targetWeek);
        allCompletedGames = allCompletedGames.concat(weekCompletedGames);
        console.log(`Found ${weekCompletedGames.length} completed games in Week ${targetWeek}`);
      } catch (error) {
        console.warn(`Could not fetch scores for week ${getCurrentWeek().week - weekOffset}:`, error);
      }
    }
    
    console.log(`Processing ${allCompletedGames.length} total completed games across all weeks`);
    
    for (const game of allCompletedGames) {
      // Find corresponding game in our database with flexible team name matching
      const dbGame = await getQuery<Game>(
        `SELECT * FROM games WHERE external_game_id = ? 
         OR (LOWER(home_team) LIKE ? AND LOWER(away_team) LIKE ?)
         OR (LOWER(away_team) LIKE ? AND LOWER(home_team) LIKE ?)`,
        [
          game.id?.toString(), 
          `%${game.homeTeam?.toLowerCase().split(' ')[0]}%`,
          `%${game.awayTeam?.toLowerCase().split(' ')[0]}%`,
          `%${game.homeTeam?.toLowerCase().split(' ')[0]}%`, 
          `%${game.awayTeam?.toLowerCase().split(' ')[0]}%`
        ]
      );
      
      if (dbGame) {
        console.log(`Found database match for ${game.homeTeam} vs ${game.awayTeam} (Score: ${game.homePoints}-${game.awayPoints})`);
        
        // Calculate spread winner
        let spreadWinner: string | null = null;
        if (game.homePoints !== undefined && game.awayPoints !== undefined && dbGame.spread) {
          const homeScore = game.homePoints;
          const awayScore = game.awayPoints;
          const spread = dbGame.spread;
          const favorite = dbGame.favorite_team;
          
          if (favorite === dbGame.home_team) {
            // Home team is favorite, they need to win by more than spread
            spreadWinner = (homeScore - awayScore > spread) ? dbGame.home_team : dbGame.away_team;
          } else {
            // Away team is favorite, they need to win by more than spread
            spreadWinner = (awayScore - homeScore > spread) ? dbGame.away_team : dbGame.home_team;
          }
        }
        
        // Update game with final score
        await runQuery(
          `UPDATE games 
           SET home_score = ?, away_score = ?, status = 'completed', spread_winner = ?
           WHERE id = ?`,
          [game.homePoints || null, game.awayPoints || null, spreadWinner, dbGame.id]
        );
        
        console.log(`✅ Updated score for ${game.homeTeam} vs ${game.awayTeam}: ${game.homePoints}-${game.awayPoints}`);
      } else {
        console.log(`❌ No database match found for ${game.homeTeam} vs ${game.awayTeam}`);
      }
    }
    
    // Calculate pick results for completed games
    await calculatePickResults();
    
  } catch (error) {
    console.error('Error updating game scores:', error);
  }
};

// Calculate pick results and update user scores
const calculatePickResults = async (): Promise<void> => {
  try {
    // Get all picks for completed games
    const picks = await allQuery<any>(
      `SELECT p.*, g.spread_winner, g.status 
       FROM picks p 
       JOIN games g ON p.game_id = g.id 
       WHERE g.status = 'completed' AND p.is_correct IS NULL`
    );
    
    // Update pick correctness
    for (const pick of picks) {
      const isCorrect = pick.selected_team === pick.spread_winner;
      await runQuery(
        'UPDATE picks SET is_correct = ? WHERE id = ?',
        [isCorrect, pick.id]
      );
    }
    
    // Update weekly scores
    const { week } = getCurrentWeek();
    const currentWeekData = await getQuery<Week>(
      'SELECT * FROM weeks WHERE week_number = ? AND season_year = ? AND is_active = 1',
      [week, new Date().getFullYear()]
    );
    
    if (currentWeekData) {
      const users = await allQuery<any>('SELECT * FROM users');
      
      for (const user of users) {
        const userPicks = await allQuery<any>(
          `SELECT p.*, g.status FROM picks p 
           JOIN games g ON p.game_id = g.id 
           WHERE p.user_id = ? AND g.week_id = ?`,
          [user.id, currentWeekData.id]
        );
        
        const completedPicks = userPicks.filter(p => p.status === 'completed');
        const correctPicks = completedPicks.filter(p => p.is_correct).length;
        const totalPicks = completedPicks.length;
        const percentage = totalPicks > 0 ? (correctPicks / totalPicks) * 100 : 0;
        
        await runQuery(
          `INSERT OR REPLACE INTO weekly_scores 
           (user_id, week_id, correct_picks, total_picks, percentage)
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, currentWeekData.id, correctPicks, totalPicks, percentage]
        );
      }
    }
    
    console.log('Pick results calculated and scores updated');
    
  } catch (error) {
    console.error('Error calculating pick results:', error);
  }
};

// Auto-lock spreads when first game starts
const autoLockSpreads = async (): Promise<void> => {
  try {
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
    
    for (const week of weeksToLock) {
      await runQuery('UPDATE weeks SET spreads_locked = 1 WHERE id = ?', [week.id]);
      console.log(`🔒 Auto-locked spreads for Week ${week.week_number} (first game started at ${week.earliest_game_time})`);
    }
    
    if (weeksToLock.length > 0) {
      console.log(`✅ Auto-locked spreads for ${weeksToLock.length} weeks`);
    }
  } catch (error) {
    console.error('Error in auto-lock spreads:', error);
  }
};

// Start all scheduled tasks
export const startScheduler = (): void => {
  console.log('Starting CFB Pick\'em scheduler...');
  
  // Update active week every Monday at 6 AM (start of new CFB week)
  cron.schedule('0 6 * * 1', () => {
    console.log('Monday: Updating active week...');
    updateActiveWeek();
  });
  
  // Fetch new games every Tuesday at 10 AM (prepare for upcoming week)
  cron.schedule('0 10 * * 2', () => {
    console.log('Running weekly games fetch...');
    fetchWeeklyGames();
  });
  
  // Update scores every 30 minutes during game times (Friday-Sunday)
  cron.schedule('*/30 * * * 5-0', () => {
    console.log('Checking for score updates...');
    updateGameScores();
  });
  
  // Update scores more frequently on Saturday (every 15 minutes)
  cron.schedule('*/15 * * * 6', () => {
    console.log('Saturday score update check...');
    updateGameScores();
  });
  
  // Check for spread locking every hour during game season (Thursday-Sunday)
  cron.schedule('0 * * * 4-0', () => {
    console.log('Checking for spread auto-lock...');
    autoLockSpreads();
  });
  
  // Daily maintenance at 2 AM (clean up, calculate standings, update active week)
  cron.schedule('0 2 * * *', () => {
    console.log('Running daily maintenance...');
    updateActiveWeek(); // Check active week daily
    updateGameScores();
  });
  
  // Ensure active week every 6 hours (safety net)
  cron.schedule('0 */6 * * *', () => {
    console.log('Safety check: Ensuring active week exists...');
    ensureActiveWeekExists(2025);
  });
  
  console.log('✅ Scheduler tasks registered');
  
  // Run initial checks on startup
  setTimeout(async () => {
    try {
      // CRITICAL: Ensure there's always an active week on startup
      console.log('🔄 Startup: Ensuring active week exists...');
      await ensureActiveWeekExists(2025);
      
      // Check if we need to fetch games
      const gameCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM games');
      if (!gameCount || gameCount.count === 0) {
        console.log('No games found, running initial fetch...');
        await fetchWeeklyGames();
      }
      
      console.log('🏈 Scheduler startup complete');
    } catch (error) {
      console.error('Error in scheduler startup:', error);
      // Even if other things fail, ensure we have an active week
      await ensureActiveWeekExists(2025);
    }
  }, 3000); // Wait 3 seconds after startup
};