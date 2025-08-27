import express from 'express';
import { runQuery, getQuery, allQuery } from '../database/database';
import { Pick, User, Game } from '../../../shared/types';

const router = express.Router();

// Get all picks for current week (with user names)
router.get('/', async (req, res) => {
  try {
    const { week, year, user_id, game_id } = req.query;
    
    let whereClause = '';
    let params: any[] = [];
    
    if (week && year) {
      whereClause = 'WHERE w.week_number = ? AND w.season_year = ?';
      params = [week, year];
    } else if (user_id) {
      whereClause = 'WHERE p.user_id = ?';
      params = [user_id];
    } else if (game_id) {
      whereClause = 'WHERE p.game_id = ?';
      params = [game_id];
    } else {
      // Get current week picks
      whereClause = 'WHERE w.is_active = 1';
    }
    
    const picks = await allQuery<any>(
      `SELECT p.*, u.name as user_name, 
              g.home_team, g.away_team, g.spread, g.start_time, g.status,
              g.home_score, g.away_score, g.spread_winner,
              w.week_number, w.season_year, w.deadline
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       ${whereClause}
       ORDER BY w.season_year DESC, w.week_number DESC, g.start_time ASC, u.name ASC`,
      params
    );
    
    res.json(picks);
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// Get specific pick
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const pick = await getQuery<any>(
      `SELECT p.*, u.name as user_name,
              g.home_team, g.away_team, g.spread, g.start_time, g.status,
              g.home_score, g.away_score, g.spread_winner,
              w.week_number, w.season_year
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (!pick) {
      return res.status(404).json({ error: 'Pick not found' });
    }
    
    res.json(pick);
  } catch (error) {
    console.error('Error fetching pick:', error);
    res.status(500).json({ error: 'Failed to fetch pick' });
  }
});

// Create or update pick
router.post('/', async (req, res) => {
  try {
    const { game_id, selected_team, user_name, confidence_points = 1 } = req.body;
    
    if (!game_id || !selected_team || !user_name) {
      return res.status(400).json({ error: 'Missing required fields: game_id, selected_team, user_name' });
    }
    
    // Get or create user
    let user = await getQuery<User>('SELECT * FROM users WHERE name = ?', [user_name.trim()]);
    if (!user) {
      const userResult = await runQuery(
        'INSERT INTO users (name) VALUES (?)',
        [user_name.trim()]
      );
      
      user = {
        id: userResult.lastID!,
        name: user_name.trim(),
        created_at: new Date().toISOString(),
        is_admin: false
      };
    }
    
    // Verify game exists and get deadline info
    const game = await getQuery<any>(
      `SELECT g.*, w.deadline, w.status as week_status
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE g.id = ?`,
      [game_id]
    );
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(game.deadline);
    
    if (now > deadline && game.week_status !== 'upcoming') {
      return res.status(400).json({ error: 'Pick deadline has passed' });
    }
    
    // Validate selected team
    if (selected_team !== game.home_team && selected_team !== game.away_team) {
      return res.status(400).json({ 
        error: 'Selected team must be either home team or away team',
        home_team: game.home_team,
        away_team: game.away_team
      });
    }
    
    // Check if pick already exists
    const existingPick = await getQuery<Pick>(
      'SELECT * FROM picks WHERE user_id = ? AND game_id = ?',
      [user.id, game_id]
    );
    
    if (existingPick) {
      // Update existing pick
      await runQuery(
        'UPDATE picks SET selected_team = ?, confidence_points = ?, updated_at = ? WHERE id = ?',
        [selected_team, confidence_points, new Date().toISOString(), existingPick.id]
      );
      
      const updatedPick = await getQuery<any>(
        `SELECT p.*, u.name as user_name,
                g.home_team, g.away_team, g.spread, g.start_time, g.status
         FROM picks p
         JOIN users u ON p.user_id = u.id
         JOIN games g ON p.game_id = g.id
         WHERE p.id = ?`,
        [existingPick.id]
      );
      
      return res.json(updatedPick);
    } else {
      // Create new pick
      const result = await runQuery(
        'INSERT INTO picks (user_id, game_id, selected_team, confidence_points) VALUES (?, ?, ?, ?)',
        [user.id, game_id, selected_team, confidence_points]
      );
      
      const newPick = await getQuery<any>(
        `SELECT p.*, u.name as user_name,
                g.home_team, g.away_team, g.spread, g.start_time, g.status
         FROM picks p
         JOIN users u ON p.user_id = u.id
         JOIN games g ON p.game_id = g.id
         WHERE p.id = ?`,
        [result.lastID]
      );
      
      return res.status(201).json(newPick);
    }
  } catch (error) {
    console.error('Error creating/updating pick:', error);
    res.status(500).json({ error: 'Failed to create/update pick' });
  }
});

// Update specific pick
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { selected_team, confidence_points } = req.body;
    
    // Check if pick exists
    const existingPick = await getQuery<any>(
      `SELECT p.*, g.*, w.deadline, w.status as week_status
       FROM picks p
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (!existingPick) {
      return res.status(404).json({ error: 'Pick not found' });
    }
    
    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(existingPick.deadline);
    
    if (now > deadline && existingPick.week_status !== 'upcoming') {
      return res.status(400).json({ error: 'Pick deadline has passed' });
    }
    
    // Validate selected team if provided
    if (selected_team && selected_team !== existingPick.home_team && selected_team !== existingPick.away_team) {
      return res.status(400).json({ 
        error: 'Selected team must be either home team or away team',
        home_team: existingPick.home_team,
        away_team: existingPick.away_team
      });
    }
    
    // Update pick
    await runQuery(
      'UPDATE picks SET selected_team = ?, confidence_points = ?, updated_at = ? WHERE id = ?',
      [
        selected_team || existingPick.selected_team,
        confidence_points !== undefined ? confidence_points : existingPick.confidence_points,
        new Date().toISOString(),
        id
      ]
    );
    
    // Return updated pick
    const updatedPick = await getQuery<any>(
      `SELECT p.*, u.name as user_name,
              g.home_team, g.away_team, g.spread, g.start_time, g.status
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       WHERE p.id = ?`,
      [id]
    );
    
    res.json(updatedPick);
  } catch (error) {
    console.error('Error updating pick:', error);
    res.status(500).json({ error: 'Failed to update pick' });
  }
});

// Delete pick
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if pick exists and deadline hasn't passed
    const existingPick = await getQuery<any>(
      `SELECT p.*, w.deadline, w.status as week_status
       FROM picks p
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (!existingPick) {
      return res.status(404).json({ error: 'Pick not found' });
    }
    
    // Check if deadline has passed
    const now = new Date();
    const deadline = new Date(existingPick.deadline);
    
    if (now > deadline && existingPick.week_status !== 'upcoming') {
      return res.status(400).json({ error: 'Cannot delete pick after deadline has passed' });
    }
    
    // Delete pick
    await runQuery('DELETE FROM picks WHERE id = ?', [id]);
    
    res.json({ message: 'Pick deleted successfully' });
  } catch (error) {
    console.error('Error deleting pick:', error);
    res.status(500).json({ error: 'Failed to delete pick' });
  }
});

// Get user's completion status for current week
router.get('/user/:userId/completion', async (req, res) => {
  try {
    const { userId } = req.params;
    const { week, year } = req.query;
    
    let weekFilter = '';
    let params: any[] = [userId];
    
    if (week && year) {
      weekFilter = 'AND w.week_number = ? AND w.season_year = ?';
      params.push(week.toString(), year.toString());
    } else {
      weekFilter = 'AND w.is_active = 1';
    }
    
    const stats = await getQuery<any>(
      `SELECT 
         COUNT(g.id) as total_games,
         COUNT(p.id) as completed_picks,
         w.week_number,
         w.season_year,
         w.deadline
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       LEFT JOIN picks p ON g.id = p.game_id AND p.user_id = ?
       WHERE 1=1 ${weekFilter}
       GROUP BY w.id`,
      params
    );
    
    if (!stats) {
      return res.status(404).json({ error: 'No active week found' });
    }
    
    res.json({
      ...stats,
      completion_percentage: stats.total_games > 0 ? (stats.completed_picks / stats.total_games) * 100 : 0,
      is_complete: stats.completed_picks === stats.total_games
    });
  } catch (error) {
    console.error('Error fetching completion status:', error);
    res.status(500).json({ error: 'Failed to fetch completion status' });
  }
});

export default router;