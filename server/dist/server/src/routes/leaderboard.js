"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../database/database");
const router = express_1.default.Router();
// Get current week leaderboard
router.get('/weekly', async (req, res) => {
    try {
        const { week, year } = req.query;
        let whereClause = '';
        let params = [];
        if (week && year) {
            whereClause = 'WHERE w.week_number = ? AND w.season_year = ?';
            params = [week, year];
        }
        else {
            whereClause = 'WHERE w.is_active = 1';
        }
        const leaderboard = await (0, database_1.allQuery)(`SELECT 
         u.id as user_id,
         u.name,
         u.is_admin,
         ws.correct_picks,
         ws.total_picks,
         ws.percentage,
         ws.weekly_rank,
         w.week_number,
         w.season_year,
         COUNT(DISTINCT g.id) as available_games,
         COUNT(DISTINCT p.id) as picks_made
       FROM users u
       LEFT JOIN weekly_scores ws ON u.id = ws.user_id
       LEFT JOIN weeks w ON ws.week_id = w.id
       LEFT JOIN games g ON g.week_id = w.id
       LEFT JOIN picks p ON p.user_id = u.id AND p.game_id = g.id
       ${whereClause}
       GROUP BY u.id, u.name, ws.correct_picks, ws.total_picks, ws.percentage, ws.weekly_rank, w.week_number, w.season_year
       ORDER BY ws.percentage DESC NULLS LAST, ws.correct_picks DESC NULLS LAST, u.name ASC`, params);
        // If no weekly scores exist yet, show basic user info with pick counts
        if (leaderboard.length === 0 || leaderboard.every(entry => entry.correct_picks === null)) {
            const basicLeaderboard = await (0, database_1.allQuery)(`SELECT 
           u.id as user_id,
           u.name,
           u.is_admin,
           COUNT(DISTINCT p.id) as picks_made,
           COUNT(DISTINCT g.id) as available_games,
           w.week_number,
           w.season_year,
           CASE 
             WHEN COUNT(DISTINCT g.id) > 0 
             THEN ROUND((COUNT(DISTINCT p.id) * 100.0) / COUNT(DISTINCT g.id), 1)
             ELSE 0 
           END as completion_percentage
         FROM users u
         LEFT JOIN picks p ON u.id = p.user_id
         LEFT JOIN games g ON p.game_id = g.id
         LEFT JOIN weeks w ON g.week_id = w.id
         ${whereClause}
         GROUP BY u.id, u.name, w.week_number, w.season_year
         ORDER BY completion_percentage DESC, picks_made DESC, u.name ASC`, params);
            return res.json(basicLeaderboard);
        }
        res.json(leaderboard);
    }
    catch (error) {
        console.error('Error fetching weekly leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch weekly leaderboard' });
    }
});
// Get season leaderboard
router.get('/season', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Only show users that actually exist in the users table
        const leaderboard = await (0, database_1.allQuery)(`SELECT 
         u.id as user_id,
         u.name,
         u.is_admin,
         ss.total_correct,
         ss.total_picks,
         ss.season_percentage,
         ss.season_rank,
         ss.season_year,
         COUNT(DISTINCT w.id) as weeks_participated,
         AVG(ws.percentage) as avg_weekly_percentage,
         MAX(ws.percentage) as best_week_percentage,
         MIN(ws.percentage) as worst_week_percentage
       FROM users u
       LEFT JOIN season_standings ss ON u.id = ss.user_id AND ss.season_year = ?
       LEFT JOIN weekly_scores ws ON u.id = ws.user_id
       LEFT JOIN weeks w ON ws.week_id = w.id AND w.season_year = ?
       GROUP BY u.id, u.name, ss.total_correct, ss.total_picks, ss.season_percentage, ss.season_rank
       ORDER BY ss.season_percentage DESC NULLS LAST, ss.total_correct DESC NULLS LAST, u.name ASC`, [currentYear, currentYear]);
        res.json(leaderboard);
    }
    catch (error) {
        console.error('Error fetching season leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch season leaderboard' });
    }
});
// Get combined leaderboard (current week + season stats)
router.get('/combined', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        // Only show users that currently exist in the users table
        const combined = await (0, database_1.allQuery)(`SELECT 
         u.id as user_id,
         u.name,
         u.is_admin,
         u.created_at,
         
         -- Current week stats
         ws.correct_picks as week_correct,
         ws.total_picks as week_total,
         ws.percentage as week_percentage,
         ws.weekly_rank,
         w.week_number as current_week,
         
         -- Season stats  
         ss.total_correct as season_correct,
         ss.total_picks as season_total,
         ss.season_percentage,
         ss.season_rank,
         
         -- Additional metrics
         COUNT(DISTINCT ws2.id) as weeks_played,
         AVG(ws2.percentage) as avg_weekly_percentage,
         MAX(ws2.percentage) as best_week,
         
         -- Recent performance (last 3 weeks)
         (
           SELECT AVG(ws3.percentage)
           FROM weekly_scores ws3
           JOIN weeks w3 ON ws3.week_id = w3.id
           WHERE ws3.user_id = u.id 
             AND w3.season_year = ?
           ORDER BY w3.week_number DESC
           LIMIT 3
         ) as recent_avg
         
       FROM users u
       LEFT JOIN weekly_scores ws ON u.id = ws.user_id
       LEFT JOIN weeks w ON ws.week_id = w.id AND w.is_active = 1
       LEFT JOIN season_standings ss ON u.id = ss.user_id AND ss.season_year = ?
       LEFT JOIN weekly_scores ws2 ON u.id = ws2.user_id
       LEFT JOIN weeks w2 ON ws2.week_id = w2.id AND w2.season_year = ?
       
       GROUP BY u.id, u.name, ws.correct_picks, ws.total_picks, ws.percentage, ws.weekly_rank, 
                w.week_number, ss.total_correct, ss.total_picks, ss.season_percentage, ss.season_rank
       ORDER BY 
         CASE WHEN ss.season_percentage IS NOT NULL THEN ss.season_percentage ELSE 0 END DESC,
         CASE WHEN ws.percentage IS NOT NULL THEN ws.percentage ELSE 0 END DESC,
         u.name ASC`, [currentYear, currentYear, currentYear]);
        res.json(combined);
    }
    catch (error) {
        console.error('Error fetching combined leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch combined leaderboard' });
    }
});
// Get user performance history
router.get('/user/:userId/history', async (req, res) => {
    try {
        const { userId } = req.params;
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Ensure the requested user exists before showing history
        const userExists = await (0, database_1.getQuery)('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!userExists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const history = await (0, database_1.allQuery)(`SELECT 
         w.week_number,
         w.season_year,
         w.deadline,
         ws.correct_picks,
         ws.total_picks,
         ws.percentage,
         ws.weekly_rank,
         COUNT(DISTINCT u2.id) as total_participants
       FROM weeks w
       LEFT JOIN weekly_scores ws ON w.id = ws.week_id AND ws.user_id = ?
       LEFT JOIN weekly_scores ws2 ON w.id = ws2.week_id
       INNER JOIN users u2 ON ws2.user_id = u2.id
       WHERE w.season_year = ?
       GROUP BY w.id, w.week_number, w.season_year, w.deadline, ws.correct_picks, ws.total_picks, ws.percentage, ws.weekly_rank
       ORDER BY w.week_number ASC`, [userId, currentYear]);
        // Calculate running totals and trends
        let runningCorrect = 0;
        let runningTotal = 0;
        const historyWithTrends = history.map((week, index) => {
            if (week.correct_picks !== null) {
                runningCorrect += week.correct_picks;
                runningTotal += week.total_picks;
            }
            return {
                ...week,
                running_correct: runningCorrect,
                running_total: runningTotal,
                running_percentage: runningTotal > 0 ? (runningCorrect / runningTotal) * 100 : 0,
                is_improvement: index > 0 && week.percentage !== null && history[index - 1].percentage !== null
                    ? week.percentage > history[index - 1].percentage
                    : null
            };
        });
        res.json(historyWithTrends);
    }
    catch (error) {
        console.error('Error fetching user history:', error);
        res.status(500).json({ error: 'Failed to fetch user history' });
    }
});
// Get head-to-head comparison
router.get('/head-to-head/:userId1/:userId2', async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Get both users' weekly performances - ensure both users exist
        const comparison = await (0, database_1.allQuery)(`SELECT 
         w.week_number,
         w.season_year,
         ws1.correct_picks as user1_correct,
         ws1.total_picks as user1_total,
         ws1.percentage as user1_percentage,
         ws1.weekly_rank as user1_rank,
         ws2.correct_picks as user2_correct,
         ws2.total_picks as user2_total,
         ws2.percentage as user2_percentage,
         ws2.weekly_rank as user2_rank,
         u1.name as user1_name,
         u2.name as user2_name
       FROM weeks w
       LEFT JOIN weekly_scores ws1 ON w.id = ws1.week_id AND ws1.user_id = ?
       LEFT JOIN weekly_scores ws2 ON w.id = ws2.week_id AND ws2.user_id = ?
       LEFT JOIN users u1 ON ws1.user_id = u1.id
       LEFT JOIN users u2 ON ws2.user_id = u2.id
       WHERE w.season_year = ? 
         AND (ws1.user_id IS NOT NULL OR ws2.user_id IS NOT NULL)
         AND (u1.id IS NOT NULL OR u2.id IS NOT NULL)
       ORDER BY w.week_number ASC`, [userId1, userId2, currentYear]);
        // Calculate head-to-head stats
        let user1Wins = 0;
        let user2Wins = 0;
        let ties = 0;
        comparison.forEach(week => {
            if (week.user1_percentage !== null && week.user2_percentage !== null) {
                if (week.user1_percentage > week.user2_percentage) {
                    user1Wins++;
                }
                else if (week.user2_percentage > week.user1_percentage) {
                    user2Wins++;
                }
                else {
                    ties++;
                }
            }
        });
        res.json({
            comparison,
            summary: {
                user1_name: comparison[0]?.user1_name || 'User 1',
                user2_name: comparison[0]?.user2_name || 'User 2',
                user1Wins,
                user2Wins,
                ties,
                total_weeks: user1Wins + user2Wins + ties
            }
        });
    }
    catch (error) {
        console.error('Error fetching head-to-head comparison:', error);
        res.status(500).json({ error: 'Failed to fetch head-to-head comparison' });
    }
});
// Get leaderboard statistics
router.get('/stats', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        const stats = await (0, database_1.getQuery)(`SELECT 
         COUNT(DISTINCT u.id) as total_users,
         COUNT(DISTINCT w.id) as total_weeks,
         COUNT(DISTINCT g.id) as total_games,
         COUNT(DISTINCT p.id) as total_picks,
         AVG(ws.percentage) as avg_weekly_percentage,
         MAX(ws.percentage) as best_weekly_percentage,
         MIN(ws.percentage) as worst_weekly_percentage,
         COUNT(DISTINCT CASE WHEN ws.percentage = 100 THEN ws.id END) as perfect_weeks,
         AVG(ss.season_percentage) as avg_season_percentage
       FROM users u
       LEFT JOIN picks p ON u.id = p.user_id
       LEFT JOIN games g ON p.game_id = g.id
       LEFT JOIN weeks w ON g.week_id = w.id AND w.season_year = ?
       LEFT JOIN weekly_scores ws ON u.id = ws.user_id AND ws.week_id = w.id
       LEFT JOIN season_standings ss ON u.id = ss.user_id AND ss.season_year = ?`, [currentYear, currentYear]);
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching leaderboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard stats' });
    }
});
// Get team performance insights (teams that beat the spread most)
router.get('/team-insights', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Get teams that beat the spread most often
        const teamSpreadPerformance = await (0, database_1.allQuery)(`SELECT 
         g.home_team as team_name,
         COUNT(*) as total_games,
         COUNT(CASE WHEN g.spread_winner = g.home_team THEN 1 END) as spread_wins,
         ROUND(
           (COUNT(CASE WHEN g.spread_winner = g.home_team THEN 1 END) * 100.0) / COUNT(*), 1
         ) as spread_win_percentage
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE w.season_year = ? 
         AND g.status = 'completed' 
         AND g.spread IS NOT NULL 
         AND g.spread_winner IS NOT NULL
       GROUP BY g.home_team
       
       UNION ALL
       
       SELECT 
         g.away_team as team_name,
         COUNT(*) as total_games,
         COUNT(CASE WHEN g.spread_winner = g.away_team THEN 1 END) as spread_wins,
         ROUND(
           (COUNT(CASE WHEN g.spread_winner = g.away_team THEN 1 END) * 100.0) / COUNT(*), 1
         ) as spread_win_percentage
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE w.season_year = ? 
         AND g.status = 'completed' 
         AND g.spread IS NOT NULL 
         AND g.spread_winner IS NOT NULL
       GROUP BY g.away_team`, [currentYear, currentYear]);
        // Aggregate the data by team
        const teamStats = teamSpreadPerformance.reduce((acc, team) => {
            if (!acc[team.team_name]) {
                acc[team.team_name] = {
                    team_name: team.team_name,
                    total_games: 0,
                    spread_wins: 0,
                    spread_win_percentage: 0
                };
            }
            acc[team.team_name].total_games += team.total_games;
            acc[team.team_name].spread_wins += team.spread_wins;
            return acc;
        }, {});
        // Calculate final percentages and sort
        const finalTeamStats = Object.values(teamStats)
            .map((team) => ({
            ...team,
            spread_win_percentage: team.total_games > 0
                ? Math.round((team.spread_wins / team.total_games) * 100 * 10) / 10
                : 0
        }))
            .filter((team) => team.total_games >= 2) // Only teams with 2+ games
            .sort((a, b) => b.spread_win_percentage - a.spread_win_percentage)
            .slice(0, 10); // Top 10
        res.json(finalTeamStats);
    }
    catch (error) {
        console.error('Error fetching team insights:', error);
        res.status(500).json({ error: 'Failed to fetch team insights' });
    }
});
// Conference mapping - major college football conferences
const CONFERENCE_MAPPING = {
    // SEC
    'Alabama': 'SEC', 'Auburn': 'SEC', 'Arkansas': 'SEC', 'Florida': 'SEC', 'Georgia': 'SEC',
    'Kentucky': 'SEC', 'LSU': 'SEC', 'Mississippi State': 'SEC', 'Missouri': 'SEC', 'Ole Miss': 'SEC',
    'South Carolina': 'SEC', 'Tennessee': 'SEC', 'Texas A&M': 'SEC', 'Vanderbilt': 'SEC', 'Texas': 'SEC', 'Oklahoma': 'SEC',
    // Big Ten  
    'Illinois': 'Big Ten', 'Indiana': 'Big Ten', 'Iowa': 'Big Ten', 'Maryland': 'Big Ten', 'Michigan': 'Big Ten',
    'Michigan State': 'Big Ten', 'Minnesota': 'Big Ten', 'Nebraska': 'Big Ten', 'Northwestern': 'Big Ten',
    'Ohio State': 'Big Ten', 'Penn State': 'Big Ten', 'Purdue': 'Big Ten', 'Rutgers': 'Big Ten', 'Wisconsin': 'Big Ten',
    'UCLA': 'Big Ten', 'USC': 'Big Ten', 'Oregon': 'Big Ten', 'Washington': 'Big Ten',
    // Big 12
    'Baylor': 'Big 12', 'Iowa State': 'Big 12', 'Kansas': 'Big 12', 'Kansas State': 'Big 12',
    'Oklahoma State': 'Big 12', 'TCU': 'Big 12', 'Texas Tech': 'Big 12', 'West Virginia': 'Big 12',
    'Cincinnati': 'Big 12', 'Houston': 'Big 12', 'UCF': 'Big 12', 'BYU': 'Big 12', 'Arizona': 'Big 12',
    'Arizona State': 'Big 12', 'Colorado': 'Big 12', 'Utah': 'Big 12',
    // ACC
    'Boston College': 'ACC', 'Clemson': 'ACC', 'Duke': 'ACC', 'Florida State': 'ACC', 'Georgia Tech': 'ACC',
    'Louisville': 'ACC', 'Miami': 'ACC', 'NC State': 'ACC', 'North Carolina': 'ACC', 'Notre Dame': 'ACC',
    'Pittsburgh': 'ACC', 'Syracuse': 'ACC', 'Virginia': 'ACC', 'Virginia Tech': 'ACC', 'Wake Forest': 'ACC',
    'California': 'ACC', 'Stanford': 'ACC', 'SMU': 'ACC',
    // Pac-12 (remaining teams)
    'Washington State': 'Pac-12', 'Oregon State': 'Pac-12',
    // Group of 5 and others
    'Air Force': 'Mountain West', 'Boise State': 'Mountain West', 'Colorado State': 'Mountain West',
    'Fresno State': 'Mountain West', 'Hawaii': 'Mountain West', 'Nevada': 'Mountain West', 'New Mexico': 'Mountain West',
    'San Diego State': 'Mountain West', 'San Jose State': 'Mountain West', 'UNLV': 'Mountain West', 'Wyoming': 'Mountain West',
    'Appalachian State': 'Sun Belt', 'Arkansas State': 'Sun Belt', 'Coastal Carolina': 'Sun Belt', 'Georgia Southern': 'Sun Belt',
    'Georgia State': 'Sun Belt', 'James Madison': 'Sun Belt', 'Louisiana': 'Sun Belt', 'Marshall': 'Sun Belt',
    'Old Dominion': 'Sun Belt', 'South Alabama': 'Sun Belt', 'Southern Miss': 'Sun Belt', 'Texas State': 'Sun Belt',
    'Troy': 'Sun Belt', 'ULM': 'Sun Belt',
    'East Carolina': 'AAC', 'Memphis': 'AAC', 'Navy': 'AAC', 'South Florida': 'AAC', 'Temple': 'AAC',
    'Tulane': 'AAC', 'Tulsa': 'AAC', 'Charlotte': 'AAC', 'FAU': 'AAC', 'North Texas': 'AAC',
    'Rice': 'AAC', 'UAB': 'AAC', 'UTSA': 'AAC',
    'Akron': 'MAC', 'Ball State': 'MAC', 'Bowling Green': 'MAC', 'Buffalo': 'MAC', 'Central Michigan': 'MAC',
    'Eastern Michigan': 'MAC', 'Kent State': 'MAC', 'Miami (OH)': 'MAC', 'Northern Illinois': 'MAC',
    'Ohio': 'MAC', 'Toledo': 'MAC', 'Western Michigan': 'MAC',
    'FIU': 'C-USA', 'Jacksonville State': 'C-USA', 'Kennesaw State': 'C-USA', 'Liberty': 'C-USA',
    'Louisiana Tech': 'C-USA', 'Middle Tennessee': 'C-USA', 'New Mexico State': 'C-USA', 'Sam Houston': 'C-USA',
    'UTEP': 'C-USA', 'Western Kentucky': 'C-USA'
};
const getTeamConference = (teamName) => {
    // Try exact match first
    if (CONFERENCE_MAPPING[teamName]) {
        return CONFERENCE_MAPPING[teamName];
    }
    // Try partial matching for cases where team names might be slightly different
    const lowerTeamName = teamName.toLowerCase();
    for (const [mappedTeam, conference] of Object.entries(CONFERENCE_MAPPING)) {
        if (lowerTeamName.includes(mappedTeam.toLowerCase()) || mappedTeam.toLowerCase().includes(lowerTeamName)) {
            return conference;
        }
    }
    return 'Other';
};
// Get conference performance statistics
router.get('/conference-insights', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Get all completed games with spreads
        const games = await (0, database_1.allQuery)(`SELECT 
         g.home_team,
         g.away_team,
         g.spread,
         g.favorite_team,
         g.spread_winner,
         g.home_score,
         g.away_score,
         w.week_number,
         w.season_year
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE w.season_year = ? 
         AND g.status = 'completed'
         AND g.spread IS NOT NULL
         AND g.spread_winner IS NOT NULL
       ORDER BY w.week_number ASC`, [currentYear]);
        // Process conference statistics
        const conferenceStats = {};
        games.forEach((game) => {
            const homeConference = getTeamConference(game.home_team);
            const awayConference = getTeamConference(game.away_team);
            // Initialize conference stats if not exists
            [homeConference, awayConference].forEach(conf => {
                if (!conferenceStats[conf]) {
                    conferenceStats[conf] = {
                        conference: conf,
                        total_games: 0,
                        spread_wins: 0,
                        spread_losses: 0,
                        spread_win_percentage: 0,
                        avg_spread_margin: 0,
                        spread_margins: []
                    };
                }
            });
            // Track home team performance
            conferenceStats[homeConference].total_games++;
            if (game.spread_winner === game.home_team) {
                conferenceStats[homeConference].spread_wins++;
                // Calculate margin (positive means they beat the spread by this much)
                const margin = (game.home_score - game.away_score) - (game.favorite_team === game.home_team ? Math.abs(game.spread) : -Math.abs(game.spread));
                conferenceStats[homeConference].spread_margins.push(margin);
            }
            else {
                conferenceStats[homeConference].spread_losses++;
                const margin = (game.home_score - game.away_score) - (game.favorite_team === game.home_team ? Math.abs(game.spread) : -Math.abs(game.spread));
                conferenceStats[homeConference].spread_margins.push(margin);
            }
            // Track away team performance
            conferenceStats[awayConference].total_games++;
            if (game.spread_winner === game.away_team) {
                conferenceStats[awayConference].spread_wins++;
                const margin = (game.away_score - game.home_score) - (game.favorite_team === game.away_team ? Math.abs(game.spread) : -Math.abs(game.spread));
                conferenceStats[awayConference].spread_margins.push(margin);
            }
            else {
                conferenceStats[awayConference].spread_losses++;
                const margin = (game.away_score - game.home_score) - (game.favorite_team === game.away_team ? Math.abs(game.spread) : -Math.abs(game.spread));
                conferenceStats[awayConference].spread_margins.push(margin);
            }
        });
        // Calculate final percentages and averages
        const finalConferenceStats = Object.values(conferenceStats)
            .map(conf => ({
            ...conf,
            spread_win_percentage: conf.total_games > 0
                ? Math.round((conf.spread_wins / conf.total_games) * 100 * 10) / 10
                : 0,
            avg_spread_margin: conf.spread_margins.length > 0
                ? Math.round((conf.spread_margins.reduce((sum, margin) => sum + margin, 0) / conf.spread_margins.length) * 10) / 10
                : 0
        }))
            .filter(conf => conf.conference !== 'Other' && conf.total_games >= 3) // Only major conferences with 3+ games
            .sort((a, b) => b.spread_win_percentage - a.spread_win_percentage);
        // Get head-to-head conference matchups
        const conferenceMatchups = games.filter((game) => {
            const homeConf = getTeamConference(game.home_team);
            const awayConf = getTeamConference(game.away_team);
            return homeConf !== awayConf && homeConf !== 'Other' && awayConf !== 'Other';
        }).map((game) => ({
            week: game.week_number,
            home_team: game.home_team,
            away_team: game.away_team,
            home_conference: getTeamConference(game.home_team),
            away_conference: getTeamConference(game.away_team),
            spread: game.spread,
            favorite: game.favorite_team,
            spread_winner: game.spread_winner,
            home_score: game.home_score,
            away_score: game.away_score
        }));
        res.json({
            conference_performance: finalConferenceStats,
            conference_matchups: conferenceMatchups.slice(0, 10) // Recent/notable matchups
        });
    }
    catch (error) {
        console.error('Error fetching conference insights:', error);
        res.status(500).json({ error: 'Failed to fetch conference insights' });
    }
});
// Get interesting statistics for the leaderboard
router.get('/insights', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        // Get various fun statistics - show game stats but only count current users
        const insights = await (0, database_1.getQuery)(`SELECT 
         -- Basic stats - count current users
         (SELECT COUNT(*) FROM users) as total_players,
         COUNT(DISTINCT g.id) as total_games,
         COUNT(DISTINCT p.id) as total_picks,
         COUNT(DISTINCT w.id) as total_weeks,
         
         -- Accuracy stats - only from current users
         COUNT(CASE WHEN p.is_correct = 1 AND u.id IS NOT NULL THEN 1 END) as correct_picks,
         COUNT(CASE WHEN p.is_correct = 0 AND u.id IS NOT NULL THEN 1 END) as incorrect_picks,
         ROUND(
           (COUNT(CASE WHEN p.is_correct = 1 AND u.id IS NOT NULL THEN 1 END) * 100.0) / 
           NULLIF(COUNT(CASE WHEN p.is_correct IS NOT NULL AND u.id IS NOT NULL THEN 1 END), 0), 1
         ) as overall_accuracy,
         
         -- Perfect weeks - only from current users
         COUNT(DISTINCT CASE WHEN ws.percentage = 100 AND u.id IS NOT NULL THEN ws.id END) as perfect_weeks,
         
         -- Game outcomes - all games regardless of picks
         COUNT(CASE WHEN g.status = 'completed' THEN 1 END) as completed_games,
         COUNT(CASE WHEN g.spread IS NOT NULL AND g.status = 'completed' THEN 1 END) as games_with_spreads,
         
         -- Spread statistics - all completed games
         AVG(CASE WHEN g.status = 'completed' THEN ABS(g.spread) END) as avg_spread_size,
         MAX(CASE WHEN g.status = 'completed' THEN ABS(g.spread) END) as largest_spread,
         MIN(CASE WHEN g.status = 'completed' THEN ABS(g.spread) END) as smallest_spread,
         
         -- Score statistics - all completed games
         AVG(CASE WHEN g.status = 'completed' THEN g.home_score + g.away_score END) as avg_total_points,
         MAX(CASE WHEN g.status = 'completed' THEN g.home_score + g.away_score END) as highest_scoring_game,
         MIN(CASE WHEN g.status = 'completed' THEN g.home_score + g.away_score END) as lowest_scoring_game
         
       FROM games g
       LEFT JOIN weeks w ON g.week_id = w.id AND w.season_year = ?
       LEFT JOIN picks p ON g.id = p.game_id
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN weekly_scores ws ON u.id = ws.user_id AND ws.week_id = w.id`, [currentYear]);
        // Get most picked teams - only from current users
        const mostPickedTeams = await (0, database_1.allQuery)(`SELECT 
         p.selected_team,
         COUNT(*) as pick_count,
         COUNT(CASE WHEN p.is_correct = 1 THEN 1 END) as correct_count,
         ROUND(
           (COUNT(CASE WHEN p.is_correct = 1 THEN 1 END) * 100.0) / 
           COUNT(CASE WHEN p.is_correct IS NOT NULL THEN 1 END), 1
         ) as success_rate
       FROM picks p
       INNER JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       WHERE w.season_year = ? AND p.is_correct IS NOT NULL
       GROUP BY p.selected_team
       HAVING COUNT(*) >= 5
       ORDER BY pick_count DESC
       LIMIT 10`, [currentYear]);
        // Get biggest upsets (games where the spread was wrong)
        const biggestUpsets = await (0, database_1.allQuery)(`SELECT 
         g.home_team,
         g.away_team,
         g.spread,
         g.favorite_team,
         g.spread_winner,
         g.home_score,
         g.away_score,
         w.week_number,
         ABS(g.spread) as spread_size
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE w.season_year = ? 
         AND g.status = 'completed'
         AND g.spread IS NOT NULL
         AND g.spread_winner != g.favorite_team
       ORDER BY ABS(g.spread) DESC
       LIMIT 5`, [currentYear]);
        res.json({
            general: insights,
            most_picked_teams: mostPickedTeams,
            biggest_upsets: biggestUpsets
        });
    }
    catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});
exports.default = router;
//# sourceMappingURL=leaderboard.js.map