"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./database/database");
const scheduler_1 = require("./services/scheduler");
// Import routes
const users_1 = __importDefault(require("./routes/users"));
const games_1 = __importDefault(require("./routes/games"));
const picks_1 = __importDefault(require("./routes/picks"));
const weeks_1 = __importDefault(require("./routes/weeks"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const admin_test_1 = __importDefault(require("./routes/admin-test"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3003;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files in production
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
if (isProduction) {
    // Try multiple possible paths for client dist
    const possiblePaths = [
        path_1.default.join(__dirname, '../../client/dist'), // From server/dist/server/src
        path_1.default.join(__dirname, '../../../client/dist'), // Alternative path
        path_1.default.join(process.cwd(), 'client/dist'), // From project root
        '/app/client/dist' // Railway absolute path
    ];
    let clientDistPath = '';
    for (const testPath of possiblePaths) {
        if (fs_1.default.existsSync(testPath)) {
            clientDistPath = testPath;
            break;
        }
    }
    if (clientDistPath && fs_1.default.existsSync(path_1.default.join(clientDistPath, 'index.html'))) {
        console.log('Serving static files from:', clientDistPath);
        app.use(express_1.default.static(clientDistPath));
    }
    else {
        console.error('Could not find client dist directory. Tried paths:', possiblePaths);
        console.error('Current directory:', process.cwd());
        console.error('__dirname:', __dirname);
    }
}
// Create data directory if it doesn't exist
const dataDir = path_1.default.join(__dirname, '../data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Debug middleware to log all requests
app.use('/api', (req, res, next) => {
    console.log(`🔍 API request: ${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/users', users_1.default);
app.use('/api/games', games_1.default);
app.use('/api/picks', picks_1.default);
app.use('/api/weeks', weeks_1.default);
app.use('/api/leaderboard', leaderboard_1.default);
app.use('/api/admin', admin_test_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// API 404 handler - must come after all API routes
app.use('/api/*', (req, res) => {
    console.log(`❌ Unhandled API route: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'API route not found' });
});
// Serve React app for non-API routes in production
if (isProduction) {
    app.get('*', (req, res) => {
        // Try multiple possible paths for index.html
        const possibleIndexPaths = [
            path_1.default.join(__dirname, '../../client/dist/index.html'),
            path_1.default.join(__dirname, '../../../client/dist/index.html'),
            path_1.default.join(process.cwd(), 'client/dist/index.html'),
            '/app/client/dist/index.html'
        ];
        let indexPath = '';
        for (const testPath of possibleIndexPaths) {
            if (fs_1.default.existsSync(testPath)) {
                indexPath = testPath;
                break;
            }
        }
        if (indexPath) {
            console.log('Serving index.html from:', indexPath);
            res.sendFile(indexPath);
        }
        else {
            console.error('Could not find index.html. Tried paths:', possibleIndexPaths);
            res.status(404).send('Application not found');
        }
    });
}
else {
    // 404 handler for development
    app.use('*', (req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });
}
// Initialize database and start server
const startServer = async () => {
    try {
        await (0, database_1.initializeDatabase)();
        console.log('Database initialized successfully');
        // Start the automated scheduler
        (0, scheduler_1.startScheduler)();
        console.log('Scheduler started');
        app.listen(PORT, () => {
            console.log(`🏈 CFB Pick'em Server running on port ${PORT}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map