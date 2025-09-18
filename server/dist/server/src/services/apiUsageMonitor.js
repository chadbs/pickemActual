"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAPIUsageLogs = exports.shouldSkipAPICall = exports.getAPIUsageStats = exports.logAPICall = void 0;
const database_1 = require("../database/database");
// Track API calls in database
const logAPICall = async (service, endpoint, success, error, creditsRemaining) => {
    try {
        await (0, database_1.runQuery)(`INSERT INTO api_usage_log 
       (service, endpoint, timestamp, success, error_message, credits_remaining)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            service,
            endpoint,
            new Date().toISOString(),
            success,
            error || null,
            creditsRemaining || null
        ]);
    }
    catch (error) {
        console.error('Error logging API call:', error);
    }
};
exports.logAPICall = logAPICall;
// Get API usage stats for the last 24 hours
const getAPIUsageStats = async () => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const cfbdStats = await (0, database_1.getQuery)(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM api_usage_log 
      WHERE service = 'cfbd' AND timestamp > ?
    `, [twentyFourHoursAgo]);
        const oddsStats = await (0, database_1.getQuery)(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
      FROM api_usage_log 
      WHERE service = 'odds' AND timestamp > ?
    `, [twentyFourHoursAgo]);
        // Get latest credits remaining for each service
        const cfbdLastCredits = await (0, database_1.getQuery)(`
      SELECT credits_remaining 
      FROM api_usage_log 
      WHERE service = 'cfbd' AND credits_remaining IS NOT NULL 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
        const oddsLastCredits = await (0, database_1.getQuery)(`
      SELECT credits_remaining 
      FROM api_usage_log 
      WHERE service = 'odds' AND credits_remaining IS NOT NULL 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
        return {
            cfbd: {
                total: cfbdStats?.total || 0,
                successful: cfbdStats?.successful || 0,
                failed: (cfbdStats?.total || 0) - (cfbdStats?.successful || 0),
                lastCredits: cfbdLastCredits?.credits_remaining
            },
            odds: {
                total: oddsStats?.total || 0,
                successful: oddsStats?.successful || 0,
                failed: (oddsStats?.total || 0) - (oddsStats?.successful || 0),
                lastCredits: oddsLastCredits?.credits_remaining
            }
        };
    }
    catch (error) {
        console.error('Error getting API usage stats:', error);
        return {
            cfbd: { total: 0, successful: 0, failed: 0 },
            odds: { total: 0, successful: 0, failed: 0 }
        };
    }
};
exports.getAPIUsageStats = getAPIUsageStats;
// Check if we should skip API calls due to low credits
const shouldSkipAPICall = async (service) => {
    try {
        const stats = await (0, exports.getAPIUsageStats)();
        const serviceStats = service === 'cfbd' ? stats.cfbd : stats.odds;
        // If we have less than 50 credits remaining, start being conservative
        if (serviceStats.lastCredits && serviceStats.lastCredits < 50) {
            console.warn(`Low credits for ${service}: ${serviceStats.lastCredits} remaining`);
            return true;
        }
        // If error rate is high (>50%), pause calls
        if (serviceStats.total > 10) {
            const errorRate = serviceStats.failed / serviceStats.total;
            if (errorRate > 0.5) {
                console.warn(`High error rate for ${service}: ${(errorRate * 100).toFixed(1)}%`);
                return true;
            }
        }
        return false;
    }
    catch (error) {
        console.error('Error checking API call status:', error);
        return false; // Default to allowing calls if check fails
    }
};
exports.shouldSkipAPICall = shouldSkipAPICall;
// Clean up old API usage logs (keep 30 days)
const cleanupAPIUsageLogs = async () => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const result = await (0, database_1.runQuery)('DELETE FROM api_usage_log WHERE timestamp < ?', [thirtyDaysAgo]);
        if (result.changes > 0) {
            console.log(`Cleaned up ${result.changes} old API usage log entries`);
        }
    }
    catch (error) {
        console.error('Error cleaning up API usage logs:', error);
    }
};
exports.cleanupAPIUsageLogs = cleanupAPIUsageLogs;
//# sourceMappingURL=apiUsageMonitor.js.map