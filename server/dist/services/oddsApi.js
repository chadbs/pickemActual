"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAPIUsage = exports.matchOddsToGames = exports.parseOddsData = exports.getNCAAFootballOdds = void 0;
const axios_1 = __importDefault(require("axios"));
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const oddsApi = axios_1.default.create({
    baseURL: ODDS_API_BASE,
    params: {
        apiKey: ODDS_API_KEY
    }
});
// Get NCAA Football odds
const getNCAAFootballOdds = async () => {
    try {
        const response = await oddsApi.get('/sports/americanfootball_ncaaf/odds', {
            params: {
                regions: 'us',
                markets: 'h2h,spreads,totals',
                oddsFormat: 'american'
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error fetching odds from The Odds API:', error.response?.data || error.message);
        // If we hit rate limits, return empty array instead of failing
        if (error.response?.status === 429) {
            console.warn('Odds API rate limit hit, returning empty odds');
            return [];
        }
        throw new Error('Failed to fetch odds from The Odds API');
    }
};
exports.getNCAAFootballOdds = getNCAAFootballOdds;
// Parse odds data to extract spreads and useful info
const parseOddsData = (oddsData) => {
    return oddsData.map(game => {
        const parsed = {
            gameId: game.id,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time
        };
        // Find the best bookmaker (preferably DraftKings, FanDuel, or BetMGM)
        const preferredBooks = ['draftkings', 'fanduel', 'betmgm'];
        let bookmaker = game.bookmakers.find(book => preferredBooks.includes(book.key.toLowerCase())) || game.bookmakers[0];
        if (bookmaker) {
            // Extract spreads
            const spreadMarket = bookmaker.markets.find(market => market.key === 'spreads');
            if (spreadMarket) {
                const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team);
                const awayOutcome = spreadMarket.outcomes.find(o => o.name === game.away_team);
                if (homeOutcome && awayOutcome && homeOutcome.point !== undefined) {
                    // Determine which team is favored
                    const homeSpread = homeOutcome.point;
                    const awaySpread = awayOutcome.point || -homeSpread;
                    parsed.spread = {
                        favorite: homeSpread < 0 ? game.home_team : game.away_team,
                        line: Math.abs(homeSpread),
                        homePrice: homeOutcome.price,
                        awayPrice: awayOutcome.price
                    };
                }
            }
            // Extract moneyline
            const moneylineMarket = bookmaker.markets.find(market => market.key === 'h2h');
            if (moneylineMarket) {
                const homeOutcome = moneylineMarket.outcomes.find(o => o.name === game.home_team);
                const awayOutcome = moneylineMarket.outcomes.find(o => o.name === game.away_team);
                if (homeOutcome && awayOutcome) {
                    parsed.moneyline = {
                        homePrice: homeOutcome.price,
                        awayPrice: awayOutcome.price
                    };
                }
            }
            // Extract totals
            const totalsMarket = bookmaker.markets.find(market => market.key === 'totals');
            if (totalsMarket) {
                const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
                const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');
                if (overOutcome && underOutcome && overOutcome.point !== undefined) {
                    parsed.total = {
                        over: overOutcome.price,
                        under: underOutcome.price,
                        line: overOutcome.point
                    };
                }
            }
        }
        return parsed;
    });
};
exports.parseOddsData = parseOddsData;
// Match odds to CFBD games by team names
const matchOddsToGames = (cfbdGames, oddsData) => {
    return cfbdGames.map(game => {
        // Try to find matching odds by team names
        const matchingOdds = oddsData.find(odds => {
            const homeMatch = normalizeTeamName(odds.homeTeam) === normalizeTeamName(game.home_team) ||
                normalizeTeamName(odds.awayTeam) === normalizeTeamName(game.home_team);
            const awayMatch = normalizeTeamName(odds.homeTeam) === normalizeTeamName(game.away_team) ||
                normalizeTeamName(odds.awayTeam) === normalizeTeamName(game.away_team);
            return homeMatch && awayMatch;
        });
        return {
            ...game,
            odds: matchingOdds || null,
            spread: matchingOdds?.spread?.line || null,
            favorite_team: matchingOdds?.spread?.favorite || null
        };
    });
};
exports.matchOddsToGames = matchOddsToGames;
// Normalize team names for matching (handle common variations)
const normalizeTeamName = (teamName) => {
    const normalizations = {
        'colorado buffaloes': 'colorado',
        'colorado state rams': 'colorado state',
        'nebraska cornhuskers': 'nebraska',
        'michigan wolverines': 'michigan',
        'usc trojans': 'usc',
        'ucla bruins': 'ucla',
        'notre dame fighting irish': 'notre dame',
        'texas a&m aggies': 'texas a&m'
    };
    const normalized = teamName.toLowerCase();
    return normalizations[normalized] || normalized;
};
// Check API usage (monitor rate limits)
const checkAPIUsage = async () => {
    try {
        // Make a simple request to check headers
        const response = await oddsApi.get('/sports');
        return {
            remaining: parseInt(response.headers['x-requests-remaining'] || '0'),
            used: parseInt(response.headers['x-requests-used'] || '0')
        };
    }
    catch (error) {
        console.error('Error checking API usage:', error);
        return { remaining: 0, used: 0 };
    }
};
exports.checkAPIUsage = checkAPIUsage;
//# sourceMappingURL=oddsApi.js.map