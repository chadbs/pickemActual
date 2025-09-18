interface ScrapedGame {
    id: string;
    home_team: string;
    away_team: string;
    start_date: string;
    home_score?: number;
    away_score?: number;
    completed: boolean;
    spread?: number;
    favorite_team?: string;
    source: 'scrape';
}
export declare const scrapeESPNGames: (date?: string) => Promise<ScrapedGame[]>;
export declare const scrapeCBSSports: () => Promise<ScrapedGame[]>;
export declare const scrapeAllSources: () => Promise<ScrapedGame[]>;
export declare const scrapeGamesForWeek: (year: number, week: number) => Promise<ScrapedGame[]>;
export {};
//# sourceMappingURL=webScraper.d.ts.map