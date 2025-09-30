import axios from 'axios';
import * as cheerio from 'cheerio';
import { logAPICall } from './apiUsageMonitor';

interface SpreadData {
  homeTeam: string;
  awayTeam: string;
  spread: number;
  favoriteTeam: string;
  source: string;
}

// Scrape spreads from ESPN (free)
export const scrapeESPNSpreads = async (): Promise<SpreadData[]> => {
  try {
    const url = 'https://www.espn.com/college-football/lines';
    console.log(`Scraping ESPN spreads: ${url}`);

    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      }
    });

    const $ = cheerio.load(response.data);
    const spreads: SpreadData[] = [];

    // ESPN betting lines structure - try multiple selectors
    const lineSelectors = [
      '.oddsgame',
      '.Table__TR',
      '.betting-odds-row',
      '.odds-row',
      '[data-testid="odds-row"]',
      '.game-odds'
    ];

    for (const selector of lineSelectors) {
      $(selector).each((index, element) => {
        try {
          const $game = $(element);

          // Look for team names
          const teams = $game.find('.team-name, .AnchorLink, .Table__Team, .team-displayname, .competitor-name').map((i, el) =>
            $(el).text().trim()
          ).get().filter(name => name.length > 0);

          // Look for spread numbers (usually +/- followed by number)
          const spreadTexts = $game.find('.line, .spread, .Table__TD, .betting-line, .point-spread').map((i, el) =>
            $(el).text().trim()
          ).get();

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
        } catch (error) {
          console.warn('Error parsing ESPN spread:', error);
        }
      });

      if (spreads.length > 0) break;
    }

    await logAPICall('odds', '/scrape/espn-spreads', true);
    console.log(`✅ ESPN spreads: ${spreads.length} games`);
    return spreads;

  } catch (error: any) {
    console.error('Error scraping ESPN spreads:', error.message);
    await logAPICall('odds', '/scrape/espn-spreads', false, error.message);
    return [];
  }
};

// Scrape spreads from Sports Reference (free and reliable)
export const scrapeSportsReferenceSpreads = async (): Promise<SpreadData[]> => {
  try {
    const currentYear = new Date().getFullYear();
    const url = `https://www.sports-reference.com/cfb/years/${currentYear}-games.html`;
    console.log(`Scraping Sports Reference spreads: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const spreads: SpreadData[] = [];
    
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
      } catch (error) {
        console.warn('Error parsing Sports Reference spread:', error);
      }
    });
    
    await logAPICall('odds', '/scrape/sports-ref-spreads', true);
    console.log(`✅ Sports Reference spreads: ${spreads.length} games`);
    return spreads;
    
  } catch (error: any) {
    console.error('Error scraping Sports Reference spreads:', error.message);
    await logAPICall('odds', '/scrape/sports-ref-spreads', false, error.message);
    return [];
  }
};

// Scrape spreads from Vegas Insider (comprehensive free spreads)
export const scrapeVegasInsiderSpreads = async (): Promise<SpreadData[]> => {
  try {
    const url = 'https://www.vegasinsider.com/college-football/odds/';
    console.log(`Scraping Vegas Insider spreads: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    const $ = cheerio.load(response.data);
    const spreads: SpreadData[] = [];
    
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
      } catch (error) {
        console.warn('Error parsing Vegas Insider spread:', error);
      }
    });
    
    await logAPICall('odds', '/scrape/vegas-insider-spreads', true);
    console.log(`✅ Vegas Insider spreads: ${spreads.length} games`);
    return spreads;
    
  } catch (error: any) {
    console.error('Error scraping Vegas Insider spreads:', error.message);
    await logAPICall('odds', '/scrape/vegas-insider-spreads', false, error.message);
    return [];
  }
};

// Add fallback spread generation for common games
export const generateFallbackSpreads = (games: any[]): SpreadData[] => {
  const fallbackSpreads: SpreadData[] = [];

  // Common spread patterns for popular teams
  const favoriteTeams = ['Alabama', 'Georgia', 'Texas', 'Oklahoma', 'Michigan', 'Ohio State', 'USC', 'Notre Dame', 'Oregon', 'Clemson', 'LSU', 'Florida', 'Penn State'];

  for (const game of games) {
    if (!game.home_team || !game.away_team) continue;

    const homeIsFavorite = favoriteTeams.some(fav =>
      game.home_team.toLowerCase().includes(fav.toLowerCase())
    );
    const awayIsFavorite = favoriteTeams.some(fav =>
      game.away_team.toLowerCase().includes(fav.toLowerCase())
    );

    let spread = 0;
    let favoriteTeam = '';

    if (homeIsFavorite && !awayIsFavorite) {
      spread = 10.5; // Home favorite
      favoriteTeam = game.home_team;
    } else if (awayIsFavorite && !homeIsFavorite) {
      spread = 7.5; // Away favorite (smaller due to road game)
      favoriteTeam = game.away_team;
    } else if (homeIsFavorite && awayIsFavorite) {
      spread = 3.5; // Both good teams, slight home advantage
      favoriteTeam = game.home_team;
    } else {
      spread = 3.0; // Pick'em with slight home advantage
      favoriteTeam = game.home_team;
    }

    fallbackSpreads.push({
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      spread,
      favoriteTeam,
      source: 'generated'
    });
  }

  return fallbackSpreads;
};

