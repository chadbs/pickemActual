import { shouldSkipAPICall, logAPICall } from './apiUsageMonitor';
import { getTopGamesForWeek, getGameScores } from './cfbDataApi';
import { getNCAAFootballOdds, parseOddsData, matchOddsToGames } from './oddsApi';
import { scrapeGamesForWeek, scrapeAllSources } from './webScraper';
import { testESPNConnection, getESPNGamesForWeek } from './espnApi';

interface GameData {
  id?: string | number;
  home_team: string;
  away_team: string;
  start_date: string;
  startDate?: string; // For CFBD compatibility
  home_score?: number;
  away_score?: number;
  completed?: boolean;
  spread?: number;
  favorite_team?: string;
  source: 'cfbd' | 'espn' | 'scrape' | 'odds';
}

// Smart game fetcher that tries APIs first, falls back to scraping
export const fetchGamesWithFallback = async (year: number, week: number): Promise<GameData[]> => {
  console.log(`🔄 Fetching games for ${year} Week ${week} with smart fallback...`);
  
  let games: GameData[] = [];
  let oddsData: any[] = [];
  
  // Step 1: Try CFBD API first (if credits available)
  if (!(await shouldSkipAPICall('cfbd'))) {
    try {
      console.log('🎯 Trying CFBD API...');
      const cfbdGames = await getTopGamesForWeek(year, week);
      games = cfbdGames.map(game => ({ 
        ...game, 
        home_team: (game as any).home_team || (game as any).homeTeam,
        away_team: (game as any).away_team || (game as any).awayTeam,
        start_date: (game as any).start_date || (game as any).startDate,
        source: 'cfbd' as const 
      }));
      console.log(`✅ CFBD API: ${games.length} games`);
      await logAPICall('cfbd', `/games/week/${week}`, true);
    } catch (error: any) {
      console.warn('CFBD API failed:', error.message);
      await logAPICall('cfbd', `/games/week/${week}`, false, error.message);
    }
  } else {
    console.log('⏭️ Skipping CFBD API (low credits or high error rate)');
  }
  
  // Step 2: Try ESPN API if CFBD failed
  if (games.length === 0) {
    try {
      console.log('🔄 Trying ESPN API...');
      const espnAvailable = await testESPNConnection();
      if (espnAvailable) {
        const espnGames = await getESPNGamesForWeek(year, week);
        games = espnGames.map(game => ({ ...game, source: 'espn' as const }));
        console.log(`✅ ESPN API: ${games.length} games`);
      }
    } catch (error: any) {
      console.warn('ESPN API failed:', error.message);
    }
  }
  
  // Step 3: Fall back to web scraping if APIs failed
  if (games.length === 0) {
    try {
      console.log('🕷️ Falling back to web scraping...');
      const scrapedGames = await scrapeGamesForWeek(year, week);
      games = scrapedGames.map(game => ({ ...game, source: 'scrape' as const }));
      console.log(`✅ Web scraping: ${games.length} games`);
    } catch (error: any) {
      console.error('Web scraping failed:', error.message);
    }
  }
  
  // Step 4: Try to get odds data (if credits available)
  if (games.length > 0 && !(await shouldSkipAPICall('odds'))) {
    try {
      console.log('🎰 Trying to fetch odds...');
      const rawOdds = await getNCAAFootballOdds();
      oddsData = parseOddsData(rawOdds);
      console.log(`✅ Odds API: ${oddsData.length} games with odds`);
      await logAPICall('odds', '/odds', true);
    } catch (error: any) {
      console.warn('Odds API failed:', error.message);
      await logAPICall('odds', '/odds', false, error.message);
    }
  } else if (games.length > 0) {
    console.log('⏭️ Skipping Odds API (low credits or no games)');
  }
  
  // Step 5: Match odds to games if we have both
  if (games.length > 0 && oddsData.length > 0) {
    try {
      games = matchOddsToGames(games, oddsData);
      console.log(`🎯 Matched odds to ${games.filter(g => g.spread).length} games`);
    } catch (error: any) {
      console.warn('Error matching odds:', error.message);
    }
  }
  
  console.log(`🏁 Final result: ${games.length} games for Week ${week}`);
  return games;
};

