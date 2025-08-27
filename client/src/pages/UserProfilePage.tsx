import React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  UserCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  TrophyIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

import LoadingSpinner from '../components/LoadingSpinner';
import { useUser, useUserHistory, useCurrentUser } from '../hooks/useApi';

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useCurrentUser();
  
  const { data: user, isLoading: userLoading } = useUser(parseInt(userId || '0'));
  const { data: history = [], isLoading: historyLoading } = useUserHistory(
    parseInt(userId || '0')
  );

  const isOwnProfile = currentUser?.id === user?.id;

  if (userLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <UserCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-cfb-display font-bold text-gray-900 mb-2">
          User Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The user you're looking for doesn't exist.
        </p>
        <Link 
          to="/leaderboard"
          className="bg-cfb-green-600 text-white px-6 py-3 rounded-lg hover:bg-cfb-green-700 transition-colors duration-200 font-medium"
        >
          View Leaderboard
        </Link>
      </div>
    );
  }

  const calculateSeasonStats = () => {
    const totalWeeks = history.length;
    const completedWeeks = history.filter(w => w.total_picks > 0).length;
    const totalCorrect = history.reduce((sum, w) => sum + (w.correct_picks || 0), 0);
    const totalPicks = history.reduce((sum, w) => sum + (w.total_picks || 0), 0);
    const avgPercentage = completedWeeks > 0 
      ? history.reduce((sum, w) => sum + (w.percentage || 0), 0) / completedWeeks 
      : 0;
    const bestWeek = Math.max(...history.map(w => w.percentage || 0));
    const worstWeek = Math.min(...history.map(w => w.percentage || 100));

    return {
      totalWeeks,
      completedWeeks,
      totalCorrect,
      totalPicks,
      avgPercentage,
      bestWeek: bestWeek === -Infinity ? 0 : bestWeek,
      worstWeek: worstWeek === Infinity ? 0 : worstWeek,
      seasonPercentage: totalPicks > 0 ? (totalCorrect / totalPicks) * 100 : 0
    };
  };

  const stats = calculateSeasonStats();

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <div>
        <Link 
          to="/leaderboard"
          className="inline-flex items-center space-x-2 text-cfb-green-600 hover:text-cfb-green-700 transition-colors duration-200"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Leaderboard</span>
        </Link>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-cfb-green-100 rounded-full flex items-center justify-center">
            <UserCircleIcon className="h-12 w-12 text-cfb-green-600" />
          </div>
          
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-cfb-display font-bold text-gray-900">
                {user.name}
              </h1>
              {user.is_admin && (
                <span className="bg-cfb-gold-100 text-cfb-gold-800 px-3 py-1 rounded-full text-sm font-medium">
                  Admin
                </span>
              )}
              {isOwnProfile && (
                <span className="bg-cfb-green-100 text-cfb-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  You
                </span>
              )}
            </div>
            
            <div className="mt-2 text-gray-600">
              <div>Member since {new Date(user.created_at).toLocaleDateString()}</div>
              {user.email && <div>{user.email}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Season Record</h3>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalCorrect}/{stats.totalPicks}
          </div>
          <div className="text-sm text-cfb-green-600 font-medium">
            {stats.seasonPercentage.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Weeks Played</h3>
            <CalendarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.completedWeeks}/{stats.totalWeeks}
          </div>
          <div className="text-sm text-gray-500">
            Participation Rate
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Best Week</h3>
            <TrophyIcon className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.bestWeek.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Peak Performance
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Average</h3>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.avgPercentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Weekly Average
          </div>
        </div>
      </div>

      {/* Weekly History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-cfb-display font-bold text-gray-900 mb-6">
          Weekly Performance
        </h2>
        
        {historyLoading ? (
          <LoadingSpinner size="md" />
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No weekly data available yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((week) => (
              <div 
                key={week.week_number} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    Week {week.week_number}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(week.deadline).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="text-right">
                  {week.total_picks > 0 ? (
                    <>
                      <div className="font-bold text-gray-900">
                        {week.correct_picks || 0}/{week.total_picks}
                      </div>
                      <div className={`text-sm font-medium ${
                        (week.percentage || 0) >= 70 ? 'text-green-600' :
                        (week.percentage || 0) >= 50 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {(week.percentage || 0).toFixed(1)}%
                      </div>
                      {week.weekly_rank && (
                        <div className="text-xs text-gray-500">
                          Rank #{week.weekly_rank}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">No picks</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {isOwnProfile && (
        <div className="flex justify-center space-x-4">
          <Link
            to="/picks"
            className="bg-cfb-green-600 text-white px-6 py-3 rounded-lg hover:bg-cfb-green-700 transition-colors duration-200 font-medium"
          >
            Make Picks
          </Link>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;