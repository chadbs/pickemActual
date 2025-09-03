import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrophyIcon,
  ChartBarIcon,
  FireIcon,
  StarIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  UserGroupIcon,
  ChartPieIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

import { LeaderboardSkeleton } from '../components/LoadingSpinner';
import WeekPicker from '../components/WeekPicker';
import { 
  useWeeklyLeaderboard, 
  useSeasonLeaderboard,
  useCombinedLeaderboard,
  useCurrentWeek,
  useWeek,
  useUsers,
  useDeleteUser,
  useTeamInsights,
  useLeaderboardInsights,
  useConferenceInsights,
  useCurrentUser
} from '../hooks/useApi';

type ViewMode = 'weekly' | 'season' | 'combined';
type InsightMode = 'teams' | 'stats' | 'upsets' | 'conferences';

const LeaderboardPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [showInsights, setShowInsights] = useState(false);
  const [insightMode, setInsightMode] = useState<InsightMode>('teams');
  const [showUserManagement, setShowUserManagement] = useState(false);
  const { data: currentWeek } = useCurrentWeek();
  const { currentUser } = useCurrentUser();
  
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
  
  // User management data
  const { data: users = [] } = useUsers();
  const deleteUserMutation = useDeleteUser();
  
  // Insights data
  const { data: teamInsights = [] } = useTeamInsights(selectedWeekData?.season_year);
  const { data: leaderboardInsights } = useLeaderboardInsights(selectedWeekData?.season_year);
  const { data: conferenceInsights } = useConferenceInsights(selectedWeekData?.season_year);

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

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!currentUser?.is_admin) {
      toast.error('Only admins can delete users');
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${userName}"? This will remove all their picks and cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      const result = await deleteUserMutation.mutateAsync(userId);
      toast.success(result.message || `User "${userName}" deleted successfully!`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error(error.response.data.error || 'Cannot delete admin users');
      } else {
        toast.error(error.response?.data?.error || 'Failed to delete user');
      }
    }
  };

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
  
  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '';
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
      {/* Enhanced Header */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <TrophyIcon className="h-8 w-8 text-yellow-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Leaderboard
          </h1>
          <div className="text-2xl">{getMedalEmoji(1)}</div>
        </div>
        <p className="text-lg text-gray-600 mb-4">
          {viewMode === 'weekly' && `Week ${selectedWeekData?.week_number || currentWeek?.week_number} Standings`}
          {viewMode === 'season' && `Season ${selectedWeekData?.season_year || currentWeek?.season_year} Standings`}
          {viewMode === 'combined' && 'Current Rankings'}
        </p>
        
        {/* Action Buttons */}
        <div className="flex justify-center space-x-3 mb-6">
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <ChartPieIcon className="h-4 w-4" />
            <span>{showInsights ? 'Hide' : 'Show'} Insights</span>
            {showInsights ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
          
          {currentUser?.is_admin && (
            <button
              onClick={() => setShowUserManagement(!showUserManagement)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              <UserGroupIcon className="h-4 w-4" />
              <span>Manage Users</span>
              {showUserManagement ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      
      {/* User Management Section - Admin Only */}
      {showUserManagement && currentUser?.is_admin && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <UserGroupIcon className="h-5 w-5" />
              <span>User Management</span>
            </h2>
            <div className="text-sm text-gray-500">
              {users.length} total users
            </div>
          </div>
          
          <div className="grid gap-3 max-h-60 overflow-y-auto">
            {users.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  {user.email && (
                    <div className="text-sm text-gray-600">{user.email}</div>
                  )}
                  {user.is_admin && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-500">
                    ID: {user.id}
                  </div>
                  {!user.is_admin && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      disabled={deleteUserMutation.isPending}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      title="Delete user"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Insights Section */}
      {showInsights && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <ChartPieIcon className="h-5 w-5" />
              <span>Season Insights</span>
            </h2>
            
            {/* Insight Mode Toggle */}
            <div className="bg-gray-100 rounded-lg p-1 inline-flex">
              <button
                onClick={() => setInsightMode('teams')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  insightMode === 'teams'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Teams
              </button>
              <button
                onClick={() => setInsightMode('conferences')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  insightMode === 'conferences'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Conferences
              </button>
              <button
                onClick={() => setInsightMode('stats')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  insightMode === 'stats'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Stats
              </button>
              <button
                onClick={() => setInsightMode('upsets')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                  insightMode === 'upsets'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upsets
              </button>
            </div>
          </div>
          
          {/* Team Performance Insights */}
          {insightMode === 'teams' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Teams That Beat The Spread Most</h3>
              <div className="grid gap-3">
                {teamInsights.slice(0, 8).map((team: any, index: number) => (
                  <div key={team.team_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="font-medium text-gray-900">
                        {index + 1}. {team.team_name}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        {team.spread_wins}/{team.total_games} games
                      </div>
                      <div className={`font-bold ${
                        team.spread_win_percentage >= 60 ? 'text-green-600' :
                        team.spread_win_percentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {team.spread_win_percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Conference Performance Insights */}
          {insightMode === 'conferences' && conferenceInsights && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🏟️ Conference Performance vs. Spread</h3>
              <div className="grid gap-3 mb-6">
                {conferenceInsights.conference_performance?.map((conf: any, index: number) => (
                  <div key={conf.conference} className={`p-4 rounded-lg border-l-4 ${
                    conf.spread_win_percentage >= 60 ? 'bg-green-50 border-green-500' :
                    conf.spread_win_percentage >= 50 ? 'bg-yellow-50 border-yellow-500' :
                    'bg-red-50 border-red-500'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="font-bold text-lg text-gray-900">
                          {index + 1}. {conf.conference}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          conf.spread_win_percentage >= 60 ? 'bg-green-100 text-green-800' :
                          conf.spread_win_percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {conf.spread_win_percentage >= 60 ? 'Excellent' :
                           conf.spread_win_percentage >= 50 ? 'Good' : 'Poor'} vs Spread
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          conf.spread_win_percentage >= 60 ? 'text-green-600' :
                          conf.spread_win_percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {conf.spread_win_percentage}%
                        </div>
                        <div className="text-sm text-gray-600">
                          {conf.spread_wins}-{conf.spread_losses} ATS
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-600">
                          📊 {conf.total_games} total games
                        </span>
                        <span className="text-gray-600">
                          ➕ Avg margin: {conf.avg_spread_margin > 0 ? '+' : ''}{conf.avg_spread_margin} pts
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {conf.spread_win_percentage >= 52.5 ? '🔥 Hot' : conf.spread_win_percentage <= 47.5 ? '❄️ Cold' : '➖ Average'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {conferenceInsights.conference_matchups?.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">⚔️ Recent Conference vs Conference Matchups</h4>
                  <div className="grid gap-3">
                    {conferenceInsights.conference_matchups.slice(0, 6).map((matchup: any, index: number) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-900">
                            Week {matchup.week}: {matchup.home_conference} vs {matchup.away_conference}
                          </div>
                          <div className="text-sm text-gray-600">
                            {matchup.spread > 0 ? `${matchup.favorite} -${Math.abs(matchup.spread)}` : `${matchup.favorite} +${Math.abs(matchup.spread)}`}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            {matchup.home_team} {matchup.home_score} - {matchup.away_team} {matchup.away_score}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-green-600">
                              Cover: {matchup.spread_winner}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              matchup.spread_winner === matchup.home_team ? 
                              'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {matchup.spread_winner === matchup.home_team ? matchup.home_conference : matchup.away_conference}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* General Statistics */}
          {insightMode === 'stats' && leaderboardInsights && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Season Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {leaderboardInsights.general?.overall_accuracy || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Accuracy</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {leaderboardInsights.general?.perfect_weeks || 0}
                  </div>
                  <div className="text-sm text-gray-600">Perfect Weeks</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {leaderboardInsights.general?.total_picks || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Picks</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(leaderboardInsights.general?.avg_spread_size || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Avg Spread</div>
                </div>
              </div>
              
              {leaderboardInsights.most_picked_teams?.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">🏈 Most Popular Teams</h4>
                  <div className="grid gap-2">
                    {leaderboardInsights.most_picked_teams.slice(0, 5).map((team: any, index: number) => (
                      <div key={team.selected_team} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="font-medium text-gray-900">
                          {index + 1}. {team.selected_team}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-600">
                            {team.pick_count} picks
                          </span>
                          <span className={`text-sm font-medium ${
                            team.success_rate >= 60 ? 'text-green-600' :
                            team.success_rate >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {team.success_rate}% success
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Biggest Upsets */}
          {insightMode === 'upsets' && leaderboardInsights?.biggest_upsets?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <span>Biggest Upsets (Favorites That Didn't Cover)</span>
              </h3>
              <div className="grid gap-3">
                {leaderboardInsights.biggest_upsets.map((upset: any, index: number) => (
                  <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-900">
                        Week {upset.week_number}: {upset.away_team} at {upset.home_team}
                      </div>
                      <div className="text-sm font-medium text-red-600">
                        {upset.spread > 0 ? '+' : ''}{upset.spread} point spread
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Favorite: <span className="font-medium">{upset.favorite_team}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Final: {upset.home_team} {upset.home_score} - {upset.away_team} {upset.away_score}
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        Cover: {upset.spread_winner}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Enhanced Leaderboard */}
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
                      
                      {/* Enhanced stats display */}
                      <div className="text-xs text-gray-500 mt-1">
                        {viewMode === 'combined' && (
                          <div className="flex items-center space-x-4">
                            {entry.weeks_played && (
                              <span className="flex items-center space-x-1">
                                <span>📅 {entry.weeks_played} weeks</span>
                              </span>
                            )}
                            {entry.avg_weekly_percentage && (
                              <span className="flex items-center space-x-1">
                                <span>📈 {entry.avg_weekly_percentage.toFixed(1)}% avg</span>
                              </span>
                            )}
                            {entry.best_week && (
                              <span className="flex items-center space-x-1">
                                <FireIcon className="h-3 w-3 text-orange-500" />
                                <span>Best: {entry.best_week.toFixed(1)}%</span>
                              </span>
                            )}
                          </div>
                        )}
                        
                        {viewMode === 'season' && (
                          <div className="flex items-center space-x-4">
                            <span>Record: {correct}-{total - correct}</span>
                            {entry.weeks_participated && (
                              <span>📅 {entry.weeks_participated} weeks</span>
                            )}
                            {entry.best_week_percentage && (
                              <span className="flex items-center space-x-1">
                                <FireIcon className="h-3 w-3 text-orange-500" />
                                <span>Best: {entry.best_week_percentage.toFixed(1)}%</span>
                              </span>
                            )}
                          </div>
                        )}
                        
                        {viewMode === 'weekly' && (
                          <div className="flex items-center space-x-4">
                            <span>Record: {correct}-{total - correct}</span>
                            {entry.picks_made !== undefined && entry.available_games && (
                              <span>Completion: {entry.picks_made}/{entry.available_games}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Enhanced Stats */}
                  <div className="text-right">
                    <div className="flex items-center space-x-6">
                      {/* Win-Loss Record */}
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">W-L</div>
                        <div className="font-bold text-sm text-gray-900">
                          {correct}-{total - correct}
                        </div>
                      </div>
                      
                      {/* Main Stats */}
                      <div className="text-center">
                        <div className="font-bold text-xl text-gray-900">
                          {correct}/{total}
                        </div>
                        <div className={`text-lg font-bold ${getPercentageColor(percentage)}`}>
                          {percentage.toFixed(1)}%
                        </div>
                      </div>

                      {/* Trend (for combined view) */}
                      {viewMode === 'combined' && entry.recent_avg !== undefined && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Recent</div>
                          <div className={`text-sm font-bold ${getPercentageColor(entry.recent_avg || 0)}`}>
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

      {/* Enhanced Stats Summary */}
      {currentData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <ChartBarIcon className="h-5 w-5" />
            <span>Leaderboard Stats</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{currentData.length}</div>
              <div className="text-sm text-gray-600 font-medium">Players</div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {currentData.length > 0 ? (currentData[0]?.percentage || currentData[0]?.season_percentage || 0).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-600 font-medium">Leader</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-700">
                {currentData.length > 0 ? (
                  currentData.reduce((sum, entry) => sum + (entry.percentage || entry.season_percentage || 0), 0) / currentData.length
                ).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-600 font-medium">Average</div>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {currentData.filter((entry) => (entry.percentage || entry.season_percentage || 0) === 100).length}
              </div>
              <div className="text-sm text-gray-600 font-medium">Perfect</div>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {viewMode === 'weekly' 
                  ? selectedWeekData?.week_number || currentWeek?.week_number || 0
                  : selectedWeekData?.season_year || currentWeek?.season_year || new Date().getFullYear()
                }
              </div>
              <div className="text-sm text-gray-600 font-medium">
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
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          <span>🎯</span>
          <span>Make Picks</span>
        </Link>
        <Link
          to="/"
          className="flex items-center space-x-2 bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
        >
          <span>🏈</span>
          <span>Current Games</span>
        </Link>
      </div>
    </div>
  );
};

export default LeaderboardPage;