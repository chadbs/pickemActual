import React, { useState } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminApi } from '../api';

interface ManualSpreadInputProps {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  currentSpread?: number;
  currentFavorite?: string;
  hasOnlineSpread: boolean;
  onSpreadUpdate: () => void;
}

const ManualSpreadInput: React.FC<ManualSpreadInputProps> = ({
  gameId,
  homeTeam,
  awayTeam,
  currentSpread,
  currentFavorite,
  hasOnlineSpread,
  onSpreadUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [spread, setSpread] = useState(currentSpread?.toString() || '');
  const [favoriteTeam, setFavoriteTeam] = useState(currentFavorite || homeTeam);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!spread || parseFloat(spread) <= 0) {
      alert('Please enter a valid spread (greater than 0)');
      return;
    }

    setIsLoading(true);
    try {
      await adminApi.updateGameSpread(gameId, {
        spread: parseFloat(spread),
        favorite_team: favoriteTeam
      });
      
      setIsEditing(false);
      onSpreadUpdate();
      alert(`Spread set: ${favoriteTeam} -${spread}`);
    } catch (error: any) {
      console.error('Failed to update spread:', error);
      if (error.response?.status === 403) {
        alert('Cannot update spread - game already has an online spread');
      } else if (error.response?.status === 423) {
        alert('Cannot update spread - spreads are locked for this week');
      } else {
        alert('Failed to update spread. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear this manual spread?')) return;

    setIsLoading(true);
    try {
      await adminApi.clearGameSpread(gameId);
      setSpread('');
      setFavoriteTeam(homeTeam);
      onSpreadUpdate();
      alert('Spread cleared successfully');
    } catch (error: any) {
      console.error('Failed to clear spread:', error);
      if (error.response?.status === 423) {
        alert('Cannot clear spread - spreads are locked for this week');
      } else {
        alert('Failed to clear spread. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSpread(currentSpread?.toString() || '');
    setFavoriteTeam(currentFavorite || homeTeam);
    setIsEditing(false);
  };

  return (
    <div className="mt-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg shadow-sm">
      <div className="text-sm font-bold text-amber-800 mb-2">
        🏈 Set Game Spread (Admin)
      </div>
      
      {!isEditing ? (
        <div className="text-center">
          {currentSpread ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="text-sm font-medium text-amber-800">
                Manual: {currentFavorite} -{currentSpread}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded"
              >
                Edit
              </button>
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="text-xs px-2 py-1 text-red-600 hover:text-red-800 border border-red-300 rounded"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
            >
              📝 Input Manual Spread Here
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-amber-700 mb-1">Spread</label>
              <input
                type="number"
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                placeholder="7.5"
                step="0.5"
                min="0.5"
                className="w-full text-sm border border-amber-300 rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-xs text-amber-700 mb-1">Favorite</label>
              <select
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                className="w-full text-sm border border-amber-300 rounded px-2 py-1"
              >
                <option value={homeTeam}>{homeTeam}</option>
                <option value={awayTeam}>{awayTeam}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !spread}
              className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualSpreadInput;