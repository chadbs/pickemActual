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
import { useToast } from '../components/Toast';
import { 
  useAdminDashboard,
  useFetchGames,
  useUpdateScores,
  useRecalculateScores,
  useResetApp,
  useCreateSeasonWeeks,
  useCurrentUser,
  useUsers,
  useDeleteUser
} from '../hooks/useApi';

const AdminPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const { showToast, ToastContainer } = useToast();
  
  const { data: dashboard, isLoading: dashboardLoading } = useAdminDashboard();
  const { data: users, isLoading: usersLoading } = useUsers();
  const fetchGamesMutation = useFetchGames();
  const updateScoresMutation = useUpdateScores();
  const recalculateScoresMutation = useRecalculateScores();
  const resetAppMutation = useResetApp();
  const createSeasonWeeksMutation = useCreateSeasonWeeks();
  const deleteUserMutation = useDeleteUser();

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

  const handleDeleteUser = async (user: any) => {
    const confirmed = confirm(
      `Are you sure you want to delete user "${user.name}"?\n\n` +
      `This will permanently remove:\n` +
      `• The user account\n` +
      `• All their picks and history\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        const result = await deleteUserMutation.mutateAsync(user.id);
        showToast({
          message: `🗑️ User "${user.name}" deleted successfully! ${result.picks_deleted} picks removed.`,
          type: 'success'
        });
      } catch (error: any) {
        const message = error.response?.status === 403
          ? '🚫 Cannot delete admin users'
          : error.response?.status === 404
          ? '❌ User not found'
          : '❌ Failed to delete user. Please try again.';
        
        showToast({ message, type: 'error' });
      }
    }
  };

  const handleFetchGames = async () => {
    try {
      await fetchGamesMutation.mutateAsync();
      showToast({ message: '🎮 Games fetched successfully!', type: 'success' });
    } catch (error) {
      showToast({ message: '❌ Failed to fetch games. Check console for details.', type: 'error' });
    }
  };

  const handleUpdateScores = async () => {
    try {
      await updateScoresMutation.mutateAsync();
      showToast({ message: '📊 Scores updated successfully!', type: 'success' });
    } catch (error) {
      showToast({ message: '❌ Failed to update scores. Check console for details.', type: 'error' });
    }
  };

  const handleRecalculateScores = async () => {
    if (confirm('This will recalculate all scores and standings. Are you sure?')) {
      try {
        await recalculateScoresMutation.mutateAsync();
        showToast({ message: '🔄 Scores recalculated successfully!', type: 'success' });
      } catch (error) {
        showToast({ message: '❌ Failed to recalculate scores. Check console for details.', type: 'error' });
      }
    }
  };

  const handleCreateSeasonWeeks = async () => {
    const currentYear = new Date().getFullYear();
    const yearInput = prompt(`Create a full season of weeks (1-15).\n\nEnter year (current: ${currentYear}):`, currentYear.toString());
    
    if (yearInput && !isNaN(parseInt(yearInput))) {
      const year = parseInt(yearInput);
      try {
        const result = await createSeasonWeeksMutation.mutateAsync(year);
        showToast({ 
          message: `✅ Created ${result.weeks.length} weeks for ${result.season_year} season!`, 
          type: 'success' 
        });
      } catch (error) {
        showToast({ message: '❌ Failed to create season weeks. Check console for details.', type: 'error' });
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
        showToast({ message: '🔥 App reset successfully! All user data has been cleared.', type: 'success' });
        setTimeout(() => window.location.reload(), 2000); // Reload after showing toast
      } catch (error) {
        showToast({ message: '❌ Failed to reset app. Check console for details.', type: 'error' });
      }
    } else if (userConfirm !== null) {
      showToast({ message: '⚠️ Reset cancelled - confirmation text did not match.', type: 'error' });
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
    <>
      <ToastContainer />
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

      {/* User Management */}
      <div className="admin-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-cfb-display font-bold text-gray-900">
              User Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage registered users and remove test accounts
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {users?.length || 0} total users
          </div>
        </div>

        {usersLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" text="Loading users..." />
          </div>
        ) : users && users.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${user.is_admin ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <div>
                    <div className="font-medium text-gray-900 flex items-center space-x-2">
                      <span>{user.name}</span>
                      {user.is_admin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {user.id} • Created: {new Date(user.created_at).toLocaleDateString()}
                      {user.email && ` • ${user.email}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!user.is_admin ? (
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={deleteUserMutation.isPending}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteUserMutation.isPending ? (
                        <ButtonSpinner />
                      ) : (
                        <>
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-200 rounded-md">
                      Protected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <UserGroupIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No users found</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            💡 <strong>Tip:</strong> Admin users are protected from deletion. Only regular users can be removed.
          </div>
        </div>
      </div>

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
        
        {/* Create Season Weeks */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Create Season Weeks
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Create all 15 weeks (1-15) for a season to enable week navigation.
          </p>
          <button
            onClick={handleCreateSeasonWeeks}
            disabled={createSeasonWeeksMutation.isPending}
            className="admin-button w-full flex items-center justify-center space-x-2"
          >
            {createSeasonWeeksMutation.isPending ? (
              <ButtonSpinner />
            ) : (
              <CalendarIcon className="h-4 w-4" />
            )}
            <span>Create Weeks</span>
          </button>
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
    </>
  );
};

export default AdminPage;