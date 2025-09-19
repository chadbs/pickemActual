"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const hybridDataFetcher_1 = require("../services/hybridDataFetcher");
const webScraper_1 = require("../services/webScraper");
const spreadScraper_1 = require("../services/spreadScraper");
const database_1 = require("../database/database");
const cfbDataApi_1 = require("../services/cfbDataApi");
const router = express_1.default.Router();
// Test route to verify admin routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Minimal admin routes working!', timestamp: new Date().toISOString() });
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
        let weekData;
        if (!week) {
            weekData = await (0, database_1.getQuery)(`
        SELECT * FROM weeks 
        WHERE is_active = 1 AND season_year = ?
        ORDER BY week_number DESC LIMIT 1
      `, [targetYear]);
            if (!weekData) {
                return res.status(400).json({
                    error: 'No active week found and no week specified'
                });
            }
        }
        else {
            weekData = await (0, database_1.getQuery)(`
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
        await (0, database_1.runQuery)('DELETE FROM games WHERE week_id = ?', [weekData.id]);
        console.log(`Cleared existing games for Week ${weekData.week_number}`);
        // Scrape new games
        let scrapedGames = await (0, webScraper_1.scrapeGamesForWeek)(targetYear, weekData.week_number);
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
            const scrapedSpreads = await (0, spreadScraper_1.scrapeAllSpreads)();
            if (scrapedSpreads.length > 0) {
                scrapedGames = (0, spreadScraper_1.matchSpreadToGames)(scrapedGames, scrapedSpreads);
                spreadsAdded = scrapedGames.filter(g => g.spread).length;
                console.log(`✅ Added spreads to ${spreadsAdded} games`);
            }
        }
        catch (error) {
            console.warn('Spread scraping failed, continuing without spreads:', error);
        }
        // Store scraped games in database
        let storedCount = 0;
        for (const game of scrapedGames.slice(0, 8)) { // Limit to 8 games
            try {
                await (0, database_1.runQuery)(`
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
            }
            catch (error) {
                console.warn(`Error storing game ${game.home_team || game.homeTeam} vs ${game.away_team || game.awayTeam}:`, error);
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
    }
    catch (error) {
        console.error('Error in scrape-games endpoint:', error);
        res.status(500).json({
            error: 'Failed to scrape games',
            details: error.message
        });
    }
});
// Get data source status
router.get('/data-sources', async (req, res) => {
    try {
        const status = await (0, hybridDataFetcher_1.getDataSourceStatus)();
        res.json({
            sources: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting data source status:', error);
        res.status(500).json({
            error: 'Failed to get data source status',
            details: error.message
        });
    }
});
// Force refresh with preferred source
router.post('/refresh-games', async (req, res) => {
    try {
        const { week, year, source } = req.body;
        const targetYear = year || 2025;
        const targetWeek = week || 1;
        const preferredSource = source || 'api'; // 'api' or 'scrape'
        console.log(`Force refreshing games for Week ${targetWeek} (source: ${preferredSource})`);
        const games = await (0, hybridDataFetcher_1.refreshGameData)(targetYear, targetWeek, preferredSource);
        res.json({
            message: `Games refreshed for Week ${targetWeek}`,
            week: targetWeek,
            year: targetYear,
            gamesFound: games.length,
            source: preferredSource,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error in refresh-games endpoint:', error);
        res.status(500).json({
            error: 'Failed to refresh games',
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
        let games;
        if (targetWeek) {
            const weekData = await (0, database_1.getQuery)(`
        SELECT * FROM weeks 
        WHERE week_number = ? AND season_year = ?
      `, [targetWeek, targetYear]);
            if (!weekData) {
                return res.status(400).json({
                    error: `Week ${targetWeek} of ${targetYear} not found`
                });
            }
            games = await (0, database_1.allQuery)(`
        SELECT * FROM games WHERE week_id = ?
      `, [weekData.id]);
        }
        else {
            // Get all games without spreads
            games = await (0, database_1.allQuery)(`
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
        const scrapedSpreads = await (0, spreadScraper_1.scrapeAllSpreads)();
        if (scrapedSpreads.length === 0) {
            return res.json({
                message: 'No spreads found via scraping',
                updated: 0,
                sources: ['espn', 'sports-reference', 'vegas-insider']
            });
        }
        // Match and update spreads
        const gamesWithSpreads = (0, spreadScraper_1.matchSpreadToGames)(games, scrapedSpreads);
        let updatedCount = 0;
        for (const game of gamesWithSpreads) {
            if (game.spread && game.favorite_team) {
                try {
                    await (0, database_1.runQuery)(`
            UPDATE games 
            SET spread = ?, favorite_team = ? 
            WHERE id = ?
          `, [game.spread, game.favorite_team, game.id]);
                    updatedCount++;
                }
                catch (error) {
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
    }
    catch (error) {
        console.error('Error in scrape-spreads endpoint:', error);
        res.status(500).json({
            error: 'Failed to scrape spreads',
            details: error.message
        });
    }
});
// Fetch fresh spreads for current week games (legacy endpoint)
router.post('/fetch-spreads', async (req, res) => {
    console.log('🚀 MINIMAL FETCH SPREADS ENDPOINT HIT!');
    res.json({
        message: 'Use /scrape-spreads or /scrape-games instead',
        updated: 0,
        total: 0,
        timestamp: new Date().toISOString()
    });
});
// Get top 20 games for selection
router.get('/top-games/:year/:week', async (req, res) => {
    try {
        const { year, week } = req.params;
        const targetYear = parseInt(year) || 2025;
        const targetWeek = parseInt(week) || 1;
        console.log(`Getting top 20 games for ${targetYear} Week ${targetWeek}`);
        // Get top games from CFBD API
        const topGames = await (0, cfbDataApi_1.getTopGamesForWeek)(targetYear, targetWeek);
        // Check which games are already selected for this week
        const weekData = await (0, database_1.getQuery)(`
      SELECT * FROM weeks
      WHERE week_number = ? AND season_year = ?
    `, [targetWeek, targetYear]);
        let selectedGameIds = [];
        if (weekData) {
            const selectedGames = await (0, database_1.allQuery)(`
        SELECT external_game_id FROM games WHERE week_id = ?
      `, [weekData.id]);
            selectedGameIds = selectedGames.map((g) => g.external_game_id).filter(Boolean);
        }
        // Add selection status to each game
        const gamesWithStatus = topGames.map((game) => ({
            ...game,
            isSelected: selectedGameIds.includes(game.id?.toString())
        }));
        res.json({
            games: gamesWithStatus,
            week: targetWeek,
            year: targetYear,
            totalAvailable: topGames.length,
            selectedCount: selectedGameIds.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting top games:', error);
        res.status(500).json({
            error: 'Failed to get top games',
            details: error.message
        });
    }
});
// Select specific games for a week
router.post('/select-games', async (req, res) => {
    try {
        const { year, week, gameIds } = req.body;
        const targetYear = year || 2025;
        const targetWeek = week || 1;
        if (!gameIds || !Array.isArray(gameIds)) {
            return res.status(400).json({
                error: 'gameIds array is required'
            });
        }
        console.log(`Selecting ${gameIds.length} games for ${targetYear} Week ${targetWeek}`);
        // Get or create week
        let weekData = await (0, database_1.getQuery)(`
      SELECT * FROM weeks
      WHERE week_number = ? AND season_year = ?
    `, [targetWeek, targetYear]);
        if (!weekData) {
            return res.status(400).json({
                error: `Week ${targetWeek} of ${targetYear} not found in database`
            });
        }
        // Clear existing games for this week
        await (0, database_1.runQuery)('DELETE FROM games WHERE week_id = ?', [weekData.id]);
        console.log(`Cleared existing games for Week ${targetWeek}`);
        // Get the full game data for selected games
        const topGames = await (0, cfbDataApi_1.getTopGamesForWeek)(targetYear, targetWeek);
        const selectedGames = topGames.filter((game) => gameIds.includes(game.id?.toString()));
        if (selectedGames.length === 0) {
            return res.status(400).json({
                error: 'No valid games found with provided IDs'
            });
        }
        // Store selected games in database
        let storedCount = 0;
        for (const game of selectedGames) {
            try {
                await (0, database_1.runQuery)(`
          INSERT INTO games
          (week_id, external_game_id, home_team, away_team,
           start_time, status, is_favorite_team_game, home_conference, away_conference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    weekData.id,
                    game.id?.toString() || null,
                    game.home_team || game.homeTeam,
                    game.away_team || game.awayTeam,
                    game.start_date || game.startDate || new Date().toISOString(),
                    game.completed ? 'completed' : 'scheduled',
                    false, // Will calculate later
                    game.home_conference || game.homeConference || null,
                    game.away_conference || game.awayConference || null
                ]);
                storedCount++;
            }
            catch (error) {
                console.warn(`Error storing game ${game.home_team || game.homeTeam} vs ${game.away_team || game.awayTeam}:`, error);
            }
        }
        res.json({
            message: `Successfully selected ${storedCount} games for Week ${targetWeek}`,
            week: targetWeek,
            year: targetYear,
            gamesSelected: storedCount,
            gameIds: gameIds,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error selecting games:', error);
        res.status(500).json({
            error: 'Failed to select games',
            details: error.message
        });
    }
});
// Get currently selected games for a week
router.get('/selected-games/:year/:week', async (req, res) => {
    try {
        const { year, week } = req.params;
        const targetYear = parseInt(year) || 2025;
        const targetWeek = parseInt(week) || 1;
        const weekData = await (0, database_1.getQuery)(`
      SELECT * FROM weeks
      WHERE week_number = ? AND season_year = ?
    `, [targetWeek, targetYear]);
        if (!weekData) {
            return res.status(400).json({
                error: `Week ${targetWeek} of ${targetYear} not found`
            });
        }
        const selectedGames = await (0, database_1.allQuery)(`
      SELECT g.*, w.week_number, w.season_year
      FROM games g
      JOIN weeks w ON g.week_id = w.id
      WHERE g.week_id = ?
      ORDER BY g.start_time
    `, [weekData.id]);
        res.json({
            games: selectedGames,
            week: targetWeek,
            year: targetYear,
            count: selectedGames.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting selected games:', error);
        res.status(500).json({
            error: 'Failed to get selected games',
            details: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin-minimal.js.map