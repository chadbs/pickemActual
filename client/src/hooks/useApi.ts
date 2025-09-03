import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  userApi,
  weekApi,
  gameApi,
  pickApi,
  leaderboardApi,
  adminApi,
  getCurrentWeekData,
} from '../api';
import type { User, CreatePickRequest } from '../types';

// ========== USER HOOKS ==========

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll().then(res => res.data),
  });
};

export const useUser = (id: number) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => userApi.getById(id).then(res => res.data),
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ name, email }: { name: string; email?: string }) =>
      userApi.createOrGet(name, email).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// ========== WEEK HOOKS ==========

export const useCurrentWeek = () => {
  return useQuery({
    queryKey: ['week', 'current'],
    queryFn: () => weekApi.getCurrent().then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useWeeks = (year?: number) => {
  return useQuery({
    queryKey: ['weeks', year],
    queryFn: () => weekApi.getAll(year).then(res => res.data),
  });
};

export const useWeek = (id: number) => {
  return useQuery({
    queryKey: ['week', id],
    queryFn: () => weekApi.getById(id).then(res => res.data),
    enabled: !!id,
  });
};

// ========== GAME HOOKS ==========

export const useCurrentWeekGames = (userId?: number) => {
  return useQuery({
    queryKey: ['games', 'current', userId],
    queryFn: () => gameApi.getAll({ user_id: userId }).then(res => res.data),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useWeekGames = (weekId: number, userId?: number) => {
  return useQuery({
    queryKey: ['games', 'week', weekId, userId],
    queryFn: () => gameApi.getByWeek(weekId, userId).then(res => res.data),
    enabled: !!weekId,
  });
};

export const useGame = (id: number, userId?: number) => {
  return useQuery({
    queryKey: ['game', id, userId],
    queryFn: () => gameApi.getById(id, userId).then(res => res.data),
    enabled: !!id,
  });
};

// ========== PICK HOOKS ==========

export const usePicks = (params?: { week?: number; year?: number; user_id?: number }) => {
  return useQuery({
    queryKey: ['picks', params],
    queryFn: () => pickApi.getAll(params).then(res => res.data),
  });
};

export const useUserPicks = (userId: number) => {
  return useQuery({
    queryKey: ['picks', 'user', userId],
    queryFn: () => pickApi.getAll({ user_id: userId }).then(res => res.data),
    enabled: !!userId,
  });
};

export const usePickCompletion = (userId: number, params?: { week?: number; year?: number }) => {
  return useQuery({
    queryKey: ['pickCompletion', userId, params],
    queryFn: () => pickApi.getCompletion(userId, params).then(res => res.data),
    enabled: !!userId,
  });
};

export const useGamePicks = (gameId: number) => {
  return useQuery({
    queryKey: ['gamePicks', gameId],
    queryFn: () => pickApi.getAll({ game_id: gameId }).then(res => res.data),
    enabled: !!gameId,
  });
};

export const useCreatePick = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePickRequest) => pickApi.create(data).then(res => res.data),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['pickCompletion'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
};

export const useUpdatePick = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreatePickRequest> }) =>
      pickApi.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['pickCompletion'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
};

// ========== LEADERBOARD HOOKS ==========

export const useWeeklyLeaderboard = (params?: { week?: number; year?: number }) => {
  return useQuery({
    queryKey: ['leaderboard', 'weekly', params],
    queryFn: () => leaderboardApi.getWeekly(params).then(res => res.data),
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useSeasonLeaderboard = (year?: number) => {
  return useQuery({
    queryKey: ['leaderboard', 'season', year],
    queryFn: () => leaderboardApi.getSeason(year).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCombinedLeaderboard = () => {
  return useQuery({
    queryKey: ['leaderboard', 'combined'],
    queryFn: () => leaderboardApi.getCombined().then(res => res.data),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useUserHistory = (userId: number, year?: number) => {
  return useQuery({
    queryKey: ['userHistory', userId, year],
    queryFn: () => leaderboardApi.getUserHistory(userId, year).then(res => res.data),
    enabled: !!userId,
  });
};

export const useHeadToHead = (userId1: number, userId2: number, year?: number) => {
  return useQuery({
    queryKey: ['headToHead', userId1, userId2, year],
    queryFn: () => leaderboardApi.getHeadToHead(userId1, userId2, year).then(res => res.data),
    enabled: !!userId1 && !!userId2,
  });
};

export const useTeamInsights = (year?: number) => {
  return useQuery({
    queryKey: ['teamInsights', year],
    queryFn: () => leaderboardApi.getTeamInsights(year).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useLeaderboardInsights = (year?: number) => {
  return useQuery({
    queryKey: ['leaderboardInsights', year],
    queryFn: () => leaderboardApi.getInsights(year).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useConferenceInsights = (year?: number) => {
  return useQuery({
    queryKey: ['conferenceInsights', year],
    queryFn: () => leaderboardApi.getConferenceInsights(year).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// ========== COMBINED DATA HOOKS ==========

export const useCurrentWeekData = (userId?: number) => {
  return useQuery({
    queryKey: ['currentWeekData', userId],
    queryFn: () => getCurrentWeekData(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// ========== ADMIN HOOKS ==========

export const useAdminDashboard = () => {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.getDashboard().then(res => res.data),
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useFetchGames = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.fetchGames().then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['week'] });
    },
  });
};

export const useFetchGamesForWeek = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { year: number; week_number: number; week_id?: number }) => 
      adminApi.fetchGamesForWeek(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['week'] });
    },
  });
};

export const useUpdateScores = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.updateScores().then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
};

export const useFetchSpreads = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.fetchSpreads().then(res => res.data),
    onSuccess: () => {
      // Invalidate all game-related queries to refresh spread data
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['game'] });
      queryClient.invalidateQueries({ queryKey: ['currentWeekData'] });
      
      // Force refetch of current games
      queryClient.refetchQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'games' || query.queryKey[0] === 'currentWeekData';
        }
      });
    },
  });
};

export const usePreviewGames = (year: number, week: number) => {
  return useQuery({
    queryKey: ['admin', 'preview', year, week],
    queryFn: () => adminApi.previewGames(year, week).then(res => res.data),
    enabled: !!year && !!week,
  });
};

export const useCreateGames = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { week_id: number; selected_games: any[] }) =>
      adminApi.createGames(data).then(res => res.data),
    onSuccess: () => {
      // Invalidate all game-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['game'] });
      queryClient.invalidateQueries({ queryKey: ['week'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['pickCompletion'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      
      // Force refetch of all game queries (including week-specific ones)
      queryClient.refetchQueries({ 
        predicate: (query) => {
          return query.queryKey[0] === 'games' || 
                 query.queryKey[0] === 'game' || 
                 query.queryKey[0] === 'week';
        }
      });
    },
  });
};

export const useRecalculateScores = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.recalculate().then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => adminApi.deleteUser(userId).then(res => res.data),
    onSuccess: () => {
      // Invalidate related queries to refresh user data
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
};

export const useResetApp = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.resetApp().then(res => res.data),
    onSuccess: () => {
      // Invalidate all queries to refresh the app state
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['week'] });
    },
  });
};

export const useCreateSeasonWeeks = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (year?: number) => adminApi.createSeasonWeeks(year).then(res => res.data),
    onSuccess: () => {
      // Invalidate weeks queries to refresh the week selector
      queryClient.invalidateQueries({ queryKey: ['weeks'] });
      queryClient.invalidateQueries({ queryKey: ['week'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
};

export const usePreviewOrphanedData = () => {
  return useQuery({
    queryKey: ['admin', 'orphaned-data'],
    queryFn: () => adminApi.previewOrphanedData().then(res => res.data),
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useCleanupOrphanedData = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => adminApi.cleanupOrphanedData().then(res => res.data),
    onSuccess: () => {
      // Invalidate all user-related queries to refresh after cleanup
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['picks'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orphaned-data'] });
    },
  });
};

// ========== UTILITY HOOKS ==========

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

// Current user management (simple localStorage-based)
export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
  
  return {
    currentUser,
    setCurrentUser,
    isLoggedIn: !!currentUser,
    logout: () => setCurrentUser(null),
  };
};

import React from 'react';