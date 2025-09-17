import express from 'express';
import { refreshGameData, getDataSourceStatus } from '../services/hybridDataFetcher';
import { scrapeGamesForWeek } from '../services/webScraper';
import { scrapeAllSpreads, matchSpreadToGames } from '../services/spreadScraper';
import { runQuery, getQuery, allQuery } from '../database/database';

const router = express.Router();

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
    let weekData: any;
    if (!week) {
      weekData = await getQuery(`
        SELECT * FROM weeks 
        WHERE is_active = 1 AND season_year = ?
        ORDER BY week_number DESC LIMIT 1
      `, [targetYear]);
      
      if (!weekData) {
        return res.status(400).json({ 
          error: 'No active week found and no week specified' 
        });
      }
    } else {
      weekData = await getQuery(`
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
    await runQuery('DELETE FROM games WHERE week_id = ?', [weekData.id]);
    console.log(`Cleared existing games for Week ${weekData.week_number}`);
    
    // Scrape new games
    let scrapedGames = await scrapeGamesForWeek(targetYear, weekData.week_number);
    
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
      const scrapedSpreads = await scrapeAllSpreads();
      if (scrapedSpreads.length > 0) {
        scrapedGames = matchSpreadToGames(scrapedGames, scrapedSpreads);
        spreadsAdded = scrapedGames.filter(g => g.spread).length;
        console.log(`✅ Added spreads to ${spreadsAdded} games`);
      }
    } catch (error) {
      console.warn('Spread scraping failed, continuing without spreads:', error);
    }
    
    // Store scraped games in database
    let storedCount = 0;
    for (const game of scrapedGames.slice(0, 8)) { // Limit to 8 games
      try {
        await runQuery(`
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
      } catch (error) {
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
    
  } catch (error: any) {
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
    const status = await getDataSourceStatus();
    res.json({
      sources: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
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
    
    const games = await refreshGameData(targetYear, targetWeek, preferredSource);
    
    res.json({
      message: `Games refreshed for Week ${targetWeek}`,
      week: targetWeek,
      year: targetYear,
      gamesFound: games.length,
      source: preferredSource,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
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
    let games: any[];
    if (targetWeek) {
      const weekData: any = await getQuery(`
        SELECT * FROM weeks 
        WHERE week_number = ? AND season_year = ?
      `, [targetWeek, targetYear]);
      
      if (!weekData) {
        return res.status(400).json({ 
          error: `Week ${targetWeek} of ${targetYear} not found` 
        });
      }
      
      games = await allQuery(`
        SELECT * FROM games WHERE week_id = ?
      `, [weekData.id]);
    } else {
      // Get all games without spreads
      games = await allQuery(`
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
    const scrapedSpreads = await scrapeAllSpreads();
    
    if (scrapedSpreads.length === 0) {
      return res.json({
        message: 'No spreads found via scraping',
        updated: 0,
        sources: ['espn', 'sports-reference', 'vegas-insider']
      });
    }
    
    // Match and update spreads
    const gamesWithSpreads = matchSpreadToGames(games, scrapedSpreads);
    
    let updatedCount = 0;
    for (const game of gamesWithSpreads) {
      if (game.spread && game.favorite_team) {
        try {
          await runQuery(`
            UPDATE games 
            SET spread = ?, favorite_team = ? 
            WHERE id = ?
          `, [game.spread, game.favorite_team, game.id]);
          updatedCount++;
        } catch (error) {
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
    
  } catch (error: any) {
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

export default router;