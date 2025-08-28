import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UsersIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

import GameCard from '../components/GameCard';
import WeekPicker from '../components/WeekPicker';
import LoadingSpinner, { GameCardSkeleton } from '../components/LoadingSpinner';
import { 
  useWeekGames, 
  useCurrentWeek, 
  useCurrentUser,
  usePickCompletion,
  useWeek,
  useFetchSpreads
} from '../hooks/useApi';

const PicksPage: React.FC = () => {
  const [showAllGames, setShowAllGames] = useState(false);
  const { currentUser } = useCurrentUser();
  const { data: currentWeek, isLoading: weekLoading } = useCurrentWeek();
  const fetchSpreadsMutation = useFetchSpreads();
  
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  
  // Set initial week to current week when it loads
  useEffect(() => {
    if (currentWeek && selectedWeekId === null) {
      setSelectedWeekId(currentWeek.id);
    }
  }, [currentWeek, selectedWeekId]);
  
  const { data: selectedWeekData } = useWeek(selectedWeekId || 0);
  const { data: games = [], isLoading: gamesLoading, refetch: refetchGames } = useWeekGames(selectedWeekId || 0, currentUser?.id);
  
  // Debug logging for games data
  useEffect(() => {
    if (games.length > 0) {
      console.log('Current games data:', games);
      console.log('Sample game spread info:', {
        game: games[0]?.away_team + ' @ ' + games[0]?.home_team,
        spread: games[0]?.spread,
        favorite_team: games[0]?.favorite_team
      });
    }
  }, [games]);
  const { data: completion, isLoading: completionLoading } = usePickCompletion(
    currentUser?.id || 0,
    { 
      week: selectedWeekData?.week_number, 
      year: selectedWeekData?.season_year 
    }
  );

  const handlePickUpdate = () => {
    refetchGames();
  };

  const handleFetchSpreads = async () => {
    try {
      console.log('Starting fetch spreads...');
      const result = await fetchSpreadsMutation.mutateAsync();
      console.log('Fetch spreads result:', result);
      alert(`✅ Updated spreads for ${result.updated} out of ${result.total} games!`);
      // Games will auto-refresh due to cache invalidation in the hook
    } catch (error) {
      console.error('Failed to fetch spreads:', error);
      alert('❌ Failed to fetch spreads. Check console for details.');
    }
  };

  // Filter games based on view preference
  const filteredGames = showAllGames ? games : games.filter(game => 
    !currentUser || 
    !game.user_pick || 
    game.status !== 'scheduled'
  );

  const getPickStats = () => {
    const totalGames = games.length;
    const gamesWithPicks = games.filter(g => g.user_pick).length;
    const correctPicks = games.filter(g => g.user_pick?.is_correct === true).length;
    const incorrectPicks = games.filter(g => g.user_pick?.is_correct === false).length;
    const completedGames = games.filter(g => g.status === 'completed').length;
    
    return {
      totalGames,
      gamesWithPicks,
      correctPicks,
      incorrectPicks,
      completedGames,
      pendingPicks: totalGames - gamesWithPicks,
      accuracy: completedGames > 0 ? (correctPicks / completedGames) * 100 : 0
    };
  };

  const stats = getPickStats();

  if (weekLoading || gamesLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="h-8 bg-gray-300 rounded w-64 mx-auto mb-4 animate-pulse" />
        </div>
        <GameCardSkeleton count={8} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select a Player
        </h2>
        <p className="text-gray-600 mb-6">
          Choose your name from the menu above to view and manage your picks.
        </p>
        <Link 
          to="/"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-green-800 mb-2">
          🏈 MAKE YOUR PICKS
        </h1>
        <p className="text-gray-600 text-lg">
          Week {selectedWeekData?.week_number} - {selectedWeekData?.season_year}
        </p>
      </div>

      {/* Week Picker */}
      <WeekPicker 
        selectedWeek={selectedWeekId}
        onWeekChange={setSelectedWeekId}
        className="mb-8"
      />

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Completion Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Completion</h3>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          {completionLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.gamesWithPicks}/{stats.totalGames}
              </div>
              <div className="text-sm text-gray-500">
                {completion?.completion_percentage.toFixed(0)}% Complete
              </div>
            </div>
          )}
        </div>

        {/* Correct Picks */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Correct</h3>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.correctPicks}</div>
          <div className="text-sm text-gray-500">
            {stats.completedGames > 0 ? stats.accuracy.toFixed(1) : 0}% Accuracy
          </div>
        </div>

        {/* Incorrect Picks */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Incorrect</h3>
            <XCircleIcon className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.incorrectPicks}</div>
          <div className="text-sm text-gray-500">
            Out of {stats.completedGames} completed
          </div>
        </div>

        {/* Pending Picks */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Pending</h3>
            <ClockIcon className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pendingPicks}</div>
          <div className="text-sm text-gray-500">
            Still to pick
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-gray-900">
            Games
          </h2>
          <span className="text-gray-500">
            ({filteredGames.length} of {games.length})
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleFetchSpreads}
            disabled={fetchSpreadsMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <ArrowPathIcon className={`h-4 w-4 ${fetchSpreadsMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{fetchSpreadsMutation.isPending ? 'Fetching...' : 'Fetch Spreads'}</span>
          </button>
          <button
            onClick={() => setShowAllGames(!showAllGames)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            {showAllGames ? (
              <>
                <EyeSlashIcon className="h-4 w-4" />
                <span>Hide Completed</span>
              </>
            ) : (
              <>
                <EyeIcon className="h-4 w-4" />
                <span>Show All</span>
              </>
            )}
          </button>
          
          <Link
            to="/leaderboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            View Standings
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      {completion && completion.completion_percentage < 100 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Pick Progress</h3>
            <span className="text-sm text-gray-600">
              {completion.completed_picks} of {completion.total_games} completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completion.completion_percentage}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-gray-600">
            <span>0%</span>
            <span className="font-medium">{completion.completion_percentage.toFixed(1)}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Games Grid */}
      {games.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Games Available</h3>
          <p className="text-gray-600">
            Games for this week haven't been set up yet. Check back later!
          </p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-8">
            <CheckCircleIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-800 mb-3">🎉 All Picks Complete!</h3>
            <p className="text-green-700 text-lg mb-4">
              You've made all your picks for this week. Great job!
            </p>
            <button
              onClick={() => setShowAllGames(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
            >
              View All Your Picks
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPickUpdate={handlePickUpdate}
            />
          ))}
        </div>
      )}

      {/* Additional Actions */}
      {stats.pendingPicks === 0 && games.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircleIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            All Picks Complete! 🎉
          </h3>
          <p className="text-green-700 mb-4">
            You've made picks for all {games.length} games this week. 
            Good luck and may the best predictor win!
          </p>
          <Link
            to="/leaderboard"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
          >
            Check Your Ranking
          </Link>
        </div>
      )}
    </div>
  );
};

export default PicksPage;