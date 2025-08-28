"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAPIUsage = exports.matchOddsToGames = exports.parseOddsData = exports.getNCAAFootballOdds = void 0;
const axios_1 = __importDefault(require("axios"));
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const getOddsApi = () => {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    if (!ODDS_API_KEY) {
        throw new Error('ODDS_API_KEY environment variable is not set');
    }
    return axios_1.default.create({
        baseURL: ODDS_API_BASE,
        params: {
            apiKey: ODDS_API_KEY
        }
    });
};
// Get NCAA Football odds
const getNCAAFootballOdds = async () => {
    try {
        const oddsApi = getOddsApi();
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
    return cfbdGames.map((game) => {
        // Handle both field name formats (home_team/homeTeam)
        const gameHomeTeam = game.home_team || game.homeTeam;
        const gameAwayTeam = game.away_team || game.awayTeam;
        // Try to find matching odds by team names
        const matchingOdds = oddsData.find(odds => {
            const oddsHomeNorm = normalizeTeamName(odds.homeTeam);
            const oddsAwayNorm = normalizeTeamName(odds.awayTeam);
            const gameHomeNorm = normalizeTeamName(gameHomeTeam);
            const gameAwayNorm = normalizeTeamName(gameAwayTeam);
            const homeMatch = oddsHomeNorm === gameHomeNorm || oddsAwayNorm === gameHomeNorm;
            const awayMatch = oddsHomeNorm === gameAwayNorm || oddsAwayNorm === gameAwayNorm;
            return homeMatch && awayMatch;
        });
        return {
            ...game,
            // Ensure consistent field names
            home_team: gameHomeTeam,
            away_team: gameAwayTeam,
            start_date: game.start_date || game.startDate,
            odds: matchingOdds || null,
            spread: matchingOdds?.spread?.line || null,
            favorite_team: matchingOdds?.spread?.favorite ? normalizeTeamName(matchingOdds.spread.favorite) : null
        };
    });
};
exports.matchOddsToGames = matchOddsToGames;
// Normalize team names for matching (handle common variations)
const normalizeTeamName = (teamName) => {
    if (!teamName)
        return '';
    let normalized = teamName.toLowerCase().trim();
    // Remove common mascot/suffix words to get core team name
    const suffixesToRemove = [
        ' tigers', ' bulldogs', ' wildcats', ' eagles', ' bears', ' lions', ' panthers',
        ' hawks', ' falcons', ' cardinals', ' rams', ' bulls', ' broncos', ' mustangs',
        ' cowboys', ' longhorns', ' aggies', ' wolverines', ' spartans', ' buckeyes',
        ' cornhuskers', ' huskers', ' sooners', ' crimson tide', ' gators', ' volunteers',
        ' vols', ' gamecocks', ' razorbacks', ' rebels', ' commodores', ' bulldogs',
        ' yellow jackets', ' hokies', ' cavaliers', ' demon deacons', ' tar heels',
        ' blue devils', ' orange', ' fighting irish', ' trojans', ' bruins', ' cardinal',
        ' ducks', ' beavers', ' cougars', ' huskies', ' sun devils', ' wildcats',
        ' utes', ' red raiders', ' horned frogs', ' jayhawks', ' cyclones', ' mountaineers',
        ' seminoles', ' hurricanes', ' knights', ' green wave', ' owls', ' golden eagles'
    ];
    for (const suffix of suffixesToRemove) {
        if (normalized.endsWith(suffix)) {
            normalized = normalized.replace(suffix, '').trim();
            break;
        }
    }
    // Specific team name mappings for edge cases
    const normalizations = {
        'colorado buffaloes': 'colorado',
        'colorado state rams': 'colorado state',
        'nebraska cornhuskers': 'nebraska',
        'michigan wolverines': 'michigan',
        'usc trojans': 'usc',
        'ucla bruins': 'ucla',
        'notre dame fighting irish': 'notre dame',
        'texas a&m aggies': 'texas a&m',
        'alabama crimson tide': 'alabama',
        'lsu tigers': 'lsu',
        'florida gators': 'florida',
        'georgia bulldogs': 'georgia',
        'tennessee volunteers': 'tennessee',
        'south carolina gamecocks': 'south carolina',
        'kentucky wildcats': 'kentucky',
        'arkansas razorbacks': 'arkansas',
        'mississippi rebels': 'ole miss',
        'mississippi state bulldogs': 'mississippi state',
        'vanderbilt commodores': 'vanderbilt',
        'missouri tigers': 'missouri',
        'texas longhorns': 'texas',
        'oklahoma sooners': 'oklahoma',
        'oklahoma state cowboys': 'oklahoma state',
        'kansas jayhawks': 'kansas',
        'kansas state wildcats': 'kansas state',
        'iowa state cyclones': 'iowa state',
        'west virginia mountaineers': 'west virginia',
        'baylor bears': 'baylor',
        'tcu horned frogs': 'tcu',
        'texas tech red raiders': 'texas tech',
        'ohio state buckeyes': 'ohio state',
        'penn state nittany lions': 'penn state',
        'wisconsin badgers': 'wisconsin',
        'iowa hawkeyes': 'iowa',
        'minnesota golden gophers': 'minnesota',
        'illinois fighting illini': 'illinois',
        'northwestern wildcats': 'northwestern',
        'purdue boilermakers': 'purdue',
        'indiana hoosiers': 'indiana',
        'maryland terrapins': 'maryland',
        'rutgers scarlet knights': 'rutgers',
        'michigan state spartans': 'michigan state',
        'clemson tigers': 'clemson',
        'florida state seminoles': 'florida state',
        'miami hurricanes': 'miami',
        'virginia tech hokies': 'virginia tech',
        'virginia cavaliers': 'virginia',
        'north carolina tar heels': 'north carolina',
        'nc state wolfpack': 'nc state',
        'duke blue devils': 'duke',
        'wake forest demon deacons': 'wake forest',
        'georgia tech yellow jackets': 'georgia tech',
        'louisville cardinals': 'louisville',
        'pittsburgh panthers': 'pitt',
        'syracuse orange': 'syracuse',
        'boston college eagles': 'boston college',
        'oregon ducks': 'oregon',
        'washington huskies': 'washington',
        'stanford cardinal': 'stanford',
        'california golden bears': 'cal',
        'washington state cougars': 'washington state',
        'oregon state beavers': 'oregon state',
        'utah utes': 'utah',
        'arizona wildcats': 'arizona',
        'arizona state sun devils': 'arizona state',
        'cincinnati bearcats': 'cincinnati',
        'houston cougars': 'houston',
        'ucf knights': 'ucf',
        'south florida bulls': 'south florida',
        'temple owls': 'temple',
        'east carolina pirates': 'east carolina',
        'tulane green wave': 'tulane',
        'smu mustangs': 'smu',
        'memphis tigers': 'memphis',
        'tulsa golden hurricane': 'tulsa',
        'navy midshipmen': 'navy',
        'boise state broncos': 'boise state',
        'san diego state aztecs': 'san diego state',
        'fresno state bulldogs': 'fresno state',
        'nevada wolf pack': 'nevada',
        'unlv rebels': 'unlv',
        'new mexico lobos': 'new mexico',
        'wyoming cowboys': 'wyoming',
        'air force falcons': 'air force',
        'hawaii rainbow warriors': 'hawaii'
    };
    return normalizations[normalized] || normalized;
};
// Check API usage (monitor rate limits)
const checkAPIUsage = async () => {
    try {
        const oddsApi = getOddsApi();
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