"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.allQuery = exports.getQuery = exports.runQuery = exports.initializeDatabase = exports.db = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Use Railway-compatible database path with persistent volume
const DB_PATH = process.env.RAILWAY_ENVIRONMENT
    ? '/data/cfb_pickem.db' // Railway persistent volume
    : path_1.default.join(__dirname, '../../data/cfb_pickem.db'); // Local development
// Ensure directory exists
const dbDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory:', dbDir);
}
console.log('Using database path:', DB_PATH);
// Create database connection
exports.db = new sqlite3_1.default.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        console.error('Database path:', DB_PATH);
        console.error('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    }
    else {
        console.log('Connected to SQLite database at:', DB_PATH);
    }
});
// Initialize database tables
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_admin BOOLEAN DEFAULT FALSE
      )`,
            // Weeks table
            `CREATE TABLE IF NOT EXISTS weeks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL,
        season_year INTEGER NOT NULL,
        deadline DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        spreads_locked BOOLEAN DEFAULT FALSE,
        status TEXT CHECK(status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
        UNIQUE(week_number, season_year)
      )`,
            // Games table
            `CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_id INTEGER NOT NULL,
        external_game_id TEXT,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        spread REAL,
        favorite_team TEXT,
        start_time DATETIME NOT NULL,
        status TEXT CHECK(status IN ('scheduled', 'live', 'completed')) DEFAULT 'scheduled',
        home_score INTEGER,
        away_score INTEGER,
        spread_winner TEXT,
        is_favorite_team_game BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (week_id) REFERENCES weeks (id)
      )`,
            // Picks table
            `CREATE TABLE IF NOT EXISTS picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        selected_team TEXT NOT NULL,
        confidence_points INTEGER DEFAULT 1,
        is_correct BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (game_id) REFERENCES games (id),
        UNIQUE(user_id, game_id)
      )`,
            // Weekly scores table
            `CREATE TABLE IF NOT EXISTS weekly_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        week_id INTEGER NOT NULL,
        correct_picks INTEGER DEFAULT 0,
        total_picks INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0,
        weekly_rank INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (week_id) REFERENCES weeks (id),
        UNIQUE(user_id, week_id)
      )`,
            // Season standings table
            `CREATE TABLE IF NOT EXISTS season_standings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        season_year INTEGER NOT NULL,
        total_correct INTEGER DEFAULT 0,
        total_picks INTEGER DEFAULT 0,
        season_percentage REAL DEFAULT 0,
        season_rank INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, season_year)
      )`
        ];
        let completed = 0;
        const total = tables.length;
        tables.forEach((sql, index) => {
            exports.db.run(sql, (err) => {
                if (err) {
                    console.error(`Error creating table ${index}:`, err.message);
                    reject(err);
                }
                else {
                    completed++;
                    if (completed === total) {
                        console.log('All database tables initialized successfully');
                        resolve();
                    }
                }
            });
        });
    });
};
exports.initializeDatabase = initializeDatabase;
// Utility function to run queries with Promise support
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(this);
            }
        });
    });
};
exports.runQuery = runQuery;
const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(row);
            }
        });
    });
};
exports.getQuery = getQuery;
const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
};
exports.allQuery = allQuery;
// Close database connection
const closeDatabase = () => {
    return new Promise((resolve, reject) => {
        exports.db.close((err) => {
            if (err) {
                reject(err);
            }
            else {
                console.log('Database connection closed');
                resolve();
            }
        });
    });
};
exports.closeDatabase = closeDatabase;
//# sourceMappingURL=database.js.map