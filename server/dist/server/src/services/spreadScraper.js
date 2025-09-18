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
exports.matchSpreadToGames = exports.normalizeTeamNameForMatching = exports.scrapeAllSpreads = exports.scrapeVegasInsiderSpreads = exports.scrapeSportsReferenceSpreads = exports.scrapeESPNSpreads = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const apiUsageMonitor_1 = require("./apiUsageMonitor");
// Scrape spreads from ESPN (free)
const scrapeESPNSpreads = async () => {
    try {
        const url = 'https://www.espn.com/college-football/lines';
        console.log(`Scraping ESPN spreads: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        const $ = cheerio.load(response.data);
        const spreads = [];
        // ESPN betting lines structure
        $('.oddsgame, .Table__TR').each((index, element) => {
            try {
                const $game = $(element);
                // Look for team names and spreads
                const teams = $game.find('.team-name, .AnchorLink, .Table__Team').map((i, el) => $(el).text().trim()).get();
                // Look for spread numbers (usually +/- followed by number)
                const spreadTexts = $game.find('.line, .spread, .Table__TD').map((i, el) => $(el).text().trim()).get();
                for (const text of spreadTexts) {
                    const spreadMatch = text.match(/([-+])(\d+\.?\d*)/);
                    if (spreadMatch && teams.length >= 2) {
                        const spreadValue = parseFloat(spreadMatch[2]);
                        const isNegative = spreadMatch[1] === '-';
                        // Negative spread means that team is favored
                        const favoriteTeam = isNegative ? teams[0] : teams[1];
                        spreads.push({
                            homeTeam: teams[1] || teams[0],
                            awayTeam: teams[0] || teams[1],
                            spread: spreadValue,
                            favoriteTeam,
                            source: 'espn'
                        });
                        break;
                    }
                }
            }
            catch (error) {
                console.warn('Error parsing ESPN spread:', error);
            }
        });
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/espn-spreads', true);
        console.log(`✅ ESPN spreads: ${spreads.length} games`);
        return spreads;
    }
    catch (error) {
        console.error('Error scraping ESPN spreads:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/espn-spreads', false, error.message);
        return [];
    }
};
exports.scrapeESPNSpreads = scrapeESPNSpreads;
// Scrape spreads from Sports Reference (free and reliable)
const scrapeSportsReferenceSpreads = async () => {
    try {
        const currentYear = new Date().getFullYear();
        const url = `https://www.sports-reference.com/cfb/years/${currentYear}-games.html`;
        console.log(`Scraping Sports Reference spreads: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const spreads = [];
        // Sports Reference table structure
        $('#games tbody tr').each((index, element) => {
            try {
                const $row = $(element);
                const cells = $row.find('td');
                if (cells.length >= 6) {
                    const awayTeam = $(cells[1]).text().trim();
                    const homeTeam = $(cells[5]).text().trim();
                    const spreadText = $(cells[7]).text().trim(); // Spread column
                    const spreadMatch = spreadText.match(/([-+]?\d+\.?\d*)/);
                    if (spreadMatch && awayTeam && homeTeam) {
                        const spreadValue = Math.abs(parseFloat(spreadMatch[1]));
                        const isHomeFavored = parseFloat(spreadMatch[1]) < 0;
                        spreads.push({
                            homeTeam,
                            awayTeam,
                            spread: spreadValue,
                            favoriteTeam: isHomeFavored ? homeTeam : awayTeam,
                            source: 'sports-reference'
                        });
                    }
                }
            }
            catch (error) {
                console.warn('Error parsing Sports Reference spread:', error);
            }
        });
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/sports-ref-spreads', true);
        console.log(`✅ Sports Reference spreads: ${spreads.length} games`);
        return spreads;
    }
    catch (error) {
        console.error('Error scraping Sports Reference spreads:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/sports-ref-spreads', false, error.message);
        return [];
    }
};
exports.scrapeSportsReferenceSpreads = scrapeSportsReferenceSpreads;
// Scrape spreads from Vegas Insider (comprehensive free spreads)
const scrapeVegasInsiderSpreads = async () => {
    try {
        const url = 'https://www.vegasinsider.com/college-football/odds/';
        console.log(`Scraping Vegas Insider spreads: ${url}`);
        const response = await axios_1.default.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        const $ = cheerio.load(response.data);
        const spreads = [];
        // Vegas Insider odds table structure
        $('.odds-table tr, .viTable tr').each((index, element) => {
            try {
                const $row = $(element);
                const cells = $row.find('td');
                if (cells.length >= 3) {
                    const gameInfo = $(cells[0]).text().trim();
                    const spreadInfo = $(cells[1]).text().trim();
                    // Parse team names from game info
                    const vsMatch = gameInfo.match(/(.+?)\s+@\s+(.+)/);
                    if (vsMatch) {
                        const awayTeam = vsMatch[1].trim();
                        const homeTeam = vsMatch[2].trim();
                        // Parse spread
                        const spreadMatch = spreadInfo.match(/([-+]?\d+\.?\d*)/);
                        if (spreadMatch) {
                            const spreadValue = Math.abs(parseFloat(spreadMatch[1]));
                            const isNegative = parseFloat(spreadMatch[1]) < 0;
                            spreads.push({
                                homeTeam,
                                awayTeam,
                                spread: spreadValue,
                                favoriteTeam: isNegative ? homeTeam : awayTeam,
                                source: 'vegas-insider'
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.warn('Error parsing Vegas Insider spread:', error);
            }
        });
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/vegas-insider-spreads', true);
        console.log(`✅ Vegas Insider spreads: ${spreads.length} games`);
        return spreads;
    }
    catch (error) {
        console.error('Error scraping Vegas Insider spreads:', error.message);
        await (0, apiUsageMonitor_1.logAPICall)('odds', '/scrape/vegas-insider-spreads', false, error.message);
        return [];
    }
};
exports.scrapeVegasInsiderSpreads = scrapeVegasInsiderSpreads;
// Combine spreads from all sources and pick the best ones
const scrapeAllSpreads = async () => {
    console.log('🎰 Scraping spreads from all free sources...');
    const allSpreads = [];
    // Try ESPN spreads
    try {
        const espnSpreads = await (0, exports.scrapeESPNSpreads)();
        allSpreads.push(...espnSpreads);
    }
    catch (error) {
        console.warn('ESPN spread scraping failed:', error);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Try Sports Reference spreads
    try {
        const sportsRefSpreads = await (0, exports.scrapeSportsReferenceSpreads)();
        allSpreads.push(...sportsRefSpreads);
    }
    catch (error) {
        console.warn('Sports Reference spread scraping failed:', error);
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Try Vegas Insider spreads
    try {
        const vegasSpreads = await (0, exports.scrapeVegasInsiderSpreads)();
        allSpreads.push(...vegasSpreads);
    }
    catch (error) {
        console.warn('Vegas Insider spread scraping failed:', error);
    }
    // Deduplicate by team matchup and prefer certain sources
    const sourcePreference = ['vegas-insider', 'sports-reference', 'espn'];
    const uniqueSpreads = allSpreads.filter((spread, index, self) => {
        const duplicate = self.find((s, i) => i !== index &&
            ((s.homeTeam === spread.homeTeam && s.awayTeam === spread.awayTeam) ||
                (s.homeTeam === spread.awayTeam && s.awayTeam === spread.homeTeam)));
        if (!duplicate)
            return true;
        // Keep the one from preferred source
        const spreadSourceIndex = sourcePreference.indexOf(spread.source);
        const duplicateSourceIndex = sourcePreference.indexOf(duplicate.source);
        return spreadSourceIndex < duplicateSourceIndex ||
            (spreadSourceIndex === duplicateSourceIndex && index < self.indexOf(duplicate));
    });
    console.log(`✅ Total unique spreads: ${uniqueSpreads.length}`);
    return uniqueSpreads;
};
exports.scrapeAllSpreads = scrapeAllSpreads;
// Normalize team names for matching
const normalizeTeamNameForMatching = (teamName) => {
    if (!teamName)
        return '';
    return teamName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .replace(/\b(university|college|state|tech)\b/g, '')
        .trim();
};
exports.normalizeTeamNameForMatching = normalizeTeamNameForMatching;
// Match scraped spreads to existing games
const matchSpreadToGames = (games, spreads) => {
    return games.map(game => {
        const gameHomeNorm = (0, exports.normalizeTeamNameForMatching)(game.home_team);
        const gameAwayNorm = (0, exports.normalizeTeamNameForMatching)(game.away_team);
        const matchingSpread = spreads.find(spread => {
            const spreadHomeNorm = (0, exports.normalizeTeamNameForMatching)(spread.homeTeam);
            const spreadAwayNorm = (0, exports.normalizeTeamNameForMatching)(spread.awayTeam);
            // Check if teams match (either direction)
            const homeMatch = gameHomeNorm.includes(spreadHomeNorm.split(' ')[0]) ||
                spreadHomeNorm.includes(gameHomeNorm.split(' ')[0]);
            const awayMatch = gameAwayNorm.includes(spreadAwayNorm.split(' ')[0]) ||
                spreadAwayNorm.includes(gameAwayNorm.split(' ')[0]);
            return homeMatch && awayMatch;
        });
        if (matchingSpread) {
            return {
                ...game,
                spread: matchingSpread.spread,
                favorite_team: matchingSpread.favoriteTeam,
                spread_source: matchingSpread.source
            };
        }
        return game;
    });
};
exports.matchSpreadToGames = matchSpreadToGames;
//# sourceMappingURL=spreadScraper.js.map