// Combine spreads from all sources and pick the best ones
export const scrapeAllSpreads = async (fallbackGames?: any[]): Promise<SpreadData[]> => {
  console.log('🎰 Scraping spreads from all free sources...');

  const allSpreads: SpreadData[] = [];
  let successfulSources = 0;

  // Try ESPN spreads
  try {
    const espnSpreads = await scrapeESPNSpreads();
    if (espnSpreads.length > 0) {
      allSpreads.push(...espnSpreads);
      successfulSources++;
    }
  } catch (error) {
    console.warn('ESPN spread scraping failed:', error);
  }

  // Small delay between requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Try Sports Reference spreads
  try {
    const sportsRefSpreads = await scrapeSportsReferenceSpreads();
    if (sportsRefSpreads.length > 0) {
      allSpreads.push(...sportsRefSpreads);
      successfulSources++;
    }
  } catch (error) {
    console.warn('Sports Reference spread scraping failed:', error);
  }

  // If no successful sources and we have games, generate fallback spreads
  if (successfulSources === 0 && fallbackGames && fallbackGames.length > 0) {
    console.log('🎲 No spread sources available, generating fallback spreads...');
    const fallbackSpreads = generateFallbackSpreads(fallbackGames);
    allSpreads.push(...fallbackSpreads);
  }

  // Deduplicate by team matchup and prefer certain sources
  const sourcePreference = ['sports-reference', 'espn', 'generated'];
  const uniqueSpreads = allSpreads.filter((spread, index, self) => {
    const duplicate = self.find((s, i) => i !== index &&
      ((s.homeTeam === spread.homeTeam && s.awayTeam === spread.awayTeam) ||
       (s.homeTeam === spread.awayTeam && s.awayTeam === spread.homeTeam))
    );

    if (!duplicate) return true;

    // Keep the one from preferred source
    const spreadSourceIndex = sourcePreference.indexOf(spread.source);
    const duplicateSourceIndex = sourcePreference.indexOf(duplicate.source);

    return spreadSourceIndex < duplicateSourceIndex ||
           (spreadSourceIndex === duplicateSourceIndex && index < self.indexOf(duplicate));
  });

  console.log(`✅ Total unique spreads: ${uniqueSpreads.length} (from ${successfulSources} sources + ${allSpreads.filter(s => s.source === 'generated').length} generated)`);
  return uniqueSpreads;
};

// Normalize team names for matching
export const normalizeTeamNameForMatching = (teamName: string): string => {
  if (!teamName) return '';

  return teamName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&'-]/g, '')
    .replace(/\b(university|college|state|tech|univ)\b/gi, '')
    .replace(/\b(st|saint)\b/gi, 'state')
    .replace(/\b(north|south|east|west)\b/gi, (match) => match.charAt(0))
    .replace(/\b(florida)\b/gi, 'fla')
    .replace(/\b(california)\b/gi, 'cal')
    .replace(/\b(southern)\b/gi, 's')
    .replace(/\b(northern)\b/gi, 'n')
    .replace(/\b(eastern)\b/gi, 'e')
    .replace(/\b(western)\b/gi, 'w')
    .replace(/\b(central)\b/gi, 'c')
    .replace(/\b(&)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Match scraped spreads to existing games
export const matchSpreadToGames = (games: any[], spreads: SpreadData[]): any[] => {
  return games.map(game => {
    const gameHomeNorm = normalizeTeamNameForMatching(game.home_team);
    const gameAwayNorm = normalizeTeamNameForMatching(game.away_team);

    let bestMatch: SpreadData | null = null;
    let bestScore = 0;

    // Try to find the best matching spread
    for (const spread of spreads) {
      const spreadHomeNorm = normalizeTeamNameForMatching(spread.homeTeam);
      const spreadAwayNorm = normalizeTeamNameForMatching(spread.awayTeam);

      let score = 0;

      // Exact match gets highest score
      if (gameHomeNorm === spreadHomeNorm && gameAwayNorm === spreadAwayNorm) {
        score = 100;
      }
      // Reverse match (teams swapped)
      else if (gameHomeNorm === spreadAwayNorm && gameAwayNorm === spreadHomeNorm) {
        score = 95;
      }
      // Partial matches
      else {
        const homeWords = gameHomeNorm.split(' ');
        const awayWords = gameAwayNorm.split(' ');
        const spreadHomeWords = spreadHomeNorm.split(' ');
        const spreadAwayWords = spreadAwayNorm.split(' ');

        // Count word matches
        let homeWordMatches = 0;
        let awayWordMatches = 0;

        for (const word of homeWords) {
          if (word.length > 2 && spreadHomeWords.some(sw => sw.includes(word) || word.includes(sw))) {
            homeWordMatches++;
          }
        }

        for (const word of awayWords) {
          if (word.length > 2 && spreadAwayWords.some(sw => sw.includes(word) || word.includes(sw))) {
            awayWordMatches++;
          }
        }

        // Calculate partial match score
        if (homeWordMatches > 0 && awayWordMatches > 0) {
          score = (homeWordMatches + awayWordMatches) * 10;
        }
      }

      if (score > bestScore && score >= 30) { // Minimum threshold for matching
        bestScore = score;
        bestMatch = spread;
      }
    }

    if (bestMatch) {
      console.log(`✅ Matched spread: ${game.away_team} @ ${game.home_team} -> ${bestMatch.favoriteTeam} -${bestMatch.spread} (score: ${bestScore})`);
      return {
        ...game,
        spread: bestMatch.spread,
        favorite_team: bestMatch.favoriteTeam,
        spread_source: bestMatch.source
      };
    }

    return game;
  });
};