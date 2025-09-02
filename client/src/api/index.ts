import axios from 'axios';
import type {
  User,
  Week,
  Game,
  GameWithPick,
  CreatePickRequest,
  UpdatePickRequest,
  CreateGameRequest,
  WeekData
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3003/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
);

// ========== USER ENDPOINTS ==========

export const userApi = {
  getAll: () => api.get<User[]>('/users'),
  
  getById: (id: number) => api.get<User>(`/users/${id}`),
  
  createOrGet: (name: string, email?: string) => 
    api.post<User>('/users', { name, email }),
  
  update: (id: number, data: Partial<User>) => 
    api.put<User>(`/users/${id}`, data),
  
  delete: (id: number) => api.delete(`/users/${id}`),
  
  getPickHistory: (id: number) => api.get<any[]>(`/users/${id}/picks`),
};

// ========== WEEK ENDPOINTS ==========

export const weekApi = {
  getAll: (year?: number) => 
    api.get<Week[]>('/weeks', { params: { year } }),
  
  getCurrent: () => api.get<Week>('/weeks/current'),
  
  getById: (id: number) => api.get<Week>(`/weeks/${id}`),
  
  getByWeekAndYear: (year: number, weekNumber: number) =>
    api.get<Week>(`/weeks/season/${year}/week/${weekNumber}`),
  
  getSummary: (id: number) => api.get<any>(`/weeks/${id}/summary`),
  
  create: (data: Partial<Week>) => api.post<Week>('/weeks', data),
  
  update: (id: number, data: Partial<Week>) => 
    api.put<Week>(`/weeks/${id}`, data),
  
  delete: (id: number) => api.delete(`/weeks/${id}`),
  
  activate: (id: number) => api.post<Week>(`/weeks/${id}/activate`),
};

// ========== GAME ENDPOINTS ==========

export const gameApi = {
  getAll: (params?: { week?: number; year?: number; user_id?: number }) =>
    api.get<GameWithPick[]>('/games', { params }),
  
  getById: (id: number, userId?: number) =>
    api.get<GameWithPick>(`/games/${id}`, { params: { user_id: userId } }),
  
  getByWeek: (weekId: number, userId?: number) =>
    api.get<GameWithPick[]>(`/games/week/${weekId}`, { params: { user_id: userId } }),
  
  getPicks: (gameId: number) => api.get<any[]>(`/games/${gameId}/picks`),
  
  create: (data: CreateGameRequest) => api.post<Game>('/games', data),
  
  update: (id: number, data: Partial<Game>) => 
    api.put<Game>(`/games/${id}`, data),
  
  delete: (id: number) => api.delete(`/games/${id}`),
};

// ========== PICK ENDPOINTS ==========

export const pickApi = {
  getAll: (params?: { week?: number; year?: number; user_id?: number; game_id?: number }) =>
    api.get<any[]>('/picks', { params }),
  
  getById: (id: number) => api.get<any>(`/picks/${id}`),
  
  create: (data: CreatePickRequest) => api.post<any>('/picks', data),
  
  update: (id: number, data: Partial<UpdatePickRequest>) =>
    api.put<any>(`/picks/${id}`, data),
  
  delete: (id: number) => api.delete(`/picks/${id}`),
  
  getCompletion: (userId: number, params?: { week?: number; year?: number }) =>
    api.get<any>(`/picks/user/${userId}/completion`, { params }),
};

// ========== LEADERBOARD ENDPOINTS ==========

export const leaderboardApi = {
  getWeekly: (params?: { week?: number; year?: number }) =>
    api.get<any[]>('/leaderboard/weekly', { params }),
  
  getSeason: (year?: number) =>
    api.get<any[]>('/leaderboard/season', { params: { year } }),
  
  getCombined: () => api.get<any[]>('/leaderboard/combined'),
  
  getUserHistory: (userId: number, year?: number) =>
    api.get<any[]>(`/leaderboard/user/${userId}/history`, { params: { year } }),
  
  getHeadToHead: (userId1: number, userId2: number, year?: number) =>
    api.get<any>(`/leaderboard/head-to-head/${userId1}/${userId2}`, { params: { year } }),
  
  getStats: (year?: number) =>
    api.get<any>('/leaderboard/stats', { params: { year } }),
};

// ========== ADMIN ENDPOINTS ==========

export const adminApi = {
  getDashboard: () => api.get<any>('/admin/dashboard'),
  
  fetchGames: () => api.post<{ message: string }>('/admin/fetch-games'),
  
  fetchGamesForWeek: (data: { year: number; week_number: number; week_id?: number }) => 
    api.post<{ message: string; games_created: number; week_info: any }>('/admin/fetch-games-for-week', data),
  
  updateScores: () => api.post<{ message: string }>('/admin/update-scores'),
  
  fetchSpreads: () => api.post<{ message: string; updated: number; total: number }>('/admin/fetch-spreads'),
  
  updateGameSpread: (gameId: number, data: { spread: number; favorite_team: string }) =>
    api.post<{ message: string; spread: number; favorite_team: string }>(`/admin/update-game-spread/${gameId}`, data),
  
  clearGameSpread: (gameId: number) =>
    api.delete<{ message: string }>(`/admin/clear-game-spread/${gameId}`),
  
  previewGames: (year: number, week: number) =>
    api.get<any>(`/admin/preview-games/${year}/${week}`),
  
  createGames: (data: { week_id: number; selected_games: any[] }) =>
    api.post<any>('/admin/create-games', data),
  
  recalculate: () => api.post<{ message: string }>('/admin/recalculate'),
  
  resetApp: () => api.post<{ message: string; warning: string }>('/admin/reset-app', { confirm: 'RESET_ALL_DATA' }),
  
  createSeasonWeeks: (year?: number) => api.post<{ message: string; weeks: any[]; season_year: number }>('/admin/create-season-weeks', { year }),
  
  getAPIUsage: () => api.get<any>('/admin/api-usage'),
  
  maintenance: (action: string) =>
    api.post<{ message: string }>('/admin/maintenance', { action }),
  
  export: (type: string, year?: number) =>
    api.get<any>(`/admin/export/${type}`, { params: { year } }),
};

// ========== HEALTH CHECK ==========

export const healthApi = {
  check: () => api.get<{ status: string; timestamp: string; version: string }>('/health'),
};

// ========== CONVENIENCE FUNCTIONS ==========

// Get current week with games and leaderboard
export const getCurrentWeekData = async (userId?: number): Promise<WeekData> => {
  const [weekResponse, gamesResponse, leaderboardResponse] = await Promise.all([
    weekApi.getCurrent(),
    gameApi.getAll({ user_id: userId }),
    leaderboardApi.getWeekly(),
  ]);

  return {
    week: weekResponse.data,
    games: gamesResponse.data,
    leaderboard: leaderboardResponse.data,
  };
};

// Submit multiple picks at once
export const submitPicks = async (picks: CreatePickRequest[]): Promise<any[]> => {
  const results = await Promise.all(
    picks.map(pick => pickApi.create(pick))
  );
  
  return results.map(r => r.data);
};

// Get user's complete season stats
export const getUserSeasonStats = async (userId: number, year?: number) => {
  const [history, completion] = await Promise.all([
    leaderboardApi.getUserHistory(userId, year),
    pickApi.getCompletion(userId, { year }),
  ]);

  return {
    history: history.data,
    completion: completion.data,
  };
};

export default api;