"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = exports.updateGameScores = exports.fetchWeeklyGames = exports.fetchAllSeasonGames = exports.ensureActiveWeekExists = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const cfbDataApi_1 = require("./cfbDataApi");
const oddsApi_1 = require("./oddsApi");
const hybridDataFetcher_1 = require("./hybridDataFetcher");
const database_1 = require("../database/database");
// Get current college football week based on Monday-to-Sunday cycles
const getCurrentWeek = () => {
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
const updateActiveWeek = async () => {
    const { year, week } = getCurrentWeek();
    try {
        // Set all weeks in the season as inactive first
        await (0, database_1.runQuery)('UPDATE weeks SET is_active = 0 WHERE season_year = ?', [year]);
        // Set the current week as active
        const result = await (0, database_1.runQuery)('UPDATE weeks SET is_active = 1 WHERE week_number = ? AND season_year = ?', [week, year]);
        if (result.changes > 0) {
            console.log(`✅ Updated active week to Week ${week} of ${year}`);
        }
        else {
            console.log(`⚠️ Week ${week} of ${year} not found in database - may need to be created`);
            // Fallback: Ensure we always have an active week
            await (0, exports.ensureActiveWeekExists)(year);
        }
    }
    catch (error) {
        console.error('Error updating active week:', error);
        // Fallback: Ensure we always have an active week even if update fails
        await (0, exports.ensureActiveWeekExists)(year);
    }
};
// Fallback to ensure there's always an active week
const ensureActiveWeekExists = async (year) => {
    try {
        // Check if any week is currently active
        const activeWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE is_active = 1 AND season_year = ?', [year]);
        if (activeWeek) {
            console.log(`✅ Active week already exists: Week ${activeWeek.week_number}`);
            return;
        }
        console.log('⚠️ No active week found, setting fallback...');
        // Find the week closest to today's date
        const allWeeks = await (0, database_1.allQuery)('SELECT * FROM weeks WHERE season_year = ? ORDER BY week_number ASC', [year]);
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
        }
        else if (currentMonth === 8) { // September - Week 2-5  
            fallbackWeek = Math.min(5, Math.floor(currentDate / 7) + 2);
        }
        else if (currentMonth === 9) { // October - Week 6-9
            fallbackWeek = Math.min(9, Math.floor(currentDate / 7) + 6);
        }
        else if (currentMonth === 10) { // November - Week 10-13
            fallbackWeek = Math.min(13, Math.floor(currentDate / 7) + 10);
        }
        else if (currentMonth <= 6) { // Jan-July: Use Week 1 (pre-season)
            fallbackWeek = 1;
        }
        else { // December: Use Week 13
            fallbackWeek = 13;
        }
        // Make sure the week exists in database
        const targetWeek = allWeeks.find(w => w.week_number === fallbackWeek) || allWeeks[0];
        await (0, database_1.runQuery)('UPDATE weeks SET is_active = 1 WHERE id = ?', [targetWeek.id]);
        console.log(`✅ Set fallback active week: Week ${targetWeek.week_number} of ${year}`);
    }
    catch (error) {
        console.error('Error in ensureActiveWeekExists:', error);
    }
};
exports.ensureActiveWeekExists = ensureActiveWeekExists;
// Create or update current week
const ensureCurrentWeek = async () => {
    const { year, week } = getCurrentWeek();
    // First update which week should be active
    await updateActiveWeek();
    // Check if week already exists
    const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE week_number = ? AND season_year = ?', [week, year]);
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
    const result = await (0, database_1.runQuery)(`INSERT INTO weeks (week_number, season_year, deadline, is_active, status)
     VALUES (?, ?, ?, ?, ?)`, [week, year, deadline.toISOString(), true, 'active']);
    const newWeek = {
        id: result.lastID,
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
const fetchAllSeasonGames = async () => {
    try {
        console.log('Starting full season games fetch (Weeks 1-12)...');
        const year = 2025;
        for (let week = 1; week <= 12; week++) {
            console.log(`\n=== Fetching Week ${week} ===`);
            // Ensure week exists in database
            let weekData = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE week_number = ? AND season_year = ?', [week, year]);
            if (!weekData) {
                // Calculate deadline (Saturday 8 PM of game week)
                const baseDate = new Date(year, 7, 24); // August 24th as season start
                const weekStartDate = new Date(baseDate.getTime() + ((week - 1) * 7 * 24 * 60 * 60 * 1000));
                const deadline = new Date(weekStartDate);
                deadline.setDate(deadline.getDate() + (6 - deadline.getDay())); // Next Saturday
                deadline.setHours(20, 0, 0, 0); // 8 PM
                const result = await (0, database_1.runQuery)(`INSERT INTO weeks (week_number, season_year, deadline, is_active, status)
           VALUES (?, ?, ?, ?, ?)`, [week, year, deadline.toISOString(), week === 1, 'active'] // Set Week 1 as active
                );
                weekData = {
                    id: result.lastID,
                    week_number: week,
                    season_year: year,
                    deadline: deadline.toISOString(),
                    is_active: week === 2,
                    status: 'active'
                };
                console.log(`Created Week ${week}: ${year}`);
            }
            // Check if we already have games for this week
            const existingGames = await (0, database_1.allQuery)('SELECT * FROM games WHERE week_id = ?', [weekData.id]);
            if (existingGames.length >= 8) {
                console.log(`Week ${week} already has ${existingGames.length} games, skipping`);
                continue;
            }
            // Clear existing games if any
            if (existingGames.length > 0) {
                await (0, database_1.runQuery)('DELETE FROM games WHERE week_id = ?', [weekData.id]);
                console.log(`Cleared ${existingGames.length} existing games for Week ${week}`);
            }
            try {
                // Fetch games from CFBD API
                const cfbdGames = await (0, cfbDataApi_1.getTopGamesForWeek)(year, week);
                if (cfbdGames.length === 0) {
                    console.log(`No games found for Week ${week}, skipping`);
                    continue;
                }
                // Fetch odds data
                let oddsData = [];
                try {
                    const rawOdds = await (0, oddsApi_1.getNCAAFootballOdds)();
                    const parsedOdds = (0, oddsApi_1.parseOddsData)(rawOdds);
                    oddsData = parsedOdds;
                    console.log(`Fetched odds for ${oddsData.length} games for Week ${week}`);
                }
                catch (error) {
                    console.warn(`Failed to fetch odds for Week ${week}:`, error);
                }
                // Match odds to games
                const gamesWithOdds = (0, oddsApi_1.matchOddsToGames)(cfbdGames, oddsData);
                const gamesWithSpreads = gamesWithOdds.filter(g => g.spread);
                console.log(`Successfully matched spreads for ${gamesWithSpreads.length} out of ${gamesWithOdds.length} games for Week ${week}`);
                // Select top 8 games
                const selectedGames = gamesWithOdds.slice(0, 8);
                // Store games in database
                for (const game of selectedGames) {
                    const isFavoriteGame = [game.home_team, game.away_team].some(team => team && (0, cfbDataApi_1.isFavoriteTeam)(team));
                    await (0, database_1.runQuery)(`INSERT OR REPLACE INTO games 
             (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
              start_time, status, is_favorite_team_game)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        weekData.id,
                        game.id?.toString() || null,
                        game.home_team,
                        game.away_team,
                        game.spread || null,
                        game.favorite_team || null,
                        game.start_date || new Date().toISOString(),
                        'scheduled',
                        isFavoriteGame
                    ]);
                }
                console.log(`✅ Successfully stored ${selectedGames.length} games for Week ${week}`);
            }
            catch (error) {
                console.error(`Error fetching games for Week ${week}:`, error);
                continue;
            }
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n🏈 Full season games fetch completed!');
    }
    catch (error) {
        console.error('Error in fetchAllSeasonGames:', error);
    }
};
exports.fetchAllSeasonGames = fetchAllSeasonGames;
// Fetch and store games for current week
const fetchWeeklyGames = async (forceRefresh = false) => {
    try {
        console.log('Starting weekly games fetch...');
        const currentWeek = await ensureCurrentWeek();
        const { year, week } = getCurrentWeek();
        // Check if we already have games for this week
        const existingGames = await (0, database_1.allQuery)('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
        if (existingGames.length >= 8 && !forceRefresh) {
            console.log(`Week ${week} already has ${existingGames.length} games, skipping fetch`);
            return;
        }
        if (forceRefresh && existingGames.length > 0) {
            console.log(`Force refresh requested, clearing ${existingGames.length} existing games for Week ${week}`);
            await (0, database_1.runQuery)('DELETE FROM games WHERE week_id = ?', [currentWeek.id]);
        }
        // Use hybrid fetcher (API + fallback)
        const gamesWithOdds = await (0, hybridDataFetcher_1.fetchGamesWithFallback)(year, week);
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
            const isFavoriteGame = [game.home_team, game.away_team].some(team => team && (0, cfbDataApi_1.isFavoriteTeam)(team));
            await (0, database_1.runQuery)(`INSERT OR REPLACE INTO games 
         (week_id, external_game_id, home_team, away_team, spread, favorite_team, 
          start_time, status, is_favorite_team_game)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                currentWeek.id,
                game.id?.toString() || null,
                game.home_team,
                game.away_team,
                game.spread || null,
                game.favorite_team || null,
                game.start_date || new Date().toISOString(),
                'scheduled',
                isFavoriteGame
            ]);
        }
        console.log(`Successfully stored ${selectedGames.length} games for Week ${week}`);
    }
    catch (error) {
        console.error('Error in fetchWeeklyGames:', error);
    }
};
exports.fetchWeeklyGames = fetchWeeklyGames;
// Update game scores
const updateGameScores = async () => {
    try {
        console.log('Starting score updates...');
        const { year } = getCurrentWeek();
        // Check multiple weeks for completed games (current and recent weeks)
        let allCompletedGames = [];
        for (let weekOffset = 0; weekOffset <= 4; weekOffset++) {
            try {
                const targetWeek = Math.max(1, getCurrentWeek().week - weekOffset);
                console.log(`Checking Week ${targetWeek} for completed games...`);
                const weekCompletedGames = await (0, cfbDataApi_1.getGameScores)(year, targetWeek);
                allCompletedGames = allCompletedGames.concat(weekCompletedGames);
                console.log(`Found ${weekCompletedGames.length} completed games in Week ${targetWeek}`);
            }
            catch (error) {
                console.warn(`Could not fetch scores for week ${getCurrentWeek().week - weekOffset}:`, error);
            }
        }
        console.log(`Processing ${allCompletedGames.length} total completed games across all weeks`);
        for (const game of allCompletedGames) {
            // Find corresponding game in our database with flexible team name matching
            const dbGame = await (0, database_1.getQuery)(`SELECT * FROM games WHERE external_game_id = ? 
         OR (LOWER(home_team) LIKE ? AND LOWER(away_team) LIKE ?)
         OR (LOWER(away_team) LIKE ? AND LOWER(home_team) LIKE ?)`, [
                game.id?.toString(),
                `%${game.homeTeam?.toLowerCase().split(' ')[0]}%`,
                `%${game.awayTeam?.toLowerCase().split(' ')[0]}%`,
                `%${game.homeTeam?.toLowerCase().split(' ')[0]}%`,
                `%${game.awayTeam?.toLowerCase().split(' ')[0]}%`
            ]);
            if (dbGame) {
                console.log(`Found database match for ${game.homeTeam} vs ${game.awayTeam} (Score: ${game.homePoints}-${game.awayPoints})`);
                // Calculate spread winner
                let spreadWinner = null;
                if (game.homePoints !== undefined && game.awayPoints !== undefined && dbGame.spread) {
                    const homeScore = game.homePoints;
                    const awayScore = game.awayPoints;
                    const spread = dbGame.spread;
                    const favorite = dbGame.favorite_team;
                    if (favorite === dbGame.home_team) {
                        // Home team is favorite, they need to win by more than spread
                        spreadWinner = (homeScore - awayScore > spread) ? dbGame.home_team : dbGame.away_team;
                    }
                    else {
                        // Away team is favorite, they need to win by more than spread
                        spreadWinner = (awayScore - homeScore > spread) ? dbGame.away_team : dbGame.home_team;
                    }
                }
                // Update game with final score
                await (0, database_1.runQuery)(`UPDATE games 
           SET home_score = ?, away_score = ?, status = 'completed', spread_winner = ?
           WHERE id = ?`, [game.homePoints || null, game.awayPoints || null, spreadWinner, dbGame.id]);
                console.log(`✅ Updated score for ${game.homeTeam} vs ${game.awayTeam}: ${game.homePoints}-${game.awayPoints}`);
            }
            else {
                console.log(`❌ No database match found for ${game.homeTeam} vs ${game.awayTeam}`);
            }
        }
        // Calculate pick results for completed games
        await calculatePickResults();
    }
    catch (error) {
        console.error('Error updating game scores:', error);
    }
};
exports.updateGameScores = updateGameScores;
// Calculate pick results and update user scores
const calculatePickResults = async () => {
    try {
        // Get all picks for completed games
        const picks = await (0, database_1.allQuery)(`SELECT p.*, g.spread_winner, g.status 
       FROM picks p 
       JOIN games g ON p.game_id = g.id 
       WHERE g.status = 'completed' AND p.is_correct IS NULL`);
        // Update pick correctness
        for (const pick of picks) {
            const isCorrect = pick.selected_team === pick.spread_winner;
            await (0, database_1.runQuery)('UPDATE picks SET is_correct = ? WHERE id = ?', [isCorrect, pick.id]);
        }
        // Update weekly scores
        const { week } = getCurrentWeek();
        const currentWeekData = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE week_number = ? AND season_year = ? AND is_active = 1', [week, new Date().getFullYear()]);
        if (currentWeekData) {
            const users = await (0, database_1.allQuery)('SELECT * FROM users');
            for (const user of users) {
                const userPicks = await (0, database_1.allQuery)(`SELECT p.*, g.status FROM picks p 
           JOIN games g ON p.game_id = g.id 
           WHERE p.user_id = ? AND g.week_id = ?`, [user.id, currentWeekData.id]);
                const completedPicks = userPicks.filter(p => p.status === 'completed');
                const correctPicks = completedPicks.filter(p => p.is_correct).length;
                const totalPicks = completedPicks.length;
                const percentage = totalPicks > 0 ? (correctPicks / totalPicks) * 100 : 0;
                await (0, database_1.runQuery)(`INSERT OR REPLACE INTO weekly_scores 
           (user_id, week_id, correct_picks, total_picks, percentage)
           VALUES (?, ?, ?, ?, ?)`, [user.id, currentWeekData.id, correctPicks, totalPicks, percentage]);
            }
        }
        console.log('Pick results calculated and scores updated');
    }
    catch (error) {
        console.error('Error calculating pick results:', error);
    }
};
// Auto-lock spreads when first game starts
const autoLockSpreads = async () => {
    try {
        const now = new Date();
        // Find weeks where the earliest game has started but spreads aren't locked yet
        const weeksToLock = await (0, database_1.allQuery)(`SELECT DISTINCT w.id, w.week_number, w.season_year, 
              MIN(g.start_time) as earliest_game_time
       FROM weeks w
       JOIN games g ON w.id = g.week_id
       WHERE w.spreads_locked = 0
         AND datetime(g.start_time) <= datetime('now')
       GROUP BY w.id, w.week_number, w.season_year
       HAVING datetime(earliest_game_time) <= datetime('now')`);
        for (const week of weeksToLock) {
            await (0, database_1.runQuery)('UPDATE weeks SET spreads_locked = 1 WHERE id = ?', [week.id]);
            console.log(`🔒 Auto-locked spreads for Week ${week.week_number} (first game started at ${week.earliest_game_time})`);
        }
        if (weeksToLock.length > 0) {
            console.log(`✅ Auto-locked spreads for ${weeksToLock.length} weeks`);
        }
    }
    catch (error) {
        console.error('Error in auto-lock spreads:', error);
    }
};
// Start all scheduled tasks
const startScheduler = () => {
    console.log('Starting CFB Pick\'em scheduler...');
    // Update active week every Monday at 6 AM (start of new CFB week)
    node_cron_1.default.schedule('0 6 * * 1', () => {
        console.log('Monday: Updating active week...');
        updateActiveWeek();
    });
    // Fetch new games every Tuesday at 10 AM (prepare for upcoming week)
    node_cron_1.default.schedule('0 10 * * 2', () => {
        console.log('Running weekly games fetch...');
        (0, exports.fetchWeeklyGames)();
    });
    // Update scores every 30 minutes during game times (Friday-Sunday)
    node_cron_1.default.schedule('*/30 * * * 5-0', () => {
        console.log('Checking for score updates...');
        (0, exports.updateGameScores)();
    });
    // Update scores more frequently on Saturday (every 15 minutes)
    node_cron_1.default.schedule('*/15 * * * 6', () => {
        console.log('Saturday score update check...');
        (0, exports.updateGameScores)();
    });
    // Check for spread locking every hour during game season (Thursday-Sunday)
    node_cron_1.default.schedule('0 * * * 4-0', () => {
        console.log('Checking for spread auto-lock...');
        autoLockSpreads();
    });
    // Daily maintenance at 2 AM (clean up, calculate standings, update active week)
    node_cron_1.default.schedule('0 2 * * *', () => {
        console.log('Running daily maintenance...');
        updateActiveWeek(); // Check active week daily
        (0, exports.updateGameScores)();
    });
    // Ensure active week every 6 hours (safety net)
    node_cron_1.default.schedule('0 */6 * * *', () => {
        console.log('Safety check: Ensuring active week exists...');
        (0, exports.ensureActiveWeekExists)(2025);
    });
    console.log('✅ Scheduler tasks registered');
    // Run initial checks on startup
    setTimeout(async () => {
        try {
            // CRITICAL: Ensure there's always an active week on startup
            console.log('🔄 Startup: Ensuring active week exists...');
            await (0, exports.ensureActiveWeekExists)(2025);
            // Check if we need to fetch games
            const gameCount = await (0, database_1.getQuery)('SELECT COUNT(*) as count FROM games');
            if (!gameCount || gameCount.count === 0) {
                console.log('No games found, running initial fetch...');
                await (0, exports.fetchWeeklyGames)();
            }
            console.log('🏈 Scheduler startup complete');
        }
        catch (error) {
            console.error('Error in scheduler startup:', error);
            // Even if other things fail, ensure we have an active week
            await (0, exports.ensureActiveWeekExists)(2025);
        }
    }, 3000); // Wait 3 seconds after startup
};
exports.startScheduler = startScheduler;
//# sourceMappingURL=scheduler.js.map