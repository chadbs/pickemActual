export declare const logAPICall: (service: "cfbd" | "odds", endpoint: string, success: boolean, error?: string, creditsRemaining?: number) => Promise<void>;
export declare const getAPIUsageStats: () => Promise<{
    cfbd: {
        total: number;
        successful: number;
        failed: number;
        lastCredits?: number;
    };
    odds: {
        total: number;
        successful: number;
        failed: number;
        lastCredits?: number;
    };
}>;
export declare const shouldSkipAPICall: (service: "cfbd" | "odds") => Promise<boolean>;
export declare const cleanupAPIUsageLogs: () => Promise<void>;
//# sourceMappingURL=apiUsageMonitor.d.ts.map