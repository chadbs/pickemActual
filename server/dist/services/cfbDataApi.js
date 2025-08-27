"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopGamesForWeek = exports.isFavoriteTeam = exports.getGameScores = exports.getRankings = exports.getTeams = exports.getGamesForWeek = void 0;
const axios_1 = __importDefault(require("axios"));
const CFBD_API_BASE = 'https://api.collegefootballdata.com';
const CFBD_API_KEY = process.env.CFBD_API_KEY;
const cfbdApi = axios_1.default.create({
    baseURL: CFBD_API_BASE,
    headers: {
        'Authorization': `Bearer ${CFBD_API_KEY}`,
        'Content-Type': 'application/json'
    }
});
// Get games for a specific week and season
const getGamesForWeek = async (year, week) => {
    try {
        const response = await cfbdApi.get('/games', {
            params: {
                year,
                week,
                seasonType: 'regular'
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching games from CFBD API:', error);
        throw new Error('Failed to fetch games from College Football Data API');
    }
};
exports.getGamesForWeek = getGamesForWeek;
// Get all teams
const getTeams = async (year) => {
    try {
        const response = await cfbdApi.get('/teams', {
            params: { year }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching teams from CFBD API:', error);
        throw new Error('Failed to fetch teams from College Football Data API');
    }
};
exports.getTeams = getTeams;
// Get rankings for a week
const getRankings = async (year, week) => {
    try {
        const response = await cfbdApi.get('/rankings', {
            params: {
                year,
                week,
                seasonType: 'regular'
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching rankings from CFBD API:', error);
        return []; // Rankings are optional, don't fail
    }
};
exports.getRankings = getRankings;
// Get game scores (for updating completed games)
const getGameScores = async (year, week) => {
    try {
        const response = await cfbdApi.get('/games', {
            params: {
                year,
                week,
                seasonType: 'regular'
            }
        });
        // Filter for completed games only
        return response.data.filter((game) => game.completed);
    }
    catch (error) {
        console.error('Error fetching game scores from CFBD API:', error);
        throw new Error('Failed to fetch game scores from College Football Data API');
    }
};
exports.getGameScores = getGameScores;
// Check if a team is one of our favorite teams
const isFavoriteTeam = (teamName) => {
    const favoriteTeams = [
        'Colorado', 'Colorado Buffaloes', 'CU', 'Buffs',
        'Colorado State', 'Colorado State Rams', 'CSU', 'Rams',
        'Nebraska', 'Nebraska Cornhuskers', 'Huskers', 'NU',
        'Michigan', 'Michigan Wolverines', 'Wolverines', 'UM'
    ];
    return favoriteTeams.some(favorite => teamName.toLowerCase().includes(favorite.toLowerCase()) ||
        favorite.toLowerCase().includes(teamName.toLowerCase()));
};
exports.isFavoriteTeam = isFavoriteTeam;
// Get top games based on rankings and our favorite teams
const getTopGamesForWeek = async (year, week) => {
    try {
        const games = await (0, exports.getGamesForWeek)(year, week);
        const rankings = await (0, exports.getRankings)(year, week);
        // Create a map of ranked teams
        const rankedTeams = new Set();
        rankings.forEach(poll => {
            if (poll.poll === 'AP Top 25') {
                poll.ranks.forEach(rank => rankedTeams.add(rank.school));
            }
        });
        // Score games based on criteria
        const scoredGames = games.map(game => {
            let score = 0;
            // Favorite team bonus (highest priority)
            if ((0, exports.isFavoriteTeam)(game.home_team) || (0, exports.isFavoriteTeam)(game.away_team)) {
                score += 1000;
            }
            // Both teams ranked
            if (rankedTeams.has(game.home_team) && rankedTeams.has(game.away_team)) {
                score += 100;
            }
            // One team ranked
            else if (rankedTeams.has(game.home_team) || rankedTeams.has(game.away_team)) {
                score += 50;
            }
            // Conference game bonus
            if (game.conference_game) {
                score += 10;
            }
            return { ...game, score };
        });
        // Sort by score (descending) and return top games
        return scoredGames
            .sort((a, b) => b.score - a.score)
            .slice(0, 12) // Get top 12 to have options, will narrow to 8 later
            .map(({ score, ...game }) => game); // Remove score from response
    }
    catch (error) {
        console.error('Error getting top games:', error);
        throw error;
    }
};
exports.getTopGamesForWeek = getTopGamesForWeek;
//# sourceMappingURL=cfbDataApi.js.map