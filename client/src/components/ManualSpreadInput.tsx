import React, { useState, useEffect, useRef } from 'react';
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { adminApi } from '../api';
import { useToast } from './Toast';

interface ManualSpreadInputProps {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  currentSpread?: number;
  currentFavorite?: string;
  hasOnlineSpread: boolean;
  onSpreadUpdate: () => void;
}

// Constants for better maintainability
const MIN_SPREAD = 0.5;
const MAX_SPREAD = 50;
const SPREAD_STEP = 0.5;

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
  const [showPreview, setShowPreview] = useState(false);
  
  const { showToast, ToastContainer } = useToast();
  const spreadInputRef = useRef<HTMLInputElement>(null);
  
  // Sync local state with props changes
  useEffect(() => {
    setSpread(currentSpread?.toString() || '');
    setFavoriteTeam(currentFavorite || homeTeam);
  }, [currentSpread, currentFavorite, homeTeam]);

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && spreadInputRef.current) {
      spreadInputRef.current.focus();
      spreadInputRef.current.select();
    }
  }, [isEditing]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, spread, favoriteTeam]);

  const validateSpread = (value: string): string | null => {
    const num = parseFloat(value);
    if (!value || isNaN(num)) return 'Please enter a valid number';
    if (num < MIN_SPREAD) return `Spread must be at least ${MIN_SPREAD}`;
    if (num > MAX_SPREAD) return `Spread cannot exceed ${MAX_SPREAD}`;
    return null;
  };

  const getSpreadPreview = (): string => {
    const num = parseFloat(spread);
    if (!spread || isNaN(num)) return '';
    return `${favoriteTeam} -${num}`;
  };

  const handleSave = async () => {
    const error = validateSpread(spread);
    if (error) {
      showToast({ message: error, type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      await adminApi.updateGameSpread(gameId, {
        spread: parseFloat(spread),
        favorite_team: favoriteTeam
      });
      
      setIsEditing(false);
      setShowPreview(false);
      onSpreadUpdate();
      showToast({ 
        message: `🎯 Spread set successfully: ${getSpreadPreview()}`, 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Failed to update spread:', error);
      const errorMessage = error.response?.status === 403
        ? '🚫 Cannot update - game already has an online spread'
        : error.response?.status === 423
        ? '🔒 Cannot update - spreads are locked for this week'
        : '❌ Failed to update spread. Please try again.';
      
      showToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    try {
      await adminApi.clearGameSpread(gameId);
      setSpread('');
      setFavoriteTeam(homeTeam);
      onSpreadUpdate();
      showToast({ 
        message: '🗑️ Spread cleared successfully', 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Failed to clear spread:', error);
      const errorMessage = error.response?.status === 423
        ? '🔒 Cannot clear - spreads are locked for this week'
        : '❌ Failed to clear spread. Please try again.';
      
      showToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSpread(currentSpread?.toString() || '');
    setFavoriteTeam(currentFavorite || homeTeam);
    setIsEditing(false);
    setShowPreview(false);
  };

  const handleSpreadChange = (value: string) => {
    setSpread(value);
    setShowPreview(!!value && !isNaN(parseFloat(value)));
  };

  return (
    <>
      <ToastContainer />
      <div className="relative group transition-all duration-200 hover:scale-[1.02]">
        <div className="p-4 bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 border-2 border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🏈</span>
              <span className="text-sm font-bold text-indigo-800">
                Manual Spread Control
              </span>
            </div>
            {isLoading && (
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="h-4 w-4 text-indigo-600 animate-spin" />
                <span className="text-xs text-indigo-600 font-medium">Working...</span>
              </div>
            )}
          </div>

          {!isEditing ? (
            /* View Mode */
            <div className="space-y-3">
              {currentSpread ? (
                /* Has Spread */
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center px-3 py-2 bg-green-100 border border-green-200 rounded-lg">
                    <span className="text-green-800 font-semibold">
                      ✅ {currentFavorite} -{currentSpread}
                    </span>
                  </div>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors duration-150 disabled:opacity-50"
                    >
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={handleClear}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors duration-150 disabled:opacity-50"
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                /* No Spread */
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center justify-center space-x-2">
                    <span className="text-lg">📝</span>
                    <span>Set Manual Spread</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                </button>
              )}
            </div>
          ) : (
            /* Edit Mode */
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              
              {/* Live Preview */}
              {showPreview && (
                <div className="text-center animate-in fade-in duration-200">
                  <div className="inline-flex items-center px-3 py-2 bg-yellow-100 border border-yellow-200 rounded-lg">
                    <span className="text-yellow-800 font-semibold">
                      👀 Preview: {getSpreadPreview()}
                    </span>
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="flex items-center text-xs font-semibold text-indigo-700">
                    <span className="mr-1">🎯</span>
                    Spread Points
                  </label>
                  <input
                    ref={spreadInputRef}
                    type="number"
                    value={spread}
                    onChange={(e) => handleSpreadChange(e.target.value)}
                    placeholder="7.5"
                    step={SPREAD_STEP}
                    min={MIN_SPREAD}
                    max={MAX_SPREAD}
                    className="w-full text-sm border-2 border-indigo-200 rounded-lg px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all duration-150"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center text-xs font-semibold text-indigo-700">
                    <span className="mr-1">⭐</span>
                    Favorite Team
                  </label>
                  <select
                    value={favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.target.value)}
                    className="w-full text-sm border-2 border-indigo-200 rounded-lg px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all duration-150"
                  >
                    <option value={homeTeam}>{homeTeam}</option>
                    <option value={awayTeam}>{awayTeam}</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 space-y-2 sm:space-y-0">
                <div className="text-xs text-gray-500 order-2 sm:order-1">
                  💡 Press Enter to save, Escape to cancel
                </div>
                <div className="flex space-x-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading || !spread || !!validateSpread(spread)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center space-x-2">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <span>💾</span>
                        <span>Save Spread</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ManualSpreadInput;