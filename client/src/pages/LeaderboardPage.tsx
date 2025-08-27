import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrophyIcon,
  ChartBarIcon,
  FireIcon,
  StarIcon
} from '@heroicons/react/24/outline';

import { LeaderboardSkeleton } from '../components/LoadingSpinner';
import WeekPicker from '../components/WeekPicker';
import { 
  useWeeklyLeaderboard, 
  useSeasonLeaderboard,
  useCombinedLeaderboard,
  useCurrentWeek,
  useWeek
} from '../hooks/useApi';

type ViewMode = 'weekly' | 'season' | 'combined';

const LeaderboardPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const { data: currentWeek } = useCurrentWeek();
  
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  
  // Set initial week to current week when it loads
  useEffect(() => {
    if (currentWeek && selectedWeekId === null) {
      setSelectedWeekId(currentWeek.id);
    }
  }, [currentWeek, selectedWeekId]);
  
  const { data: selectedWeekData } = useWeek(selectedWeekId || 0);
  const { data: weeklyLeaderboard = [], isLoading: weeklyLoading } = useWeeklyLeaderboard({
    week: selectedWeekData?.week_number,
    year: selectedWeekData?.season_year
  });
  const { data: seasonLeaderboard = [], isLoading: seasonLoading } = useSeasonLeaderboard(selectedWeekData?.season_year);
  const { data: combinedLeaderboard = [], isLoading: combinedLoading } = useCombinedLeaderboard();

  const getCurrentData = () => {
    switch (viewMode) {
      case 'weekly':
        return { data: weeklyLeaderboard, loading: weeklyLoading };
      case 'season':
        return { data: seasonLeaderboard, loading: seasonLoading };
      default:
        return { data: combinedLeaderboard, loading: combinedLoading };
    }
  };

  const { data: currentData, loading } = getCurrentData();

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-400">
            <TrophyIcon className="h-4 w-4 text-yellow-600" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-400">
            <span className="text-sm font-bold text-gray-600">2</span>
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-400">
            <span className="text-sm font-bold text-orange-600">3</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 border border-gray-300">
            <span className="text-sm font-medium text-gray-600">{rank}</span>
          </div>
        );
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRowClassName = (rank: number) => {
    let baseClass = 'leaderboard-row p-4 ';
    
    switch (rank) {
      case 1:
        return baseClass + 'leaderboard-rank-1';
      case 2:
        return baseClass + 'leaderboard-rank-2';
      case 3:
        return baseClass + 'leaderboard-rank-3';
      default:
        return baseClass;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="h-8 bg-gray-300 rounded w-48 mx-auto mb-4 animate-pulse" />
        </div>
        <LeaderboardSkeleton count={10} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Leaderboard
        </h1>
        <p className="text-gray-600">
          {viewMode === 'weekly' && `Week ${selectedWeekData?.week_number || currentWeek?.week_number} Standings`}
          {viewMode === 'season' && `Season ${selectedWeekData?.season_year || currentWeek?.season_year} Standings`}
          {viewMode === 'combined' && 'Current Rankings'}
        </p>
      </div>

      {/* Week Picker - only show for weekly and season views */}
      {(viewMode === 'weekly' || viewMode === 'season') && (
        <WeekPicker 
          selectedWeek={selectedWeekId}
          onWeekChange={setSelectedWeekId}
          className="mb-6"
        />
      )}

      {/* View Toggle */}
      <div className="flex justify-center">
        <div className="bg-white rounded-lg shadow-md p-1 inline-flex">
          <button
            onClick={() => setViewMode('combined')}
            className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
              viewMode === 'combined'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
              viewMode === 'weekly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
              viewMode === 'season'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Season
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      {currentData.length === 0 ? (
        <div className="text-center py-12">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rankings Yet</h3>
          <p className="text-gray-600">
            {viewMode === 'weekly' 
              ? "No picks have been made for this week yet."
              : "The season hasn't started yet. Check back after some games are completed!"
            }
          </p>
          <Link
            to="/picks"
            className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            Make Your Picks
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {currentData.map((entry, index) => {
            const rank = index + 1;
            const percentage = viewMode === 'season' 
              ? entry.season_percentage || 0
              : viewMode === 'weekly'
                ? entry.percentage || 0
                : entry.season_percentage || entry.week_percentage || 0;
            
            const correct = viewMode === 'season'
              ? entry.total_correct || entry.season_correct || 0
              : viewMode === 'weekly'
                ? entry.correct_picks || 0
                : entry.season_correct || entry.week_correct || 0;
                
            const total = viewMode === 'season'
              ? entry.total_picks || entry.season_total || 0
              : viewMode === 'weekly'
                ? entry.total_picks || 0
                : entry.season_total || entry.week_total || 0;

            return (
              <div key={entry.user_id || entry.id} className={getRowClassName(rank)}>
                <div className="flex items-center justify-between">
                  {/* Left Side - Rank and Name */}
                  <div className="flex items-center space-x-4">
                    {getRankBadge(rank)}
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/profile/${entry.user_id || entry.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors duration-200"
                        >
                          {entry.name}
                        </Link>
                        
                        {entry.is_admin && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                        
                        {rank === 1 && (
                          <StarIcon className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      
                      {/* Additional stats for combined view */}
                      {viewMode === 'combined' && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                          {entry.weeks_played && (
                            <span>{entry.weeks_played} weeks played</span>
                          )}
                          {entry.avg_weekly_percentage && (
                            <span>
                              {entry.avg_weekly_percentage.toFixed(1)}% avg
                            </span>
                          )}
                          {entry.best_week && (
                            <span className="flex items-center space-x-1">
                              <FireIcon className="h-3 w-3" />
                              <span>Best: {entry.best_week.toFixed(1)}%</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side - Stats */}
                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      {/* Record */}
                      <div>
                        <div className="font-bold text-lg text-gray-900">
                          {correct}/{total}
                        </div>
                        <div className={`text-sm font-medium ${getPercentageColor(percentage)}`}>
                          {percentage.toFixed(1)}%
                        </div>
                      </div>

                      {/* Trend (for combined view) */}
                      {viewMode === 'combined' && entry.recent_avg !== undefined && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Recent</div>
                          <div className={`text-sm font-medium ${getPercentageColor(entry.recent_avg || 0)}`}>
                            {(entry.recent_avg || 0).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Summary */}
      {currentData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{currentData.length}</div>
              <div className="text-sm text-gray-600">Total Players</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {currentData.length > 0 ? currentData[0]?.percentage?.toFixed(1) || 0 : 0}%
              </div>
              <div className="text-sm text-gray-600">Leader</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-gray-700">
                {currentData.length > 0 ? (
                  currentData.reduce((sum, entry) => sum + (entry.percentage || entry.season_percentage || 0), 0) / currentData.length
                ).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-600">Average</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {viewMode === 'weekly' 
                  ? selectedWeekData?.week_number || currentWeek?.week_number || 0
                  : selectedWeekData?.season_year || currentWeek?.season_year || new Date().getFullYear()
                }
              </div>
              <div className="text-sm text-gray-600">
                {viewMode === 'weekly' ? 'Week' : 'Season'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Link
          to="/picks"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          Make Picks
        </Link>
        <Link
          to="/"
          className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
        >
          Current Games
        </Link>
      </div>
    </div>
  );
};

export default LeaderboardPage;