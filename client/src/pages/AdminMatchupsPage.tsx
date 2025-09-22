import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useCreateGames, useWeeks } from '../hooks/useApi';
import { weekApi, gameApi, adminApi } from '../api';

interface Game {
  id: number;
  home_team: string;
  away_team: string;
  start_date: string;
  selection_score: number;
  home_conference: string;
  away_conference: string;
  spread?: number;
  favorite_team?: string;
}

interface Week {
  id: number;
  week_number: number;
  season_year: number;
}

const AdminMatchupsPage: React.FC = () => {
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
  const [currentGames, setCurrentGames] = useState<Game[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [spreadScrapeLoading, setSpreadScrapeLoading] = useState(false);
  const [topGamesLoading, setTopGamesLoading] = useState(false);
  const [fetchGamesLoading, setFetchGamesLoading] = useState(false);
  
  // Use React Query hooks  
  const [weeks, setWeeks] = useState<Week[]>([]);
  const createGamesMutation = useCreateGames();
  
  // Fetch weeks on load
  useEffect(() => {
    fetchWeeks();
  }, []);
  
  // Fetch available games when week changes
  useEffect(() => {
    if (selectedWeekId) {
      fetchAvailableGames();
      fetchCurrentGames();
    }
  }, [selectedWeekId]);
  
  const fetchWeeks = async () => {
    try {
      const response = await weekApi.getAll(2025);
      const sortedWeeks = response.data
        .filter((w: Week) => w.season_year === 2025)
        .sort((a: Week, b: Week) => a.week_number - b.week_number);
      setWeeks(sortedWeeks);
      
      // Set first week as default
      if (sortedWeeks.length > 0) {
        setSelectedWeekId(sortedWeeks[0].id);
      }
    } catch (error) {
      console.error('Error fetching weeks:', error);
    }
  };
  
  const fetchAvailableGames = async () => {
    if (!selectedWeekId) return;

    const selectedWeek = weeks.find(w => w.id === selectedWeekId);
    if (!selectedWeek) return;

    try {
      setFetchLoading(true);
      // Use the new top games endpoint to automatically load top 20 games
      const response = await adminApi.getTopGames(selectedWeek.season_year, selectedWeek.week_number);
      setAvailableGames(response.data.games || []);
    } catch (error: any) {
      console.error('Error fetching available games:', error);

      // If API key is not configured, show a helpful message
      if (error.response?.status === 400 && error.response?.data?.error === 'CFBD API not configured') {
        console.log('CFBD API not configured, games will need to be scraped or fetched manually');
        setAvailableGames([]);
        return;
      }

      // Fallback to preview games if top games fails
      try {
        const fallbackResponse = await adminApi.previewGames(selectedWeek.season_year, selectedWeek.week_number);
        setAvailableGames(fallbackResponse.data.games || []);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setAvailableGames([]);
      }
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchTop20Games = async () => {
    if (!selectedWeekId) return;

    const selectedWeek = weeks.find(w => w.id === selectedWeekId);
    if (!selectedWeek) return;

    try {
      setTopGamesLoading(true);
      const response = await adminApi.getTopGames(selectedWeek.season_year, selectedWeek.week_number);
      setAvailableGames(response.data.games || []);
      console.log(`✅ Loaded ${response.data.games?.length || 0} top games for Week ${selectedWeek.week_number}`);
    } catch (error: any) {
      console.error('Error fetching top 20 games:', error);

      if (error.response?.status === 400 && error.response?.data?.error === 'CFBD API not configured') {
        alert('CFBD API is not configured. Please use the "Scrape Games" or "Fetch Games for This Week" buttons instead.');
      } else {
        alert('Error fetching top 20 games. Please try the scraping options instead.');
      }
    } finally {
      setTopGamesLoading(false);
    }
  };

  const fetchGamesForWeek = async () => {
    if (!selectedWeekId) return;

    const selectedWeek = weeks.find(w => w.id === selectedWeekId);
    if (!selectedWeek) return;

    const confirmed = window.confirm(
      `Fetch games for Week ${selectedWeek.week_number} using API? ` +
      'This will get the latest games data for this week.'
    );

    if (!confirmed) return;

    try {
      setFetchGamesLoading(true);
      const response = await adminApi.fetchGamesForWeek({
        year: selectedWeek.season_year,
        week_number: selectedWeek.week_number,
        week_id: selectedWeek.id
      });

      alert(`✅ Successfully fetched ${response.data.games_created || 0} games for Week ${selectedWeek.week_number}!`);

      // Refresh the games list
      fetchAvailableGames();
      fetchCurrentGames();
    } catch (error) {
      console.error('Error fetching games:', error);
      alert('Error fetching games. Please try again.');
    } finally {
      setFetchGamesLoading(false);
    }
  };
  
  const fetchCurrentGames = async () => {
    if (!selectedWeekId) return;
    
    try {
      const response = await gameApi.getByWeek(selectedWeekId);
      setCurrentGames(response.data || []);
    } catch (error) {
      console.error('Error fetching current games:', error);
    }
  };
  
  const toggleGameSelection = (gameId: number) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else if (newSelected.size < 8) {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
  };
  
  const saveMatchups = async () => {
    if (selectedGames.size !== 8) {
      alert('Please select exactly 8 games');
      return;
    }
    
    const selectedGameData = availableGames.filter(game => selectedGames.has(game.id));
    
    try {
      await createGamesMutation.mutateAsync({
        week_id: selectedWeekId!,
        selected_games: selectedGameData
      });
      
      alert('Matchups saved successfully! The main page will now show the updated games.');
      setSelectedGames(new Set());
      fetchCurrentGames(); // Refresh current games display
    } catch (error) {
      console.error('Error saving matchups:', error);
      alert('Error saving matchups');
    }
  };

  const scrapeGames = async () => {
    if (!selectedWeekId) {
      alert('Please select a week first');
      return;
    }
    
    const confirmed = window.confirm(
      `Scrape games for Week ${currentWeekNumber} without using API credits? ` +
      'This will replace any existing games for this week.'
    );
    
    if (!confirmed) return;
    
    try {
      setScrapeLoading(true);
      const response = await fetch('/api/admin/scrape-games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          week: currentWeekNumber,
          year: 2025
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to scrape games');
      }
      
      const result = await response.json();
      alert(`✅ Successfully scraped ${result.gamesStored} games and ${result.spreadsAdded || 0} spreads for Week ${result.week}!`);
      
      // Refresh the games list
      fetchAvailableGames();
      fetchCurrentGames();
    } catch (error) {
      console.error('Error scraping games:', error);
      alert('Error scraping games. Please try again.');
    } finally {
      setScrapeLoading(false);
    }
  };

  const scrapeSpreads = async () => {
    if (!selectedWeekId) {
      alert('Please select a week first');
      return;
    }
    
    const confirmed = window.confirm(
      `Scrape spreads for Week ${currentWeekNumber} from free sources? ` +
      'This will update spreads for games without using API credits.'
    );
    
    if (!confirmed) return;
    
    try {
      setSpreadScrapeLoading(true);
      const response = await fetch('/api/admin/scrape-spreads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          week: currentWeekNumber,
          year: 2025
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to scrape spreads');
      }
      
      const result = await response.json();
      alert(`✅ Updated spreads for ${result.updated} games! Sources: ${result.sources?.join(', ')}`);
      
      // Refresh the games list
      fetchAvailableGames();
      fetchCurrentGames();
    } catch (error) {
      console.error('Error scraping spreads:', error);
      alert('Error scraping spreads. Please try again.');
    } finally {
      setSpreadScrapeLoading(false);
    }
  };

  const lockSpreads = async () => {
    if (!selectedWeekId) {
      alert('Please select a week first');
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to lock the spreads for Week ${currentWeekNumber}? ` +
      'Once locked, the spreads cannot be changed and all picks will be scored against these spreads.'
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/lock-spreads/${selectedWeekId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to lock spreads');
      }
      
      const result = await response.json();
      alert(`Spreads locked successfully for Week ${result.week_number}! Spreads are now frozen until all games are completed.`);
    } catch (error) {
      console.error('Error locking spreads:', error);
      alert('Error locking spreads. Please try again.');
    }
  };
  
  const selectedWeek = weeks.find(w => w.id === selectedWeekId);
  const currentWeekNumber = selectedWeek?.week_number || 1;
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin: Manage Matchups</h1>
        <p className="text-gray-600">Select the best 8 games for each week from the top 20 available matchups</p>
      </div>
      
      {/* Week Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Week Selection</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
                const currentIndex = sortedWeeks.findIndex(w => w.id === selectedWeekId);
                if (currentIndex > 0) {
                  setSelectedWeekId(sortedWeeks[currentIndex - 1].id);
                }
              }}
              disabled={(() => {
                const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
                return sortedWeeks.findIndex(w => w.id === selectedWeekId) === 0;
              })()}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">Week {currentWeekNumber}</div>
              <div className="text-sm text-gray-500">2025 Season</div>
            </div>
            
            <button
              onClick={() => {
                const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
                const currentIndex = sortedWeeks.findIndex(w => w.id === selectedWeekId);
                if (currentIndex < sortedWeeks.length - 1) {
                  setSelectedWeekId(sortedWeeks[currentIndex + 1].id);
                }
              }}
              disabled={(() => {
                const sortedWeeks = [...weeks].sort((a, b) => a.week_number - b.week_number);
                return sortedWeeks.findIndex(w => w.id === selectedWeekId) === sortedWeeks.length - 1;
              })()}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Week Grid */}
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {[...weeks].sort((a, b) => a.week_number - b.week_number).map((week) => (
            <button
              key={week.id}
              onClick={() => setSelectedWeekId(week.id)}
              className={`p-2 text-center rounded-lg border transition-colors ${
                selectedWeekId === week.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <div className="font-medium">W{week.week_number}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Current Games */}
      {currentGames.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Current Week {currentWeekNumber} Games ({currentGames.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {currentGames.map((game) => (
              <div key={game.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm font-medium text-green-800">
                  {game.away_team} @ {game.home_team}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {formatDate(game.start_date)}
                </div>
                {game.spread && (
                  <div className="text-xs text-green-600">
                    Spread: {game.favorite_team} -{game.spread}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Available Games Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Available Games - Week {currentWeekNumber} ({availableGames.length} options)
          </h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Selected: {selectedGames.size}/8
            </span>
            <button
              onClick={fetchTop20Games}
              disabled={topGamesLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {topGamesLoading ? 'Loading...' : '🏈 Get Top 20 Games'}
            </button>
            <button
              onClick={fetchGamesForWeek}
              disabled={fetchGamesLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {fetchGamesLoading ? 'Fetching...' : '📡 Fetch Games for This Week'}
            </button>
            <button
              onClick={scrapeGames}
              disabled={scrapeLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {scrapeLoading ? 'Scraping...' : '🕷️ Scrape Games'}
            </button>
            <button
              onClick={scrapeSpreads}
              disabled={spreadScrapeLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {spreadScrapeLoading ? 'Scraping...' : '🎰 Scrape Spreads'}
            </button>
            <button
              onClick={lockSpreads}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Lock Spreads
            </button>
            <button
              onClick={saveMatchups}
              disabled={selectedGames.size !== 8 || createGamesMutation.isPending}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {createGamesMutation.isPending ? 'Saving...' : 'Save Matchups'}
            </button>
          </div>
        </div>
        
        {fetchLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading games...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableGames.map((game, index) => (
              <div
                key={game.id}
                onClick={() => toggleGameSelection(game.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedGames.has(game.id)
                    ? 'bg-blue-50 border-blue-300 shadow-md'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                } ${selectedGames.size >= 8 && !selectedGames.has(game.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-gray-500">#{index + 1}</div>
                      <div className="font-bold text-lg">
                        {game.away_team} @ {game.home_team}
                      </div>
                      {selectedGames.has(game.id) && (
                        <CheckIcon className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span>{formatDate(game.start_date)}</span>
                      <span>{game.away_conference} vs {game.home_conference}</span>
                      <span className="font-medium text-blue-600">Score: {game.selection_score}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMatchupsPage;