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
exports.default = router;
//# sourceMappingURL=admin-minimal.js.map