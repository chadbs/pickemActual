import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'gold' | 'white';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'green',
  className = '',
  text
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const colorClasses = {
    green: 'text-cfb-green-600',
    gold: 'text-cfb-gold-600',
    white: 'text-white'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      <div className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}>
        <svg
          className="w-full h-full"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {text && (
        <div className={`text-sm font-medium ${colorClasses[color]}`}>
          {text}
        </div>
      )}
    </div>
  );
};

// Full page loading component
export const FullPageLoading: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-gray-50 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full mx-4">
        <LoadingSpinner size="lg" text={text} className="py-4" />
      </div>
    </div>
  );
};

// Inline loading for buttons
export const ButtonSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full ${className}`} />
  );
};

// Loading skeleton for content
export const ContentSkeleton: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <div className="rounded-full bg-gray-300 h-10 w-10" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-300 rounded w-3/4" />
            <div className="h-4 bg-gray-300 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Game card skeleton
export const GameCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="game-card p-6 animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-24" />
              <div className="h-6 bg-gray-300 rounded w-32" />
            </div>
            <div className="h-8 bg-gray-300 rounded w-16" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 bg-gray-300 rounded w-28" />
              <div className="h-4 bg-gray-300 rounded w-12" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-6 bg-gray-300 rounded w-24" />
              <div className="h-4 bg-gray-300 rounded w-12" />
            </div>
          </div>
          
          <div className="mt-6 flex space-x-3">
            <div className="flex-1 h-10 bg-gray-300 rounded-lg" />
            <div className="flex-1 h-10 bg-gray-300 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Leaderboard skeleton
export const LeaderboardSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="leaderboard-row p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-300 rounded-full" />
              <div className="space-y-2">
                <div className="h-5 bg-gray-300 rounded w-24" />
                <div className="h-3 bg-gray-300 rounded w-16" />
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="h-6 bg-gray-300 rounded w-12" />
              <div className="h-4 bg-gray-300 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingSpinner;