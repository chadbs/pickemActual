interface GameData {
    id?: string | number;
    home_team: string;
    away_team: string;
    start_date: string;
    startDate?: string;
    home_score?: number;
    away_score?: number;
    completed?: boolean;
    spread?: number;
    favorite_team?: string;
    source: 'cfbd' | 'espn' | 'scrape' | 'odds';
}
export declare const fetchGamesWithFallback: (year: number, week: number) => Promise<GameData[]>;
export declare const fetchScoresWithFallback: (year: number, week: number) => Promise<GameData[]>;
export declare const getDataSourceStatus: () => Promise<{
    cfbd: {
        available: boolean;
        reason?: string;
    };
    odds: {
        available: boolean;
        reason?: string;
    };
    espn: {
        available: boolean;
        reason?: string;
    };
    scraping: {
        available: boolean;
        reason?: string;
    };
}>;
export declare const refreshGameData: (year: number, week: number, preferredSource?: "api" | "scrape") => Promise<GameData[]>;
export {};
//# sourceMappingURL=hybridDataFetcher.d.ts.map