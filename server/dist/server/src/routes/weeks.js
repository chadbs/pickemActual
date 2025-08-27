"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../database/database");
const router = express_1.default.Router();
// Get all weeks
router.get('/', async (req, res) => {
    try {
        const { year } = req.query;
        let whereClause = '';
        let params = [];
        if (year) {
            whereClause = 'WHERE season_year = ?';
            params = [year];
        }
        const weeks = await (0, database_1.allQuery)(`SELECT * FROM weeks ${whereClause} ORDER BY season_year DESC, week_number DESC`, params);
        res.json(weeks);
    }
    catch (error) {
        console.error('Error fetching weeks:', error);
        res.status(500).json({ error: 'Failed to fetch weeks' });
    }
});
// Get current active week
router.get('/current', async (req, res) => {
    try {
        const currentWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE is_active = 1 ORDER BY season_year DESC, week_number DESC LIMIT 1');
        if (!currentWeek) {
            // Create a default current week if none exists
            const now = new Date();
            const year = now.getFullYear();
            const weekNumber = Math.max(1, Math.floor((now.getTime() - new Date(year, 7, 25).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1);
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + (6 - deadline.getDay())); // Next Saturday
            deadline.setHours(20, 0, 0, 0); // 8 PM
            const result = await (0, database_1.runQuery)('INSERT INTO weeks (week_number, season_year, deadline, is_active, status) VALUES (?, ?, ?, ?, ?)', [weekNumber, year, deadline.toISOString(), true, 'active']);
            const newWeek = {
                id: result.lastID,
                week_number: weekNumber,
                season_year: year,
                deadline: deadline.toISOString(),
                is_active: true,
                status: 'active'
            };
            return res.json(newWeek);
        }
        res.json(currentWeek);
    }
    catch (error) {
        console.error('Error fetching current week:', error);
        res.status(500).json({ error: 'Failed to fetch current week' });
    }
});
// Get specific week
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const week = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        if (!week) {
            return res.status(404).json({ error: 'Week not found' });
        }
        res.json(week);
    }
    catch (error) {
        console.error('Error fetching week:', error);
        res.status(500).json({ error: 'Failed to fetch week' });
    }
});
// Get week by week number and year
router.get('/season/:year/week/:weekNumber', async (req, res) => {
    try {
        const { year, weekNumber } = req.params;
        const week = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE season_year = ? AND week_number = ?', [year, weekNumber]);
        if (!week) {
            return res.status(404).json({ error: 'Week not found' });
        }
        res.json(week);
    }
    catch (error) {
        console.error('Error fetching week:', error);
        res.status(500).json({ error: 'Failed to fetch week' });
    }
});
// Get week with games and picks summary
router.get('/:id/summary', async (req, res) => {
    try {
        const { id } = req.params;
        // Get week info
        const week = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        if (!week) {
            return res.status(404).json({ error: 'Week not found' });
        }
        // Get games for this week
        const games = await (0, database_1.allQuery)('SELECT * FROM games WHERE week_id = ? ORDER BY start_time ASC', [id]);
        // Get pick statistics
        const pickStats = await (0, database_1.allQuery)(`SELECT 
         u.name,
         COUNT(p.id) as total_picks,
         SUM(CASE WHEN p.is_correct = 1 THEN 1 ELSE 0 END) as correct_picks,
         SUM(CASE WHEN p.is_correct = 0 THEN 1 ELSE 0 END) as incorrect_picks
       FROM users u
       LEFT JOIN picks p ON u.id = p.user_id
       LEFT JOIN games g ON p.game_id = g.id AND g.week_id = ?
       GROUP BY u.id, u.name
       ORDER BY correct_picks DESC, u.name ASC`, [id]);
        res.json({
            week,
            games,
            pick_stats: pickStats,
            summary: {
                total_games: games.length,
                completed_games: games.filter(g => g.status === 'completed').length,
                total_users: pickStats.length,
                users_with_picks: pickStats.filter(s => s.total_picks > 0).length
            }
        });
    }
    catch (error) {
        console.error('Error fetching week summary:', error);
        res.status(500).json({ error: 'Failed to fetch week summary' });
    }
});
// Create new week (admin only)
router.post('/', async (req, res) => {
    try {
        const { week_number, season_year, deadline } = req.body;
        if (!week_number || !season_year || !deadline) {
            return res.status(400).json({ error: 'Missing required fields: week_number, season_year, deadline' });
        }
        // Check if week already exists
        const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE week_number = ? AND season_year = ?', [week_number, season_year]);
        if (existingWeek) {
            return res.status(409).json({ error: 'Week already exists for this season' });
        }
        // Deactivate other weeks if this will be active
        const { is_active = false } = req.body;
        if (is_active) {
            await (0, database_1.runQuery)('UPDATE weeks SET is_active = 0');
        }
        const result = await (0, database_1.runQuery)('INSERT INTO weeks (week_number, season_year, deadline, is_active, status) VALUES (?, ?, ?, ?, ?)', [week_number, season_year, deadline, is_active, req.body.status || 'upcoming']);
        const newWeek = {
            id: result.lastID,
            week_number,
            season_year,
            deadline,
            is_active,
            status: req.body.status || 'upcoming'
        };
        res.status(201).json(newWeek);
    }
    catch (error) {
        console.error('Error creating week:', error);
        res.status(500).json({ error: 'Failed to create week' });
    }
});
// Update week (admin only)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { week_number, season_year, deadline, is_active, status } = req.body;
        // Check if week exists
        const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        if (!existingWeek) {
            return res.status(404).json({ error: 'Week not found' });
        }
        // If setting this week as active, deactivate others
        if (is_active && is_active !== existingWeek.is_active) {
            await (0, database_1.runQuery)('UPDATE weeks SET is_active = 0 WHERE id != ?', [id]);
        }
        // Update week
        await (0, database_1.runQuery)('UPDATE weeks SET week_number = ?, season_year = ?, deadline = ?, is_active = ?, status = ? WHERE id = ?', [
            week_number || existingWeek.week_number,
            season_year || existingWeek.season_year,
            deadline || existingWeek.deadline,
            is_active !== undefined ? is_active : existingWeek.is_active,
            status || existingWeek.status,
            id
        ]);
        const updatedWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        res.json(updatedWeek);
    }
    catch (error) {
        console.error('Error updating week:', error);
        res.status(500).json({ error: 'Failed to update week' });
    }
});
// Delete week (admin only - be careful!)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if week exists
        const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        if (!existingWeek) {
            return res.status(404).json({ error: 'Week not found' });
        }
        // Delete related data (cascading delete)
        await (0, database_1.runQuery)('DELETE FROM picks WHERE game_id IN (SELECT id FROM games WHERE week_id = ?)', [id]);
        await (0, database_1.runQuery)('DELETE FROM weekly_scores WHERE week_id = ?', [id]);
        await (0, database_1.runQuery)('DELETE FROM games WHERE week_id = ?', [id]);
        await (0, database_1.runQuery)('DELETE FROM weeks WHERE id = ?', [id]);
        res.json({ message: 'Week and all related data deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting week:', error);
        res.status(500).json({ error: 'Failed to delete week' });
    }
});
// Activate week (admin only)
router.post('/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if week exists
        const existingWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        if (!existingWeek) {
            return res.status(404).json({ error: 'Week not found' });
        }
        // Deactivate all other weeks
        await (0, database_1.runQuery)('UPDATE weeks SET is_active = 0');
        // Activate this week
        await (0, database_1.runQuery)('UPDATE weeks SET is_active = 1, status = ? WHERE id = ?', ['active', id]);
        const activatedWeek = await (0, database_1.getQuery)('SELECT * FROM weeks WHERE id = ?', [id]);
        res.json(activatedWeek);
    }
    catch (error) {
        console.error('Error activating week:', error);
        res.status(500).json({ error: 'Failed to activate week' });
    }
});
exports.default = router;
//# sourceMappingURL=weeks.js.map