import axios from 'axios';
import { logAPICall } from './apiUsageMonitor';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';

interface ESPNGame {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      completed: boolean;
    };
  };
  competitions: Array<{
    id: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
      };
      homeAway: string;
      score: string;
    }>;
    odds?: Array<{
      details: string;
      spread: number;
    }>;
  }>;
}

interface ESPNScoreboardResponse {
  events: ESPNGame[];
  week: {
    number: number;
  };
  season: {
    year: number;
    type: number;
  };
}

// Get games for a specific week from ESPN (free alternative)
export const getESPNGamesForWeek = async (year: number, week: number): Promise<any[]> => {
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
        response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
          }
        });
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    if (!response) {
      await logAPICall('cfbd', `/espn/week/${week}`, false, (lastError as any)?.message);
      throw lastError;
    }
    
    const data: ESPNScoreboardResponse = response.data;
    await logAPICall('cfbd', `/espn/week/${week}`, true);
    
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
    
  } catch (error: any) {
    console.error('Error fetching games from ESPN:', (error as any).message);
    await logAPICall('cfbd', `/espn/week/${week}`, false, (error as any).message);
    throw error;
  }
};

// Get current week games (for live scores)
export const getESPNCurrentGames = async (): Promise<any[]> => {
  try {
    const response = await axios.get(`${ESPN_API_BASE}/scoreboard`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
      }
    });
    
    const data: ESPNScoreboardResponse = response.data;
    await logAPICall('cfbd', '/espn/current', true);
    
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
    
  } catch (error: any) {
    console.error('Error fetching current games from ESPN:', (error as any).message);
    await logAPICall('cfbd', '/espn/current', false, (error as any).message);
    return [];
  }
};

// Check if ESPN API is available
export const testESPNConnection = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${ESPN_API_BASE}/scoreboard`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CFBPickem/1.0)'
      }
    });
    
    await logAPICall('cfbd', '/espn/test', true);
    return response.status === 200;
  } catch (error: any) {
    await logAPICall('cfbd', '/espn/test', false, (error as any).message);
    return false;
  }
};