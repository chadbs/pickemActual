import axios from 'axios';
import { CFBDGame } from '../../../shared/types';

const CFBD_API_BASE = 'https://api.collegefootballdata.com';

const getCfbdApi = () => {
  const CFBD_API_KEY = process.env.CFBD_API_KEY;
  
  if (!CFBD_API_KEY) {
    throw new Error('CFBD_API_KEY environment variable is not set');
  }
  
  return axios.create({
    baseURL: CFBD_API_BASE,
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
};

export interface CFBDGameResponse {
  id: number;
  season: number;
  week: number;
  season_type: string;
  start_date: string;
  start_time_tbd: boolean;
  neutral_site: boolean;
  conference_game: boolean;
  attendance?: number;
  venue_id?: number;
  venue?: string;
  home_team: string;
  home_conference?: string;
  home_points?: number;
  away_team: string;
  away_conference?: string;
  away_points?: number;
  completed: boolean;
}

export interface CFBDTeam {
  id: number;
  school: string;
  mascot: string;
  abbreviation: string;
  alt_name_1?: string;
  alt_name_2?: string;
  alt_name_3?: string;
  classification: string;
  conference: string;
  division?: string;
  color: string;
  alt_color: string;
  logos: string[];
}

export interface CFBDRanking {
  season: number;
  season_type: string;
  week: number;
  poll: string;
  ranks: Array<{
    rank: number;
    school: string;
    conference: string;
    first_place_votes?: number;
    points?: number;
  }>;
}

// Get games for a specific week and season
export const getGamesForWeek = async (year: number, week: number): Promise<CFBDGameResponse[]> => {
  try {
    const cfbdApi = getCfbdApi();
    const response = await cfbdApi.get('/games', {
      params: {
        year,
        week,
        seasonType: 'regular'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching games from CFBD API:', error);
    throw new Error('Failed to fetch games from College Football Data API');
  }
};

// Get all teams
export const getTeams = async (year: number): Promise<CFBDTeam[]> => {
  try {
    const cfbdApi = getCfbdApi();
    const response = await cfbdApi.get('/teams', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching teams from CFBD API:', error);
    throw new Error('Failed to fetch teams from College Football Data API');
  }
};

// Get rankings for a week
export const getRankings = async (year: number, week: number): Promise<CFBDRanking[]> => {
  try {
    const cfbdApi = getCfbdApi();
    const response = await cfbdApi.get('/rankings', {
      params: {
        year,
        week,
        seasonType: 'regular'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching rankings from CFBD API:', error);
    return []; // Rankings are optional, don't fail
  }
};

// Get game scores (for updating completed games)
export const getGameScores = async (year: number, week: number): Promise<CFBDGameResponse[]> => {
  try {
    const cfbdApi = getCfbdApi();
    const response = await cfbdApi.get('/games', {
      params: {
        year,
        week,
        seasonType: 'regular'
      }
    });
    
    // Filter for completed games only
    return response.data.filter((game: CFBDGameResponse) => game.completed);
  } catch (error) {
    console.error('Error fetching game scores from CFBD API:', error);
    throw new Error('Failed to fetch game scores from College Football Data API');
  }
};

// Check if a team is one of our favorite teams
export const isFavoriteTeam = (teamName: string): boolean => {
  if (!teamName) return false;
  
  const normalizedTeamName = teamName.toLowerCase().trim();
  
  // Exact matches for our favorite teams
  const favoriteTeams = [
    'colorado', 'colorado buffaloes', 'cu', 'buffs',
    'colorado state', 'colorado state rams', 'csu', 'rams', 
    'nebraska', 'nebraska cornhuskers', 'huskers', 'nu',
    'michigan', 'michigan wolverines', 'wolverines', 'um'
  ];
  
  // First check for exact matches
  if (favoriteTeams.includes(normalizedTeamName)) {
    return true;
  }
  
  // Special cases to avoid false positives like "Central Michigan"
  // Only match "Michigan" if it's not preceded by another word
  if (normalizedTeamName === 'michigan' || 
      normalizedTeamName === 'michigan wolverines' ||
      normalizedTeamName === 'wolverines' ||
      normalizedTeamName === 'um') {
    return true;
  }
  
  // Check Colorado (but not "University of Colorado" variations that might cause confusion)
  if (normalizedTeamName === 'colorado' ||
      normalizedTeamName === 'colorado buffaloes' ||
      normalizedTeamName === 'cu' ||
      normalizedTeamName === 'buffs') {
    return true;
  }
  
  // Check Colorado State
  if (normalizedTeamName === 'colorado state' ||
      normalizedTeamName === 'colorado state rams' ||
      normalizedTeamName === 'csu') {
    return true;
  }
  
  // Check Nebraska
  if (normalizedTeamName === 'nebraska' ||
      normalizedTeamName === 'nebraska cornhuskers' ||
      normalizedTeamName === 'huskers' ||
      normalizedTeamName === 'nu') {
    return true;
  }
  
  return false;
};

// Get rank value for a team from rankings data
const getRankValue = (teamName: string, rankings: CFBDRanking[]): number => {
  for (const poll of rankings) {
    if (poll.poll === 'AP Top 25') {
      const rank = poll.ranks.find(r => r.school === teamName);
      if (rank) return rank.rank;
    }
  }
  return 99; // Unranked
};

// Get top games based on rankings and our favorite teams
export const getTopGamesForWeek = async (year: number, week: number): Promise<CFBDGameResponse[]> => {
  try {
    const games = await getGamesForWeek(year, week);
    const rankings = await getRankings(year, week);
    
    // Create a map of ranked teams
    const rankedTeams = new Set<string>();
    rankings.forEach(poll => {
      if (poll.poll === 'AP Top 25') {
        poll.ranks.forEach(rank => rankedTeams.add(rank.school));
      }
    });
    
    // Filter for FBS games only (exclude Division II and III)
    // Cast to any to work with dynamic API response structure
    const fbsGames = games.filter((game: any) => {
      if (!game.homeTeam || !game.awayTeam) return false;
      
      // Only include FBS games (classification "fbs" or null for older data)
      const isFBS = (!game.homeClassification || game.homeClassification === 'fbs') &&
                   (!game.awayClassification || game.awayClassification === 'fbs');
      
      return isFBS;
    });
    
    console.log(`Found ${games.length} total games, filtered to ${fbsGames.length} FBS games`);
    console.log('Sample FBS games:', fbsGames.slice(0, 3).map((g: any) => `${g.awayTeam} @ ${g.homeTeam}`));
    
    // Create list of well-known/popular programs for better game selection
    const popularPrograms = new Set([
      // Traditional Powers
      'Alabama', 'Georgia', 'Texas', 'Oklahoma', 'USC', 'Notre Dame', 'Michigan', 'Ohio State',
      'Penn State', 'Florida', 'LSU', 'Auburn', 'Tennessee', 'Florida State', 'Miami', 'Clemson',
      // Big Programs
      'Oregon', 'Washington', 'UCLA', 'Stanford', 'Wisconsin', 'Iowa', 'Michigan State', 'Nebraska',
      'Colorado', 'Colorado State', 'Utah', 'Arizona State', 'Arizona', 'BYU', 'TCU', 'Baylor',
      'Texas A&M', 'Ole Miss', 'Mississippi State', 'Arkansas', 'Kentucky', 'Vanderbilt', 'South Carolina',
      'North Carolina', 'NC State', 'Duke', 'Wake Forest', 'Virginia', 'Virginia Tech', 'Louisville',
      // Other Notable Programs
      'Kansas', 'Kansas State', 'Oklahoma State', 'Texas Tech', 'Houston', 'Cincinnati', 'UCF',
      'West Virginia', 'Pittsburgh', 'Syracuse', 'Boston College', 'Maryland', 'Rutgers'
    ]);
    
    // Score games based on criteria - prioritize favorite teams and top matchups
    const scoredGames = fbsGames.map((game: any) => {
      let score = 0;
      
      // HIGHEST PRIORITY: Favorite team games (always include)
      if (isFavoriteTeam((game as any).homeTeam) || isFavoriteTeam((game as any).awayTeam)) {
        score += 10000; // Much higher priority
        console.log(`Favorite team game: ${(game as any).awayTeam} @ ${(game as any).homeTeam}`);
      }
      
      // HIGH PRIORITY: Both teams ranked (top matchups)
      if (rankedTeams.has((game as any).homeTeam) && rankedTeams.has((game as any).awayTeam)) {
        score += 5000;
        const homeRank = getRankValue((game as any).homeTeam, rankings);
        const awayRank = getRankValue((game as any).awayTeam, rankings);
        console.log(`Ranked vs ranked: #${homeRank} ${(game as any).homeTeam} vs #${awayRank} ${(game as any).awayTeam}`);
      }
      
      // MEDIUM-HIGH: One team ranked
      else if (rankedTeams.has((game as any).homeTeam) || rankedTeams.has((game as any).awayTeam)) {
        const rankedTeam = rankedTeams.has((game as any).homeTeam) ? (game as any).homeTeam : (game as any).awayTeam;
        const unrankedTeam = rankedTeams.has((game as any).homeTeam) ? (game as any).awayTeam : (game as any).homeTeam;
        const rank = getRankValue(rankedTeam, rankings);
        
        // Higher points for better ranked teams
        score += Math.max(500, 1000 - (rank * 20));
        
        // Extra bonus if unranked team is also popular/well-known
        if (popularPrograms.has(unrankedTeam)) {
          score += 300;
        }
      }
      
      // MEDIUM: Both teams are popular programs (even if unranked)
      else if (popularPrograms.has((game as any).homeTeam) && popularPrograms.has((game as any).awayTeam)) {
        score += 400;
        console.log(`Popular matchup: ${(game as any).awayTeam} @ ${(game as any).homeTeam}`);
      }
      
      // MEDIUM-LOW: One team is popular program
      else if (popularPrograms.has((game as any).homeTeam) || popularPrograms.has((game as any).awayTeam)) {
        score += 200;
      }
      
      // Conference game bonus
      if ((game as any).conferenceGame) {
        score += 50;
      }
      
      // Major conferences get bonus points
      const majorConferences = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'American Athletic'];
      if (majorConferences.includes((game as any).homeConference || '') || 
          majorConferences.includes((game as any).awayConference || '')) {
        score += 100;
      }
      
      // Convert field names to snake_case for consistency with our database
      return { 
        ...game,
        home_team: (game as any).homeTeam,
        away_team: (game as any).awayTeam,
        start_date: (game as any).startDate,
        home_conference: (game as any).homeConference,
        away_conference: (game as any).awayConference,
        conference_game: (game as any).conferenceGame,
        score 
      };
    });
    
    // Sort by score (descending) and return top games
    const topGames = scoredGames
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Get top 20 games for admin selection
      .map(({ score, ...game }) => ({ ...game, selection_score: score })); // Keep score for admin interface
    
    console.log(`Top 20 games for selection:`, topGames.slice(0, 10).map((g: any) => `${g.away_team} @ ${g.home_team} (${g.selection_score})`));
    
    return topGames;
    
  } catch (error) {
    console.error('Error getting top games:', error);
    throw error;
  }
};