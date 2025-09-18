"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshGameData = exports.getDataSourceStatus = exports.fetchScoresWithFallback = exports.fetchGamesWithFallback = void 0;
const apiUsageMonitor_1 = require("./apiUsageMonitor");
const cfbDataApi_1 = require("./cfbDataApi");
const oddsApi_1 = require("./oddsApi");
const webScraper_1 = require("./webScraper");
const espnApi_1 = require("./espnApi");
// Smart game fetcher that tries APIs first, falls back to scraping
const fetchGamesWithFallback = async (year, week) => {
    console.log(`🔄 Fetching games for ${year} Week ${week} with smart fallback...`);
    let games = [];
    let oddsData = [];
    // Step 1: Try CFBD API first (if credits available)
    if (!(await (0, apiUsageMonitor_1.shouldSkipAPICall)('cfbd'))) {
        try {
            console.log('🎯 Trying CFBD API...');
            const cfbdGames = await (0, cfbDataApi_1.getTopGamesForWeek)(year, week);
            games = cfbdGames.map(game => ({
                ...game,
                home_team: game.home_team || game.homeTeam,
                away_team: game.away_team || game.awayTeam,
                start_date: game.start_date || game.startDate,
                source: 'cfbd'
            }));
            console.log(`✅ CFBD API: ${games.length} games`);
            await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/games/week/${week}`, true);
        }
        catch (error) {
            console.warn('CFBD API failed:', error.message);
            await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/games/week/${week}`, false, error.message);
        }
    }
    else {
        console.log('⏭️ Skipping CFBD API (low credits or high error rate)');
    }
    // Step 2: Try ESPN API if CFBD failed
    if (games.length === 0) {
        try {
            console.log('🔄 Trying ESPN API...');
            const espnAvailable = await (0, espnApi_1.testESPNConnection)();
            if (espnAvailable) {
                const espnGames = await (0, espnApi_1.getESPNGamesForWeek)(year, week);
                games = espnGames.map(game => ({ ...game, source: 'espn' }));
                console.log(`✅ ESPN API: ${games.length} games`);
            }
        }
        catch (error) {
            console.warn('ESPN API failed:', error.message);
        }
    }
    // Step 3: Fall back to web scraping if APIs failed
    if (games.length === 0) {
        try {
            console.log('🕷️ Falling back to web scraping...');
            const scrapedGames = await (0, webScraper_1.scrapeGamesForWeek)(year, week);
            games = scrapedGames.map(game => ({ ...game, source: 'scrape' }));
            console.log(`✅ Web scraping: ${games.length} games`);
        }
        catch (error) {
            console.error('Web scraping failed:', error.message);
        }
    }
    // Step 4: Try to get odds data (if credits available)
    if (games.length > 0 && !(await (0, apiUsageMonitor_1.shouldSkipAPICall)('odds'))) {
        try {
            console.log('🎰 Trying to fetch odds...');
            const rawOdds = await (0, oddsApi_1.getNCAAFootballOdds)();
            oddsData = (0, oddsApi_1.parseOddsData)(rawOdds);
            console.log(`✅ Odds API: ${oddsData.length} games with odds`);
            await (0, apiUsageMonitor_1.logAPICall)('odds', '/odds', true);
        }
        catch (error) {
            console.warn('Odds API failed:', error.message);
            await (0, apiUsageMonitor_1.logAPICall)('odds', '/odds', false, error.message);
        }
    }
    else if (games.length > 0) {
        console.log('⏭️ Skipping Odds API (low credits or no games)');
    }
    // Step 5: Match odds to games if we have both
    if (games.length > 0 && oddsData.length > 0) {
        try {
            games = (0, oddsApi_1.matchOddsToGames)(games, oddsData);
            console.log(`🎯 Matched odds to ${games.filter(g => g.spread).length} games`);
        }
        catch (error) {
            console.warn('Error matching odds:', error.message);
        }
    }
    console.log(`🏁 Final result: ${games.length} games for Week ${week}`);
    return games;
};
exports.fetchGamesWithFallback = fetchGamesWithFallback;
// Smart score fetcher with fallback
const fetchScoresWithFallback = async (year, week) => {
    console.log(`🔄 Fetching scores for ${year} Week ${week} with fallback...`);
    let completedGames = [];
    // Try CFBD API first (if credits available)
    if (!(await (0, apiUsageMonitor_1.shouldSkipAPICall)('cfbd'))) {
        try {
            console.log('🎯 Trying CFBD API for scores...');
            const cfbdScores = await (0, cfbDataApi_1.getGameScores)(year, week);
            completedGames = cfbdScores.map(game => ({
                id: game.id,
                home_team: game.homeTeam,
                away_team: game.awayTeam,
                start_date: game.startDate,
                home_score: game.homePoints,
                away_score: game.awayPoints,
                completed: game.completed,
                source: 'cfbd'
            }));
            console.log(`✅ CFBD scores: ${completedGames.length} completed games`);
            await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/scores/week/${week}`, true);
        }
        catch (error) {
            console.warn('CFBD scores failed:', error.message);
            await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/scores/week/${week}`, false, error.message);
        }
    }
    else {
        console.log('⏭️ Skipping CFBD scores API (low credits)');
    }
    // Fall back to web scraping if API failed
    if (completedGames.length === 0) {
        try {
            console.log('🕷️ Falling back to scraping for scores...');
            const scrapedGames = await (0, webScraper_1.scrapeAllSources)();
            completedGames = scrapedGames.filter(game => game.completed);
            console.log(`✅ Scraped scores: ${completedGames.length} completed games`);
        }
        catch (error) {
            console.error('Score scraping failed:', error.message);
        }
    }
    return completedGames;
};
exports.fetchScoresWithFallback = fetchScoresWithFallback;
// Get data source status for monitoring
const getDataSourceStatus = async () => {
    const status = {
        cfbd: { available: true },
        odds: { available: true },
        espn: { available: true },
        scraping: { available: true }
    };
    // Check CFBD API status
    if (await (0, apiUsageMonitor_1.shouldSkipAPICall)('cfbd')) {
        status.cfbd = { available: false, reason: 'Low credits or high error rate' };
    }
    // Check Odds API status
    if (await (0, apiUsageMonitor_1.shouldSkipAPICall)('odds')) {
        status.odds = { available: false, reason: 'Low credits or high error rate' };
    }
    // Test ESPN API
    try {
        const espnAvailable = await (0, espnApi_1.testESPNConnection)();
        if (!espnAvailable) {
            status.espn = { available: false, reason: 'Connection test failed' };
        }
    }
    catch (error) {
        status.espn = { available: false, reason: 'Connection error' };
    }
    return status;
};
exports.getDataSourceStatus = getDataSourceStatus;
// Manual refresh with preferred source
const refreshGameData = async (year, week, preferredSource = 'api') => {
    console.log(`🔄 Manual refresh for Week ${week} (preferred: ${preferredSource})`);
    if (preferredSource === 'scrape') {
        // Force web scraping
        try {
            const scrapedGames = await (0, webScraper_1.scrapeGamesForWeek)(year, week);
            console.log(`✅ Manual scrape: ${scrapedGames.length} games`);
            return scrapedGames;
        }
        catch (error) {
            console.error('Manual scraping failed:', error.message);
            return [];
        }
    }
    else {
        // Use smart fallback (API first)
        return (0, exports.fetchGamesWithFallback)(year, week);
    }
};
exports.refreshGameData = refreshGameData;
//# sourceMappingURL=hybridDataFetcher.js.map