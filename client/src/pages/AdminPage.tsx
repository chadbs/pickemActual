import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

import LoadingSpinner, { ButtonSpinner } from '../components/LoadingSpinner';
import { 
  useAdminDashboard,
  useFetchGames,
  useUpdateScores,
  useRecalculateScores,
  useResetApp,
  useCurrentUser
} from '../hooks/useApi';

const AdminPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  
  const { data: dashboard, isLoading: dashboardLoading } = useAdminDashboard();
  const fetchGamesMutation = useFetchGames();
  const updateScoresMutation = useUpdateScores();
  const recalculateScoresMutation = useRecalculateScores();
  const resetAppMutation = useResetApp();

  // Check if user is admin
  if (!currentUser?.is_admin) {
    return (
      <div className="text-center py-12">
        <ShieldCheckIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-cfb-display font-bold text-gray-900 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600 mb-6">
          You need administrator privileges to access this page.
        </p>
        <Link 
          to="/"
          className="bg-cfb-green-600 text-white px-6 py-3 rounded-lg hover:bg-cfb-green-700 transition-colors duration-200 font-medium"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  const handleFetchGames = async () => {
    try {
      await fetchGamesMutation.mutateAsync();
      alert('Games fetched successfully!');
    } catch (error) {
      alert('Failed to fetch games. Check console for details.');
    }
  };

  const handleUpdateScores = async () => {
    try {
      await updateScoresMutation.mutateAsync();
      alert('Scores updated successfully!');
    } catch (error) {
      alert('Failed to update scores. Check console for details.');
    }
  };

  const handleRecalculateScores = async () => {
    if (confirm('This will recalculate all scores and standings. Are you sure?')) {
      try {
        await recalculateScoresMutation.mutateAsync();
        alert('Scores recalculated successfully!');
      } catch (error) {
        alert('Failed to recalculate scores. Check console for details.');
      }
    }
  };

  const handleResetApp = async () => {
    const confirmText = 'RESET ALL DATA';
    const userConfirm = prompt(
      `⚠️ DANGER: This will delete ALL users, picks, and scores!\n\n` +
      `Games and weeks will be preserved but reset to scheduled status.\n\n` +
      `Type "${confirmText}" to confirm this action:`
    );
    
    if (userConfirm === confirmText) {
      try {
        await resetAppMutation.mutateAsync();
        alert('🔥 App reset successfully! All user data has been cleared.');
        window.location.reload(); // Reload to clear user state
      } catch (error) {
        alert('Failed to reset app. Check console for details.');
      }
    } else if (userConfirm !== null) {
      alert('Reset cancelled - confirmation text did not match.');
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Loading admin dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-cfb-display font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage games, users, and system settings
        </p>
      </div>

      {/* Quick Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          <div className="admin-card text-center">
            <UserGroupIcon className="h-8 w-8 text-cfb-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.total_users || 0}
            </div>
            <div className="text-sm text-gray-600">Users</div>
          </div>

          <div className="admin-card text-center">
            <CalendarIcon className="h-8 w-8 text-cfb-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.total_weeks || 0}
            </div>
            <div className="text-sm text-gray-600">Weeks</div>
          </div>

          <div className="admin-card text-center">
            <ChartBarIcon className="h-8 w-8 text-cfb-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.total_games || 0}
            </div>
            <div className="text-sm text-gray-600">Games</div>
          </div>

          <div className="admin-card text-center">
            <ArrowPathIcon className="h-8 w-8 text-cfb-gold-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.total_picks || 0}
            </div>
            <div className="text-sm text-gray-600">Picks</div>
          </div>

          <div className="admin-card text-center">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-green-600 font-bold text-sm">✓</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.completed_games || 0}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>

          <div className="admin-card text-center">
            <div className="h-8 w-8 bg-cfb-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-cfb-green-600 font-bold text-sm">{dashboard.stats?.active_weeks || 0}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {dashboard.stats?.active_weeks || 0}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
        </div>
      )}

      {/* Current Week Status */}
      {dashboard?.current_week && (
        <div className="admin-card">
          <h2 className="text-xl font-cfb-display font-bold text-gray-900 mb-4">
            Current Week Status
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Week {dashboard.current_week.week_number} - {dashboard.current_week.season_year}
              </h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Status: <span className="font-medium">{dashboard.current_week.status}</span></div>
                <div>Games: <span className="font-medium">{dashboard.current_week.game_count || 0}</span></div>
                <div>Total Picks: <span className="font-medium">{dashboard.current_week.pick_count || 0}</span></div>
                <div>
                  Deadline: <span className="font-medium">
                    {new Date(dashboard.current_week.deadline).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Manage Matchups */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Manage Matchups
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Select 8 matchups from the top 20 games for each week.
          </p>
          <Link
            to="/admin/matchups"
            className="admin-button w-full flex items-center justify-center space-x-2"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Select Matchups</span>
          </Link>
        </div>
        {/* Fetch Games */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Fetch New Games
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Automatically fetch and create games for the current week from the APIs.
          </p>
          <button
            onClick={handleFetchGames}
            disabled={fetchGamesMutation.isPending}
            className="admin-button w-full flex items-center justify-center space-x-2"
          >
            {fetchGamesMutation.isPending ? (
              <ButtonSpinner />
            ) : (
              <ArrowDownTrayIcon className="h-4 w-4" />
            )}
            <span>Fetch Games</span>
          </button>
        </div>

        {/* Update Scores */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Update Scores
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Fetch latest scores and update game results from the APIs.
          </p>
          <button
            onClick={handleUpdateScores}
            disabled={updateScoresMutation.isPending}
            className="admin-button w-full flex items-center justify-center space-x-2"
          >
            {updateScoresMutation.isPending ? (
              <ButtonSpinner />
            ) : (
              <ArrowPathIcon className="h-4 w-4" />
            )}
            <span>Update Scores</span>
          </button>
        </div>

        {/* Recalculate Standings */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Recalculate All
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Recalculate all pick results, weekly scores, and season standings.
          </p>
          <button
            onClick={handleRecalculateScores}
            disabled={recalculateScoresMutation.isPending}
            className="admin-button-danger w-full flex items-center justify-center space-x-2"
          >
            {recalculateScoresMutation.isPending ? (
              <ButtonSpinner />
            ) : (
              <ExclamationTriangleIcon className="h-4 w-4" />
            )}
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      {dashboard?.recent_activity && dashboard.recent_activity.length > 0 && (
        <div className="admin-card">
          <h2 className="text-xl font-cfb-display font-bold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {dashboard.recent_activity.map((activity: any, index: number) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-cfb-green-500 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {activity.name} picked {activity.selected_team}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activity.home_team} vs {activity.away_team} • {new Date(activity.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-center space-x-4">
        <Link
          to="/"
          className="admin-button-secondary"
        >
          Back to Home
        </Link>
        <Link
          to="/leaderboard"
          className="admin-button-secondary"
        >
          View Leaderboard
        </Link>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Admin Notice</h3>
            <div className="mt-1 text-sm text-yellow-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Game fetching and score updates run automatically via scheduled tasks</li>
                <li>Manual updates should only be used when necessary</li>
                <li>Recalculating scores will affect all users' standings</li>
                <li>Always backup data before making significant changes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 mb-2">🚨 Danger Zone</h3>
            <p className="text-sm text-red-700 mb-4">
              Reset the entire application, clearing all users, picks, and scores. 
              Games and weeks will be preserved but reset to scheduled status.
            </p>
            <button
              onClick={handleResetApp}
              disabled={resetAppMutation.isPending}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-sm flex items-center space-x-2"
            >
              {resetAppMutation.isPending ? (
                <ButtonSpinner />
              ) : (
                <ExclamationTriangleIcon className="h-4 w-4" />
              )}
              <span>Reset All User Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;