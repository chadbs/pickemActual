"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeGamesForWeek = exports.scrapeAllSources = exports.scrapeCBSSports = exports.scrapeESPNGames = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const apiUsageMonitor_1 = require("./apiUsageMonitor");
const cfbDataApi_1 = require("./cfbDataApi");
// Scrape ESPN scoreboard for college football games
const scrapeESPNGames = async (date) => {
    try {
        // Use current date if not provided
        const targetDate = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
        const url = `https://www.espn.com/college-football/scoreboard/_/date/${targetDate}`;
        console.log(`Scraping ESPN scoreboard: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        const $ = cheerio.load(response.data);
        const games = [];
        // ESPN's game cards structure
        $('.Scoreboard__ScheduleCard, .ScoreCell, .gameModules').each((index, element) => {
            try {
                const $game = $(element);
                // Extract team names from different possible selectors
                const teamElements = $game.find('.ScoreCell__TeamName, .team-name, .sb-team-short, .competitors .team');
                if (teamElements.length >= 2) {
                    const awayTeam = $(teamElements[0]).text().trim();
                    const homeTeam = $(teamElements[1]).text().trim();
                    if (awayTeam && homeTeam) {
                        // Extract scores
                        const scoreElements = $game.find('.ScoreCell__Score, .score, .team-score');
                        const awayScore = scoreElements.length > 0 ? parseInt($(scoreElements[0]).text().trim()) || undefined : undefined;
                        const homeScore = scoreElements.length > 1 ? parseInt($(scoreElements[1]).text().trim()) || undefined : undefined;
                        // Check if game is completed
                        const statusElement = $game.find('.ScoreCell__Status, .game-status, .status');
                        const status = statusElement.text().trim().toLowerCase();
                        const completed = status.includes('final') || status.includes('f/');
                        // Extract game time/date
                        const timeElement = $game.find('.ScoreCell__Time, .game-time, .time');
                        const gameTime = timeElement.text().trim();
                        // Generate a unique ID based on teams and date
                        const gameId = `${awayTeam.replace(/\s+/g, '')}_${homeTeam.replace(/\s+/g, '')}_${targetDate}`;
                        games.push({
                            id: gameId,
                            home_team: homeTeam,
                            away_team: awayTeam,
                            start_date: new Date().toISOString(), // Use current time as fallback
                            home_score: completed ? homeScore : undefined,
                            away_score: completed ? awayScore : undefined,
                            completed,
                            source: 'scrape'
                        });
                    }
                }
            }
            catch (error) {
                console.warn('Error parsing game element:', error);
            }
        });
        // Alternative parsing for different ESPN layouts
        if (games.length === 0) {
            $('.Card, .game-strip, .game').each((index, element) => {
                try {
                    const $game = $(element);
                    const gameText = $game.text();
                    // Look for team vs team patterns
                    const vsMatch = gameText.match(/([^0-9\n]+)\s+vs?\s+([^0-9\n]+)/i);
                    const atMatch = gameText.match(/([^0-9\n]+)\s+@\s+([^0-9\n]+)/i);
                    if (vsMatch || atMatch) {
                        const match = vsMatch || atMatch;
                        const team1 = match[1].trim();
                        const team2 = match[2].trim();
                        // Extract scores with regex
                        const scoreMatch = gameText.match(/(\d+)\s*-\s*(\d+)/);
                        const scores = scoreMatch ? [parseInt(scoreMatch[1]), parseInt(scoreMatch[2])] : [0, 0];
                        const completed = gameText.toLowerCase().includes('final');
                        const gameId = `${team1.replace(/\s+/g, '')}_${team2.replace(/\s+/g, '')}_${targetDate}`;
                        games.push({
                            id: gameId,
                            home_team: team2, // In @ format, second team is home
                            away_team: team1,
                            start_date: new Date().toISOString(),
                            home_score: completed ? scores[1] : undefined,
                            away_score: completed ? scores[0] : undefined,
                            completed,
                            source: 'scrape'
                        });
                    }
                }
                catch (error) {
                    console.warn('Error parsing alternative game format:', error);
                }
            });
        }
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/scrape/espn', true);
        console.log(`✅ Scraped ${games.length} games from ESPN`);
        return games;
    }
    catch (error) {
        console.error('Error scraping ESPN:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/scrape/espn', false, error.message);
        return [];
    }
};
exports.scrapeESPNGames = scrapeESPNGames;
// Scrape CBS Sports for additional data and spreads
const scrapeCBSSports = async () => {
    try {
        const url = 'https://www.cbssports.com/college-football/scoreboard/';
        console.log(`Scraping CBS Sports: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        const $ = cheerio.load(response.data);
        const games = [];
        $('.live-update, .game-item, .in-progress-table').each((index, element) => {
            try {
                const $game = $(element);
                // Extract team names
                const teams = $game.find('.team-name, .team').map((i, el) => $(el).text().trim()).get();
                if (teams.length >= 2) {
                    const awayTeam = teams[0];
                    const homeTeam = teams[1];
                    // Extract scores
                    const scoreElements = $game.find('.score, .team-score');
                    const scores = [];
                    scoreElements.each((i, el) => {
                        const score = parseInt($(el).text().trim()) || 0;
                        scores.push(score);
                    });
                    // Check completion status
                    const status = $game.find('.status, .game-status').text().toLowerCase();
                    const completed = status.includes('final') || status.includes('f');
                    // Look for spread information
                    const spreadText = $game.find('.spread, .line, .betting-line').text();
                    const spreadMatch = spreadText.match(/([-+]?\d+\.?\d*)/);
                    const spread = spreadMatch ? Math.abs(parseFloat(spreadMatch[1])) : undefined;
                    const gameId = `cbs_${awayTeam.replace(/\s+/g, '')}_${homeTeam.replace(/\s+/g, '')}`;
                    games.push({
                        id: gameId,
                        home_team: homeTeam,
                        away_team: awayTeam,
                        start_date: new Date().toISOString(),
                        home_score: completed && scores.length > 1 ? scores[1] : undefined,
                        away_score: completed && scores.length > 0 ? scores[0] : undefined,
                        completed,
                        spread,
                        source: 'scrape'
                    });
                }
            }
            catch (error) {
                console.warn('Error parsing CBS game:', error);
            }
        });
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/scrape/cbs', true);
        console.log(`✅ Scraped ${games.length} games from CBS Sports`);
        return games;
    }
    catch (error) {
        console.error('Error scraping CBS Sports:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/scrape/cbs', false, error.message);
        return [];
    }
};
exports.scrapeCBSSports = scrapeCBSSports;
// Combined scraping from multiple sources
const scrapeAllSources = async () => {
    console.log('🕷️ Starting web scraping from all sources...');
    const allGames = [];
    // Scrape ESPN
    try {
        const espnGames = await (0, exports.scrapeESPNGames)();
        allGames.push(...espnGames);
    }
    catch (error) {
        console.warn('ESPN scraping failed:', error);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Scrape CBS Sports
    try {
        const cbsGames = await (0, exports.scrapeCBSSports)();
        allGames.push(...cbsGames);
    }
    catch (error) {
        console.warn('CBS Sports scraping failed:', error);
    }
    // Deduplicate games by team matchup
    const uniqueGames = allGames.filter((game, index, self) => {
        return index === self.findIndex(g => (g.home_team === game.home_team && g.away_team === game.away_team) ||
            (g.home_team === game.away_team && g.away_team === game.home_team));
    });
    // Prioritize favorite team games
    const sortedGames = uniqueGames.sort((a, b) => {
        const aIsFavorite = (0, cfbDataApi_1.isFavoriteTeam)(a.home_team) || (0, cfbDataApi_1.isFavoriteTeam)(a.away_team);
        const bIsFavorite = (0, cfbDataApi_1.isFavoriteTeam)(b.home_team) || (0, cfbDataApi_1.isFavoriteTeam)(b.away_team);
        if (aIsFavorite && !bIsFavorite)
            return -1;
        if (!aIsFavorite && bIsFavorite)
            return 1;
        return 0;
    });
    console.log(`✅ Total scraped games: ${sortedGames.length} (${uniqueGames.length} unique)`);
    return sortedGames;
};
exports.scrapeAllSources = scrapeAllSources;
// Scrape games for a specific week (try multiple date ranges)
const scrapeGamesForWeek = async (year, week) => {
    const games = [];
    // Calculate approximate dates for the week
    const baseDate = new Date(year, 7, 25); // Aug 25 season start
    const weekStart = new Date(baseDate.getTime() + ((week - 1) * 7 * 24 * 60 * 60 * 1000));
    // Try scraping Thursday through Sunday of that week
    for (let dayOffset = 3; dayOffset <= 6; dayOffset++) { // Thu-Sun
        const targetDate = new Date(weekStart.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
        const dateString = targetDate.toISOString().split('T')[0].replace(/-/g, '');
        try {
            const dayGames = await (0, exports.scrapeESPNGames)(dateString);
            games.push(...dayGames);
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            console.warn(`Failed to scrape ${dateString}:`, error);
        }
    }
    // Deduplicate and return
    const uniqueGames = games.filter((game, index, self) => {
        return index === self.findIndex(g => g.id === game.id);
    });
    console.log(`Scraped ${uniqueGames.length} games for Week ${week}`);
    return uniqueGames;
};
exports.scrapeGamesForWeek = scrapeGamesForWeek;
//# sourceMappingURL=webScraper.js.map