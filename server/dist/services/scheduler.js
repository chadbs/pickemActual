"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = exports.updateGameScores = exports.fetchWeeklyGames = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const cfbDataApi_1 = require("./cfbDataApi");
const oddsApi_1 = require("./oddsApi");
const database_1 = require("../database/database");
// Get current college football week based on date
const getCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    // College football typically starts in late August/early September
    // Week 1 is usually the first full weekend of September
    const seasonStart = new Date(year, 7, 25); // August 25th
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    let week = Math.max(1, Math.min(15, weeksSinceStart + 1));
    // Adjust for current season (if it's before August, use previous year)
    let seasonYear = year;
    if (now.getMonth() < 7) { // Before August
        seasonYear = year - 1;
        week = 15; // End of season
    }
    return { year: seasonYear, week };
};
// Create or update current week
const ensureCurrentWeek = async () => {
    const { year, week } = getCurrentWeek();
    // Check if week already exists
    const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE week_number = ? AND season_year = ?', [week, year]);
    if (existingWeek) {
        return existingWeek;
    }
    // Calculate deadline (Saturday 8 PM of game week)
    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + (6 - deadline.getDay())); // Next Saturday
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
    console.log(`Created new week: ${year} Week ${week}`);
    return newWeek;
};
// Fetch and store games for current week
const fetchWeeklyGames = async () => {
    try {
        console.log('Starting weekly games fetch...');
        const currentWeek = await ensureCurrentWeek();
        const { year, week } = getCurrentWeek();
        // Check if we already have games for this week
        const existingGames = await (0, database_1.allQuery)('SELECT * FROM games WHERE week_id = ?', [currentWeek.id]);
        if (existingGames.length >= 8) {
            console.log(`Week ${week} already has ${existingGames.length} games, skipping fetch`);
            return;
        }
        // Fetch games from CFBD API
        const cfbdGames = await (0, cfbDataApi_1.getTopGamesForWeek)(year, week);
        // Fetch odds data
        let oddsData = [];
        try {
            const rawOdds = await (0, oddsApi_1.getNCAAFootballOdds)();
            const parsedOdds = (0, oddsApi_1.parseOddsData)(rawOdds);
            oddsData = parsedOdds;
            console.log(`Fetched odds for ${oddsData.length} games`);
        }
        catch (error) {
            console.warn('Failed to fetch odds, continuing without spreads:', error);
        }
        // Match odds to games
        const gamesWithOdds = (0, oddsApi_1.matchOddsToGames)(cfbdGames, oddsData);
        // Select top 8 games (prioritize favorite teams and ranked matchups)
        const selectedGames = gamesWithOdds.slice(0, 8);
        // Store games in database
        for (const game of selectedGames) {
            const isFavoriteGame = [game.home_team, game.away_team].some(team => ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'].some(fav => team.toLowerCase().includes(fav.toLowerCase())));
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
        const { year, week } = getCurrentWeek();
        // Get completed games from CFBD API
        const completedGames = await (0, cfbDataApi_1.getGameScores)(year, week);
        for (const game of completedGames) {
            // Find corresponding game in our database
            const dbGame = await (0, database_1.getQuery)('SELECT * FROM games WHERE external_game_id = ? OR (home_team = ? AND away_team = ?)', [game.id?.toString(), game.home_team, game.away_team]);
            if (dbGame) {
                // Calculate spread winner
                let spreadWinner = null;
                if (game.home_points !== undefined && game.away_points !== undefined && dbGame.spread) {
                    const homeScore = game.home_points;
                    const awayScore = game.away_points;
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
           WHERE id = ?`, [game.home_points || null, game.away_points || null, spreadWinner, dbGame.id]);
                console.log(`Updated score for ${game.home_team} vs ${game.away_team}`);
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
// Start all scheduled tasks
const startScheduler = () => {
    console.log('Starting CFB Pick\'em scheduler...');
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
    // Daily maintenance at 2 AM (clean up, calculate standings)
    node_cron_1.default.schedule('0 2 * * *', () => {
        console.log('Running daily maintenance...');
        (0, exports.updateGameScores)();
    });
    console.log('✅ Scheduler tasks registered');
    // Run initial fetch on startup if no games exist
    setTimeout(async () => {
        try {
            const gameCount = await (0, database_1.getQuery)('SELECT COUNT(*) as count FROM games');
            if (!gameCount || gameCount.count === 0) {
                console.log('No games found, running initial fetch...');
                await (0, exports.fetchWeeklyGames)();
            }
        }
        catch (error) {
            console.error('Error in initial game check:', error);
        }
    }, 5000); // Wait 5 seconds after startup
};
exports.startScheduler = startScheduler;
//# sourceMappingURL=scheduler.js.map