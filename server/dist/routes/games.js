"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../database/database");
const router = express_1.default.Router();
// Get all games for current week
router.get('/', async (req, res) => {
    try {
        const { week, year, user_id } = req.query;
        let weekFilter = '';
        let params = [];
        if (week && year) {
            weekFilter = 'WHERE w.week_number = ? AND w.season_year = ?';
            params = [week, year];
        }
        else {
            // Get current active week
            weekFilter = 'WHERE w.is_active = 1';
        }
        const gamesQuery = `
      SELECT g.*, w.week_number, w.season_year, w.deadline
      FROM games g
      JOIN weeks w ON g.week_id = w.id
      ${weekFilter}
      ORDER BY g.start_time ASC
    `;
        const games = await (0, database_1.allQuery)(gamesQuery, params);
        // If user_id is provided, include their picks
        if (user_id) {
            const gamesWithPicks = [];
            for (const game of games) {
                const pick = await (0, database_1.getQuery)('SELECT * FROM picks WHERE game_id = ? AND user_id = ?', [game.id, user_id]);
                gamesWithPicks.push({
                    ...game,
                    user_pick: pick || undefined
                });
            }
            return res.json(gamesWithPicks);
        }
        res.json(games);
    }
    catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});
// Get specific game by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.query;
        const game = await (0, database_1.getQuery)(`SELECT g.*, w.week_number, w.season_year, w.deadline
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE g.id = ?`, [id]);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Include user pick if requested
        if (user_id) {
            const pick = await (0, database_1.getQuery)('SELECT * FROM picks WHERE game_id = ? AND user_id = ?', [id, user_id]);
            const gameWithPick = {
                ...game,
                user_pick: pick || undefined
            };
            return res.json(gameWithPick);
        }
        res.json(game);
    }
    catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});
// Get all picks for a specific game
router.get('/:id/picks', async (req, res) => {
    try {
        const { id } = req.params;
        // Verify game exists
        const game = await (0, database_1.getQuery)('SELECT * FROM games WHERE id = ?', [id]);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        const picks = await (0, database_1.allQuery)(`SELECT p.*, u.name as user_name
       FROM picks p
       JOIN users u ON p.user_id = u.id
       WHERE p.game_id = ?
       ORDER BY p.created_at ASC`, [id]);
        res.json(picks);
    }
    catch (error) {
        console.error('Error fetching game picks:', error);
        res.status(500).json({ error: 'Failed to fetch game picks' });
    }
});
// Get games by week
router.get('/week/:weekId', async (req, res) => {
    try {
        const { weekId } = req.params;
        const { user_id } = req.query;
        const games = await (0, database_1.allQuery)(`SELECT g.*, w.week_number, w.season_year, w.deadline
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE g.week_id = ?
       ORDER BY g.start_time ASC`, [weekId]);
        // Include user picks if requested
        if (user_id) {
            const gamesWithPicks = [];
            for (const game of games) {
                const pick = await (0, database_1.getQuery)('SELECT * FROM picks WHERE game_id = ? AND user_id = ?', [game.id, user_id]);
                gamesWithPicks.push({
                    ...game,
                    user_pick: pick || undefined
                });
            }
            return res.json(gamesWithPicks);
        }
        res.json(games);
    }
    catch (error) {
        console.error('Error fetching week games:', error);
        res.status(500).json({ error: 'Failed to fetch week games' });
    }
});
// Create new game (admin only)
router.post('/', async (req, res) => {
    try {
        const { week_id, home_team, away_team, spread, favorite_team, start_time, is_favorite_team_game } = req.body;
        if (!week_id || !home_team || !away_team || !start_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Verify week exists
        const week = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [week_id]);
        if (!week) {
            return res.status(404).json({ error: 'Week not found' });
        }
        const result = await (0, database_1.runQuery)(`INSERT INTO games 
       (week_id, home_team, away_team, spread, favorite_team, start_time, is_favorite_team_game)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            week_id,
            home_team.trim(),
            away_team.trim(),
            spread || null,
            favorite_team?.trim() || null,
            start_time,
            is_favorite_team_game || false
        ]);
        const newGame = await (0, database_1.getQuery)(`SELECT g.*, w.week_number, w.season_year, w.deadline
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE g.id = ?`, [result.lastID]);
        res.status(201).json(newGame);
    }
    catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});
// Update game (admin only)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { home_team, away_team, spread, favorite_team, start_time, status, home_score, away_score, is_favorite_team_game } = req.body;
        // Check if game exists
        const existingGame = await (0, database_1.getQuery)('SELECT * FROM games WHERE id = ?', [id]);
        if (!existingGame) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Update game
        await (0, database_1.runQuery)(`UPDATE games 
       SET home_team = ?, away_team = ?, spread = ?, favorite_team = ?, 
           start_time = ?, status = ?, home_score = ?, away_score = ?, 
           is_favorite_team_game = ?
       WHERE id = ?`, [
            home_team?.trim() || existingGame.home_team,
            away_team?.trim() || existingGame.away_team,
            spread !== undefined ? spread : existingGame.spread,
            favorite_team?.trim() || existingGame.favorite_team,
            start_time || existingGame.start_time,
            status || existingGame.status,
            home_score !== undefined ? home_score : existingGame.home_score,
            away_score !== undefined ? away_score : existingGame.away_score,
            is_favorite_team_game !== undefined ? is_favorite_team_game : existingGame.is_favorite_team_game,
            id
        ]);
        // Return updated game
        const updatedGame = await (0, database_1.getQuery)(`SELECT g.*, w.week_number, w.season_year, w.deadline
       FROM games g
       JOIN weeks w ON g.week_id = w.id
       WHERE g.id = ?`, [id]);
        res.json(updatedGame);
    }
    catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Failed to update game' });
    }
});
// Delete game (admin only)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if game exists
        const existingGame = await (0, database_1.getQuery)('SELECT * FROM games WHERE id = ?', [id]);
        if (!existingGame) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Delete related picks first
        await (0, database_1.runQuery)('DELETE FROM picks WHERE game_id = ?', [id]);
        // Delete game
        await (0, database_1.runQuery)('DELETE FROM games WHERE id = ?', [id]);
        res.json({ message: 'Game deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
});
exports.default = router;
//# sourceMappingURL=games.js.map