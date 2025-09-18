interface SpreadData {
    homeTeam: string;
    awayTeam: string;
    spread: number;
    favoriteTeam: string;
    source: string;
}
export declare const scrapeESPNSpreads: () => Promise<SpreadData[]>;
export declare const scrapeSportsReferenceSpreads: () => Promise<SpreadData[]>;
export declare const scrapeVegasInsiderSpreads: () => Promise<SpreadData[]>;
export declare const scrapeAllSpreads: () => Promise<SpreadData[]>;
export declare const normalizeTeamNameForMatching: (teamName: string) => string;
export declare const matchSpreadToGames: (games: any[], spreads: SpreadData[]) => any[];
export {};
//# sourceMappingURL=spreadScraper.d.ts.map