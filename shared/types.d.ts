export interface User {
    id: number;
    name: string;
    email?: string;
    created_at: string;
    is_admin: boolean;
}
export interface Week {
    id: number;
    week_number: number;
    season_year: number;
    deadline: string;
    is_active: boolean;
    status: 'upcoming' | 'active' | 'completed';
}
export interface Game {
    id: number;
    week_id: number;
    external_game_id?: string;
    home_team: string;
    away_team: string;
    spread?: number;
    favorite_team?: string;
    start_time: string;
    status: 'scheduled' | 'live' | 'completed';
    home_score?: number;
    away_score?: number;
    spread_winner?: string;
    is_favorite_team_game: boolean;
    created_at: string;
}
export interface Pick {
    id: number;
    user_id: number;
    game_id: number;
    selected_team: string;
    confidence_points: number;
    is_correct?: boolean;
    created_at: string;
    updated_at: string;
}
export interface WeeklyScore {
    id: number;
    user_id: number;
    week_id: number;
    correct_picks: number;
    total_picks: number;
    percentage: number;
    weekly_rank: number;
    updated_at: string;
}
export interface SeasonStanding {
    id: number;
    user_id: number;
    season_year: number;
    total_correct: number;
    total_picks: number;
    season_percentage: number;
    season_rank: number;
    updated_at: string;
}
export interface GameWithPick extends Game {
    user_pick?: Pick;
    deadline?: string;
    week_number?: number;
    season_year?: number;
}
export interface LeaderboardEntry {
    user: User;
    weekly_score?: WeeklyScore;
    season_standing?: SeasonStanding;
}
export interface WeekData {
    week: Week;
    games: GameWithPick[];
    leaderboard: LeaderboardEntry[];
}
export interface CreatePickRequest {
    game_id: number;
    selected_team: string;
    user_name: string;
}
export interface UpdatePickRequest extends CreatePickRequest {
    pick_id: number;
}
export interface CreateGameRequest {
    week_id: number;
    home_team: string;
    away_team: string;
    spread?: number;
    start_time: string;
}
export interface CFBDGame {
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
export interface OddsAPIGame {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Array<{
        key: string;
        title: string;
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
export declare const FAVORITE_TEAMS: readonly ["Colorado Buffaloes", "Colorado State Rams", "Nebraska Cornhuskers", "Michigan Wolverines"];
export declare const FAVORITE_TEAM_ALIASES: Record<string, string[]>;
//# sourceMappingURL=types.d.ts.map