export interface OddsAPIGameResponse {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Array<{
        key: string;
        title: string;
        last_update: string;
        markets: Array<{
            key: string;
            outcomes: Array<{
                name: string;
                price: number;
                point?: number;
            }>;
        }>;
    }>;
}
export interface ParsedOdds {
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    spread?: {
        favorite: string;
        line: number;
        homePrice: number;
        awayPrice: number;
    };
    moneyline?: {
        homePrice: number;
        awayPrice: number;
    };
    total?: {
        over: number;
        under: number;
        line: number;
    };
}
export declare const getNCAAFootballOdds: () => Promise<OddsAPIGameResponse[]>;
export declare const parseOddsData: (oddsData: OddsAPIGameResponse[]) => ParsedOdds[];
export declare const matchOddsToGames: (cfbdGames: any[], oddsData: ParsedOdds[]) => any[];
export declare const checkAPIUsage: () => Promise<{
    remaining: number;
    used: number;
}>;
//# sourceMappingURL=oddsApi.d.ts.map