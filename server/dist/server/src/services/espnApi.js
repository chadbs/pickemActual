"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testESPNConnection = exports.getESPNCurrentGames = exports.getESPNGamesForWeek = void 0;
const axios_1 = __importDefault(require("axios"));
const apiUsageMonitor_1 = require("./apiUsageMonitor");
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
// Get games for a specific week from ESPN (free alternative)
const getESPNGamesForWeek = async (year, week) => {
    try {
        console.log(`Fetching ESPN games for ${year} Week ${week}...`);
        // ESPN uses different week numbering, try both formats
        const urls = [
            `${ESPN_API_BASE}/scoreboard?seasontype=2&week=${week}&year=${year}`,
            `${ESPN_API_BASE}/scoreboard?week=${week}&year=${year}`
        ];
        let response;
        let lastError;
        for (const url of urls) {
            try {
                response = await axios_1.default.get(url, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
                    }
                });
                break;
            }
            catch (error) {
                lastError = error;
                continue;
            }
        }
        if (!response) {
            await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/espn/week/${week}`, false, lastError?.message);
            throw lastError;
        }
        const data = response.data;
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/espn/week/${week}`, true);
        if (!data.events || data.events.length === 0) {
            console.log(`No games found for Week ${week}`);
            return [];
        }
        // Convert ESPN format to our format
        const games = data.events.map(event => {
            const competition = event.competitions[0];
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            // Get spread from odds if available
            let spread = null;
            let favoriteTeam = null;
            if (competition.odds && competition.odds.length > 0) {
                const odds = competition.odds[0];
                spread = Math.abs(odds.spread);
                favoriteTeam = odds.spread < 0 ? homeTeam?.team.displayName : awayTeam?.team.displayName;
            }
            return {
                id: event.id,
                home_team: homeTeam?.team.displayName,
                away_team: awayTeam?.team.displayName,
                start_date: event.date,
                completed: event.status.type.completed,
                home_score: homeTeam?.score ? parseInt(homeTeam.score) : null,
                away_score: awayTeam?.score ? parseInt(awayTeam.score) : null,
                spread,
                favorite_team: favoriteTeam,
                source: 'espn'
            };
        });
        console.log(`✅ ESPN: Found ${games.length} games for Week ${week}`);
        return games;
    }
    catch (error) {
        console.error('Error fetching games from ESPN:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', `/espn/week/${week}`, false, error.message);
        throw error;
    }
};
exports.getESPNGamesForWeek = getESPNGamesForWeek;
// Get current week games (for live scores)
const getESPNCurrentGames = async () => {
    try {
        const response = await axios_1.default.get(`${ESPN_API_BASE}/scoreboard`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
            }
        });
        const data = response.data;
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/espn/current', true);
        if (!data.events) {
            return [];
        }
        // Filter for completed games only
        const completedGames = data.events
            .filter(event => event.status.type.completed)
            .map(event => {
            const competition = event.competitions[0];
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            return {
                id: event.id,
                homeTeam: homeTeam?.team.displayName,
                awayTeam: awayTeam?.team.displayName,
                homePoints: homeTeam?.score ? parseInt(homeTeam.score) : 0,
                awayPoints: awayTeam?.score ? parseInt(awayTeam.score) : 0,
                completed: true,
                source: 'espn'
            };
        });
        console.log(`✅ ESPN: Found ${completedGames.length} completed games`);
        return completedGames;
    }
    catch (error) {
        console.error('Error fetching current games from ESPN:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/espn/current', false, error.message);
        return [];
    }
};
exports.getESPNCurrentGames = getESPNCurrentGames;
// Check if ESPN API is available
const testESPNConnection = async () => {
    try {
        const response = await axios_1.default.get(`${ESPN_API_BASE}/scoreboard`, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
            }
        });
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/espn/test', true);
        return response.status === 200;
    }
    catch (error) {
        await (0, apiUsageMonitor_1.logAPICall)('cfbd', '/espn/test', false, error.message);
        return false;
    }
};
exports.testESPNConnection = testESPNConnection;
//# sourceMappingURL=espnApi.js.map