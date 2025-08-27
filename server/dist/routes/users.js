"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../database/database");
const router = express_1.default.Router();
// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await (0, database_1.allQuery)('SELECT * FROM users ORDER BY name');
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await (0, database_1.getQuery)('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// Create or get user by name (no auth system, just name-based)
router.post('/', async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }
        // Check if user already exists
        const existingUser = await (0, database_1.getQuery)('SELECT * FROM users WHERE name = ?', [name.trim()]);
        if (existingUser) {
            return res.json(existingUser);
        }
        // Create new user
        const result = await (0, database_1.runQuery)('INSERT INTO users (name, email) VALUES (?, ?)', [name.trim(), email?.trim() || null]);
        const newUser = {
            id: result.lastID,
            name: name.trim(),
            email: email?.trim() || undefined,
            created_at: new Date().toISOString(),
            is_admin: false
        };
        res.status(201).json(newUser);
    }
    catch (error) {
        console.error('Error creating user:', error);
        // Handle unique constraint violation
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            const existingUser = await (0, database_1.getQuery)('SELECT * FROM users WHERE name = ?', [req.body.name?.trim()]);
            return res.json(existingUser);
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});
// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, is_admin } = req.body;
        // Check if user exists
        const existingUser = await (0, database_1.getQuery)('SELECT * FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Update user
        await (0, database_1.runQuery)('UPDATE users SET name = ?, email = ?, is_admin = ? WHERE id = ?', [
            name?.trim() || existingUser.name,
            email?.trim() || existingUser.email,
            is_admin !== undefined ? is_admin : existingUser.is_admin,
            id
        ]);
        // Return updated user
        const updatedUser = await (0, database_1.getQuery)('SELECT * FROM users WHERE id = ?', [id]);
        res.json(updatedUser);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if user exists
        const existingUser = await (0, database_1.getQuery)('SELECT * FROM users WHERE id = ?', [id]);
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Delete user's picks first (foreign key constraint)
        await (0, database_1.runQuery)('DELETE FROM picks WHERE user_id = ?', [id]);
        await (0, database_1.runQuery)('DELETE FROM weekly_scores WHERE user_id = ?', [id]);
        await (0, database_1.runQuery)('DELETE FROM season_standings WHERE user_id = ?', [id]);
        // Delete user
        await (0, database_1.runQuery)('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
// Get user's pick history
router.get('/:id/picks', async (req, res) => {
    try {
        const { id } = req.params;
        const picks = await (0, database_1.allQuery)(`SELECT p.*, g.home_team, g.away_team, g.spread, g.start_time, g.status,
              g.home_score, g.away_score, g.spread_winner, w.week_number, w.season_year
       FROM picks p
       JOIN games g ON p.game_id = g.id
       JOIN weeks w ON g.week_id = w.id
       WHERE p.user_id = ?
       ORDER BY w.season_year DESC, w.week_number DESC, g.start_time DESC`, [id]);
        res.json(picks);
    }
    catch (error) {
        console.error('Error fetching user picks:', error);
        res.status(500).json({ error: 'Failed to fetch user picks' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map