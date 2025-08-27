import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GameCard from '../components/GameCard';
import WeekPicker from '../components/WeekPicker';
import { 
  useWeekGames, 
  useCurrentWeek, 
  useWeeklyLeaderboard,
  useCurrentUser,
  useWeek
} from '../hooks/useApi';

const HomePage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { data: currentWeek, isLoading: weekLoading } = useCurrentWeek();
  
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [showAllPicks, setShowAllPicks] = useState(false);
  
  // Set initial week to current week when it loads
  useEffect(() => {
    if (currentWeek && selectedWeekId === null) {
      setSelectedWeekId(currentWeek.id);
    }
  }, [currentWeek, selectedWeekId]);
  
  const { data: selectedWeekData } = useWeek(selectedWeekId || 0);
  const { data: games = [], isLoading: gamesLoading, refetch: refetchGames } = useWeekGames(selectedWeekId || 0, currentUser?.id);
  const { data: leaderboard = [] } = useWeeklyLeaderboard({ 
    week: selectedWeekData?.week_number, 
    year: selectedWeekData?.season_year 
  });

  const handlePickUpdate = () => {
    refetchGames();
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (diff < 0) return 'Deadline passed';
    if (hours < 24) return `${hours}h remaining`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} remaining`;
  };

  const currentWeekData = selectedWeekData || currentWeek;

  if (weekLoading || gamesLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading games...</p>
        </div>
      </div>
    );
  }

  const userPicks = games.filter(game => game.user_pick).length;
  const totalGames = games.length;
  const completionPercentage = totalGames > 0 ? (userPicks / totalGames) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Week {currentWeekData?.week_number} • {currentWeekData?.season_year}
            </h1>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <span>📅 Deadline: {currentWeekData ? formatDeadline(currentWeekData.deadline) : '...'}</span>
              <span>🏈 {games.length} Games</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link 
              to="/picks" 
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              🏈 MAKE PICKS
            </Link>
            {currentUser?.is_admin && (
              <Link 
                to="/admin" 
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg border-2 border-purple-400"
              >
                ⚙️ ADMIN
              </Link>
            )}
            <Link 
              to="/leaderboard" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        </div>
        
        {/* Week Picker */}
        <WeekPicker 
          selectedWeek={selectedWeekId}
          onWeekChange={setSelectedWeekId}
          className="mb-4"
        />
      </div>

      {/* User Status */}
      {currentUser && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-900">Welcome back, {currentUser.name}</h3>
              <p className="text-sm text-gray-600">
                {userPicks}/{totalGames} picks made ({Math.round(completionPercentage)}% complete)
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    completionPercentage === 100 ? 'bg-green-500' : 
                    completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {userPicks}/{totalGames}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Call to Action for Non-Users */}
      {!currentUser && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-dashed border-green-300 rounded-xl p-6 mb-6 text-center">
          <div className="text-4xl mb-3">🏈</div>
          <h3 className="text-2xl font-bold text-green-800 mb-2">Ready to Play?</h3>
          <p className="text-green-700 mb-4">
            Select your name from the user menu above to start making picks!
          </p>
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 inline-block">
            <p className="text-yellow-800 text-sm font-medium">
              👆 Click the "Select Player" button in the top right corner
            </p>
          </div>
        </div>
      )}

      {/* Call to Action for Users with Incomplete Picks */}
      {currentUser && completionPercentage < 100 && totalGames > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-dashed border-orange-300 rounded-xl p-6 mb-6 text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h3 className="text-2xl font-bold text-orange-800 mb-2">Don't Miss Out!</h3>
          <p className="text-orange-700 mb-4">
            You've only made {userPicks} of {totalGames} picks. Complete your picks before the deadline!
          </p>
          <Link 
            to="/picks" 
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-xl font-bold text-xl transition-all transform hover:scale-105 shadow-lg inline-block"
          >
            🏈 COMPLETE YOUR PICKS NOW
          </Link>
        </div>
      )}

      {/* Admin Quick Actions */}
      {currentUser?.is_admin && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-dashed border-purple-300 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="text-2xl font-bold text-purple-800 mb-2">Admin Controls</h3>
            <p className="text-purple-700 mb-4">
              Showing old games from August 23rd? Fetch current week games!
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                onClick={() => {
                  fetch('/api/admin/fetch-games', { method: 'POST' })
                    .then(res => res.json())
                    .then(() => {
                      alert('Games fetched! Refreshing page...');
                      window.location.reload();
                    })
                    .catch(err => alert('Error: ' + err.message));
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                🏈 FETCH CURRENT GAMES
              </button>
              <button 
                onClick={() => {
                  if (confirm('Fetch ALL season games (Weeks 1-12)? This may take a few minutes.')) {
                    fetch('/api/admin/fetch-all-games', { method: 'POST' })
                      .then(res => res.json())
                      .then(() => {
                        alert('All season games fetched! Refreshing page...');
                        window.location.reload();
                      })
                      .catch(err => alert('Error: ' + err.message));
                  }
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                🗓️ FETCH ALL WEEKS
              </button>
              <Link 
                to="/admin" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                📊 FULL ADMIN PANEL
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Games Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">This Week's Games</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAllPicks(!showAllPicks)}
              className={`px-3 py-1 text-sm rounded-full border-2 transition-all ${
                showAllPicks 
                  ? 'bg-purple-600 text-white border-purple-600' 
                  : 'bg-white text-purple-600 border-purple-600 hover:bg-purple-50'
              }`}
            >
              👥 {showAllPicks ? 'Hide All Picks' : 'Show All Picks'}
            </button>
            <span className="text-sm text-gray-500">Pick winners against the spread</span>
          </div>
        </div>

        {games.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No games available for this week yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPickUpdate={handlePickUpdate}
                showAllPicks={showAllPicks}
              />
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard Preview */}
      {leaderboard.length > 0 && (
        <div className="mt-8 bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">🏆 Current Leaders</h3>
              <Link to="/leaderboard" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All →
              </Link>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' : 'bg-gray-300 text-gray-700'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-medium">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{entry.completion_percentage || 0}%</div>
                    <div className="text-xs text-gray-500">{entry.picks_made || 0} picks</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;