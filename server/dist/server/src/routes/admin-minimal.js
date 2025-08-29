"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// Test route to verify admin routes are working
router.get('/test', (req, res) => {
    res.json({ message: 'Minimal admin routes working!', timestamp: new Date().toISOString() });
});
// Fetch fresh spreads for current week games
router.post('/fetch-spreads', async (req, res) => {
    console.log('🚀 MINIMAL FETCH SPREADS ENDPOINT HIT!');
    res.json({
        message: 'Minimal fetch spreads endpoint is working!',
        updated: 0,
        total: 0,
        timestamp: new Date().toISOString()
    });
});
exports.default = router;
//# sourceMappingURL=admin-minimal.js.map