// Smart score fetcher with fallback
export const fetchScoresWithFallback = async (year: number, week: number): Promise<GameData[]> => {
  console.log(`🔄 Fetching scores for ${year} Week ${week} with fallback...`);
  
  let completedGames: GameData[] = [];
  
  // Try CFBD API first (if credits available)
  if (!(await shouldSkipAPICall('cfbd'))) {
    try {
      console.log('🎯 Trying CFBD API for scores...');
      const cfbdScores = await getGameScores(year, week);
      completedGames = cfbdScores.map(game => ({
        id: game.id,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        start_date: game.startDate,
        home_score: game.homePoints,
        away_score: game.awayPoints,
        completed: game.completed,
        source: 'cfbd' as const
      }));
      console.log(`✅ CFBD scores: ${completedGames.length} completed games`);
      await logAPICall('cfbd', `/scores/week/${week}`, true);
    } catch (error: any) {
      console.warn('CFBD scores failed:', error.message);
      await logAPICall('cfbd', `/scores/week/${week}`, false, error.message);
    }
  } else {
    console.log('⏭️ Skipping CFBD scores API (low credits)');
  }
  
  // Fall back to web scraping if API failed
  if (completedGames.length === 0) {
    try {
      console.log('🕷️ Falling back to scraping for scores...');
      const scrapedGames = await scrapeAllSources();
      completedGames = scrapedGames.filter(game => game.completed);
      console.log(`✅ Scraped scores: ${completedGames.length} completed games`);
    } catch (error: any) {
      console.error('Score scraping failed:', error.message);
    }
  }
  
  return completedGames;
};

// Get data source status for monitoring
export const getDataSourceStatus = async (): Promise<{
  cfbd: { available: boolean; reason?: string };
  odds: { available: boolean; reason?: string };
  espn: { available: boolean; reason?: string };
  scraping: { available: boolean; reason?: string };
}> => {
  const status: {
    cfbd: { available: boolean; reason?: string };
    odds: { available: boolean; reason?: string };
    espn: { available: boolean; reason?: string };
    scraping: { available: boolean; reason?: string };
  } = {
    cfbd: { available: true },
    odds: { available: true },
    espn: { available: true },
    scraping: { available: true }
  };
  
  // Check CFBD API status
  if (await shouldSkipAPICall('cfbd')) {
    status.cfbd = { available: false, reason: 'Low credits or high error rate' };
  }
  
  // Check Odds API status
  if (await shouldSkipAPICall('odds')) {
    status.odds = { available: false, reason: 'Low credits or high error rate' };
  }
  
  // Test ESPN API
  try {
    const espnAvailable = await testESPNConnection();
    if (!espnAvailable) {
      status.espn = { available: false, reason: 'Connection test failed' };
    }
  } catch (error) {
    status.espn = { available: false, reason: 'Connection error' };
  }
  
  return status;
};

// Manual refresh with preferred source
export const refreshGameData = async (
  year: number, 
  week: number, 
  preferredSource: 'api' | 'scrape' = 'api'
): Promise<GameData[]> => {
  console.log(`🔄 Manual refresh for Week ${week} (preferred: ${preferredSource})`);
  
  if (preferredSource === 'scrape') {
    // Force web scraping
    try {
      const scrapedGames = await scrapeGamesForWeek(year, week);
      console.log(`✅ Manual scrape: ${scrapedGames.length} games`);
      return scrapedGames;
    } catch (error: any) {
      console.error('Manual scraping failed:', error.message);
      return [];
    }
  } else {
    // Use smart fallback (API first)
    return fetchGamesWithFallback(year, week);
  }
};