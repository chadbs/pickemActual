import cron from 'node-cron';
import { getTopGamesForWeek, getGameScores, isFavoriteTeam } from './cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from './oddsApi';
import { runQuery, allQuery, getQuery } from '../database/database';
import { Week, Game } from '../../../shared/types';

// Get current college football week based on date
const getCurrentWeek = (): { year: number; week: number } => {
  const now = new Date();
  let year = now.getFullYear();
  
  // Use 2025 season data for the current season
  year = 2025;
  
  // College football 2025 schedule:
  // Week 0: August 24-27 (completed)
  // Week 1: August 28 - September 3 (current week)
  // Week 2: September 4-10, etc.
  
  const currentDate = now.getDate();
  const currentMonth = now.getMonth(); // 0-indexed (7 = August)
  
  let week = 1; // Default to Week 1
  
  // Week 1 starts August 28th, so if we're August 27 or earlier, it's still Week 0 (but we show Week 1)
  if (currentMonth === 7) { // August
    if (currentDate >= 28) {
      week = 1; // Week 1 starts August 28
    } else {
      week = 1; // Show Week 1 even if Week 0 just finished
    }
  } else if (currentMonth >= 8) { // September or later
    // Calculate weeks since August 28
    const week1Start = new Date(year, 7, 28); // August 28th
    const weeksSinceWeek1 = Math.floor((now.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    week = Math.max(1, Math.min(15, weeksSinceWeek1 + 1));
  }
  
  console.log(`Current date: ${now.toDateString()}, Using year: ${year}, Calculated week: ${week}`);
  
  return { year, week };
};

// Create or update current week
const ensureCurrentWeek = async (): Promise<Week> => {
  const { year, week } = getCurrentWeek();
  
  // Check if week already exists
  const existingWeek = await getQuery<Week>(
    'SELECT * FROM weeks WHERE week_number = ? AND season_year = ?',
    [week, year]
  );
  
  if (existingWeek) {
    return existingWeek;
  }
  
  // Calculate deadline (Saturday 8 PM of game week)
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + (6 - deadline.getDay())); // Next Saturday
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
  
  console.log(`Created new week: ${year} Week ${week}`);
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
    
    // Fetch games from CFBD API
    const cfbdGames = await getTopGamesForWeek(year, week);
    
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
    
    const gamesWithSpreads = gamesWithOdds.filter(g => g.spread);
    console.log(`Successfully matched spreads for ${gamesWithSpreads.length} out of ${gamesWithOdds.length} games`);
    
    // Filter out games with invalid data
    const validGames = gamesWithOdds.filter(game => {
      return game.home_team && 
             game.away_team && 
             (game.start_date || game.startDate) &&
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
    
    const { year, week } = getCurrentWeek();
    
    // Get completed games from CFBD API
    const completedGames = await getGameScores(year, week);
    
    for (const game of completedGames) {
      // Find corresponding game in our database
      const dbGame = await getQuery<Game>(
        'SELECT * FROM games WHERE external_game_id = ? OR (home_team = ? AND away_team = ?)',
        [game.id?.toString(), game.home_team, game.away_team]
      );
      
      if (dbGame) {
        // Calculate spread winner
        let spreadWinner: string | null = null;
        if (game.home_points !== undefined && game.away_points !== undefined && dbGame.spread) {
          const homeScore = game.home_points;
          const awayScore = game.away_points;
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
          [game.home_points || null, game.away_points || null, spreadWinner, dbGame.id]
        );
        
        console.log(`Updated score for ${game.home_team} vs ${game.away_team}`);
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

// Start all scheduled tasks
export const startScheduler = (): void => {
  console.log('Starting CFB Pick\'em scheduler...');
  
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
  
  // Daily maintenance at 2 AM (clean up, calculate standings)
  cron.schedule('0 2 * * *', () => {
    console.log('Running daily maintenance...');
    updateGameScores();
  });
  
  console.log('✅ Scheduler tasks registered');
  
  // Run initial fetch on startup if no games exist
  setTimeout(async () => {
    try {
      const gameCount = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM games');
      if (!gameCount || gameCount.count === 0) {
        console.log('No games found, running initial fetch...');
        await fetchWeeklyGames();
      }
    } catch (error) {
      console.error('Error in initial game check:', error);
    }
  }, 5000); // Wait 5 seconds after startup
};