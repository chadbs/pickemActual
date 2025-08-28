import React from 'react';
import type { GameWithPick } from '../types';
import { useCreatePick, useCurrentUser, useGamePicks } from '../hooks/useApi';

interface GameCardProps {
  game: GameWithPick;
  onPickUpdate?: () => void;
  showPicks?: boolean;
  disabled?: boolean;
  showAllPicks?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({ 
  game, 
  onPickUpdate, 
  showPicks = true,
  disabled = false,
  showAllPicks = false 
}) => {
  const { currentUser } = useCurrentUser();
  const createPickMutation = useCreatePick();
  const { data: allGamePicks = [] } = useGamePicks(showAllPicks ? game.id : 0);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handlePick = async (selectedTeam: string) => {
    if (!currentUser || disabled) return; // Allow picks regardless of game status for testing

    try {
      await createPickMutation.mutateAsync({
        game_id: game.id,
        selected_team: selectedTeam,
        user_name: currentUser.name,
      });
      
      onPickUpdate?.();
    } catch (error) {
      console.error('Failed to create pick:', error);
    }
  };

  const isSelected = (team: string) => game.user_pick?.selected_team === team;
  const isCompleted = game.status === 'completed';
  const canMakePick = currentUser && !disabled && (game.status === 'scheduled' || game.status === 'completed'); // Allow picks on completed games for testing

  const getStatusBadge = () => {
    switch (game.status) {
      case 'completed':
        return <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Final</span>;
      case 'live':
        return <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Live</span>;
      default:
        return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Scheduled</span>;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          {game.is_favorite_team_game && (
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">⭐ Featured</span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {formatTime(game.start_time)}
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">@ {game.away_team}</span>
          {isCompleted && game.away_score !== null && (
            <span className={`font-bold text-lg ${
              game.spread_winner === game.away_team ? 'text-green-600' : 'text-red-600'
            }`}>
              {game.away_score}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{game.home_team}</span>
          {isCompleted && game.home_score !== null && (
            <span className={`font-bold text-lg ${
              game.spread_winner === game.home_team ? 'text-green-600' : 'text-red-600'
            }`}>
              {game.home_score}
            </span>
          )}
        </div>
      </div>

      {/* Spread */}
      {game.spread && (
        <div className="text-center mb-3 p-2 bg-gray-50 rounded text-base font-medium">
          Spread: {game.favorite_team} -{game.spread}
        </div>
      )}

      {/* Pick Section */}
      {showPicks && (
        <div>
          {canMakePick ? (
            <div className="bg-gradient-to-br from-blue-50 to-green-50 border-2 border-dashed border-blue-300 rounded-lg p-4 space-y-3">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-900 mb-1">🏈 MAKE YOUR PICK</p>
                <p className="text-sm text-gray-700">Choose the winner against the spread:</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePick(game.away_team)}
                  disabled={createPickMutation.isPending}
                  className={`p-4 text-base font-bold rounded-lg border-2 transition-all transform hover:scale-105 ${
                    isSelected(game.away_team)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                      : 'bg-white text-gray-800 border-blue-300 hover:bg-blue-50 hover:border-blue-500 shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span>@ {game.away_team}</span>
                    {isSelected(game.away_team) && <span className="text-sm">✓ PICKED</span>}
                  </div>
                </button>
                <button
                  onClick={() => handlePick(game.home_team)}
                  disabled={createPickMutation.isPending}
                  className={`p-4 text-base font-bold rounded-lg border-2 transition-all transform hover:scale-105 ${
                    isSelected(game.home_team)
                      ? 'bg-green-600 text-white border-green-600 shadow-lg'
                      : 'bg-white text-gray-800 border-green-300 hover:bg-green-50 hover:border-green-500 shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span>{game.home_team}</span>
                    {isSelected(game.home_team) && <span className="text-sm">✓ PICKED</span>}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Show Current Pick */}
              {game.user_pick && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-800 mb-2">
                      ✓ YOUR PICK: {game.user_pick.selected_team}
                    </div>
                    {isCompleted ? (
                      <div className="text-base font-medium">
                        {game.spread_winner === game.user_pick.selected_team ? (
                          <span className="text-green-700 bg-green-200 px-3 py-1 rounded-full">🎉 CORRECT!</span>
                        ) : (
                          <span className="text-red-700 bg-red-200 px-3 py-1 rounded-full">❌ WRONG</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-green-700">Pick locked in</div>
                    )}
                  </div>
                </div>
              )}

              {/* No Pick Message */}
              {!game.user_pick && (
                <div className="bg-gray-50 rounded p-3 text-center text-sm text-gray-600">
                  {!currentUser ? 'Select a user to make picks' : 'Picking closed'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* All Players' Picks */}
      {showAllPicks && allGamePicks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">👥 All Players' Picks:</h4>
          <div className="space-y-1">
            {allGamePicks.map((pick: any) => (
              <div key={pick.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{pick.user_name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${
                    pick.selected_team === game.away_team ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {pick.selected_team}
                  </span>
                  {isCompleted && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      pick.selected_team === game.spread_winner 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {pick.selected_team === game.spread_winner ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {createPickMutation.isPending && (
        <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default GameCard;