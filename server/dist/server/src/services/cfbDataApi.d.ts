export interface CFBDGameResponse {
    id: number;
    season: number;
    week: number;
    season_type: string;
    start_date: string;
    start_time_tbd: boolean;
    neutral_site: boolean;
    conference_game: boolean;
    attendance?: number;
    venue_id?: number;
    venue?: string;
    home_team: string;
    home_conference?: string;
    home_points?: number;
    away_team: string;
    away_conference?: string;
    away_points?: number;
    completed: boolean;
}
export interface CFBDTeam {
    id: number;
    school: string;
    mascot: string;
    abbreviation: string;
    alt_name_1?: string;
    alt_name_2?: string;
    alt_name_3?: string;
    classification: string;
    conference: string;
    division?: string;
    color: string;
    alt_color: string;
    logos: string[];
}
export interface CFBDRanking {
    season: number;
    season_type: string;
    week: number;
    poll: string;
    ranks: Array<{
        rank: number;
        school: string;
        conference: string;
        first_place_votes?: number;
        points?: number;
    }>;
}
export declare const getGamesForWeek: (year: number, week: number) => Promise<CFBDGameResponse[]>;
export declare const getTeams: (year: number) => Promise<CFBDTeam[]>;
export declare const getRankings: (year: number, week: number) => Promise<CFBDRanking[]>;
export declare const getGameScores: (year: number, week: number) => Promise<CFBDGameResponse[]>;
export declare const isFavoriteTeam: (teamName: string | null | undefined) => boolean;
export declare const getTopGamesForWeek: (year: number, week: number) => Promise<CFBDGameResponse[]>;
//# sourceMappingURL=cfbDataApi.d.ts.map