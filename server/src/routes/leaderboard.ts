import express from 'express';
import { allQuery, getQuery } from '../database/database';
import { LeaderboardEntry } from '../../../shared/types';

const router = express.Router();

// Get current week leaderboard
router.get('/weekly', async (req, res) => {
  try {
    const { week, year } = req.query;
    
    let whereClause = '';
    let params: any[] = [];
    
    if (week && year) {
      whereClause = 'WHERE w.week_number = ? AND w.season_year = ?';
      params = [week, year];
    } else {
      whereClause = 'WHERE w.is_active = 1';
    }
    
    const leaderboard = await allQuery<any>(
      `SELECT 
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
       ORDER BY ws.percentage DESC NULLS LAST, ws.correct_picks DESC NULLS LAST, u.name ASC`,
      params
    );
    
    // If no weekly scores exist yet, show basic user info with pick counts
    if (leaderboard.length === 0 || leaderboard.every(entry => entry.correct_picks === null)) {
      const basicLeaderboard = await allQuery<any>(
        `SELECT 
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
         ORDER BY completion_percentage DESC, picks_made DESC, u.name ASC`,
        params
      );
      
      return res.json(basicLeaderboard);
    }
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching weekly leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch weekly leaderboard' });
  }
});

// Get season leaderboard
router.get('/season', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    const leaderboard = await allQuery<any>(
      `SELECT 
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
       ORDER BY ss.season_percentage DESC NULLS LAST, ss.total_correct DESC NULLS LAST, u.name ASC`,
      [currentYear, currentYear]
    );
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching season leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch season leaderboard' });
  }
});

// Get combined leaderboard (current week + season stats)
router.get('/combined', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const combined = await allQuery<any>(
      `SELECT 
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
         u.name ASC`,
      [currentYear, currentYear, currentYear]
    );
    
    res.json(combined);
  } catch (error) {
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
    
    const history = await allQuery<any>(
      `SELECT 
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
       LEFT JOIN users u2 ON ws2.user_id = u2.id
       WHERE w.season_year = ?
       GROUP BY w.id, w.week_number, w.season_year, w.deadline, ws.correct_picks, ws.total_picks, ws.percentage, ws.weekly_rank
       ORDER BY w.week_number ASC`,
      [userId, currentYear]
    );
    
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
  } catch (error) {
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
    
    // Get both users' weekly performances
    const comparison = await allQuery<any>(
      `SELECT 
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
       WHERE w.season_year = ? AND (ws1.user_id IS NOT NULL OR ws2.user_id IS NOT NULL)
       ORDER BY w.week_number ASC`,
      [userId1, userId2, currentYear]
    );
    
    // Calculate head-to-head stats
    let user1Wins = 0;
    let user2Wins = 0;
    let ties = 0;
    
    comparison.forEach(week => {
      if (week.user1_percentage !== null && week.user2_percentage !== null) {
        if (week.user1_percentage > week.user2_percentage) {
          user1Wins++;
        } else if (week.user2_percentage > week.user1_percentage) {
          user2Wins++;
        } else {
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
  } catch (error) {
    console.error('Error fetching head-to-head comparison:', error);
    res.status(500).json({ error: 'Failed to fetch head-to-head comparison' });
  }
});

// Get leaderboard statistics
router.get('/stats', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    const stats = await getQuery<any>(
      `SELECT 
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
       LEFT JOIN season_standings ss ON u.id = ss.user_id AND ss.season_year = ?`,
      [currentYear, currentYear]
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard stats' });
  }
});

export default router;