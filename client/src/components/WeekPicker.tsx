import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useWeeks, useCurrentWeek } from '../hooks/useApi';

interface WeekPickerProps {
  selectedWeek: number | null;
  onWeekChange: (weekId: number) => void;
  className?: string;
}

const WeekPicker: React.FC<WeekPickerProps> = ({ selectedWeek, onWeekChange, className = '' }) => {
  const { data: currentWeek } = useCurrentWeek();
  const { data: weeks = [] } = useWeeks();

  const sortedWeeks = weeks.sort((a, b) => a.week_number - b.week_number);
  const currentIndex = sortedWeeks.findIndex(w => w.id === selectedWeek);
  const selectedWeekData = sortedWeeks.find(w => w.id === selectedWeek);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onWeekChange(sortedWeeks[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < sortedWeeks.length - 1) {
      onWeekChange(sortedWeeks[currentIndex + 1].id);
    }
  };

  const handleCurrentWeek = () => {
    if (currentWeek) {
      onWeekChange(currentWeek.id);
    }
  };

  if (weeks.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      <button
        onClick={handlePrevious}
        disabled={currentIndex <= 0}
        className={`p-3 rounded-lg border-2 transition-all duration-200 ${
          currentIndex <= 0 
            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
            : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 shadow-sm hover:shadow-md'
        }`}
        title={currentIndex <= 0 ? "No previous weeks available" : "Go to previous week"}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      
      <div className="flex items-center space-x-4 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            Week {selectedWeekData?.week_number || '?'}
          </div>
          <div className="text-sm text-gray-600">
            {selectedWeekData?.season_year || new Date().getFullYear()}
          </div>
          {sortedWeeks.length > 1 && (
            <div className="text-xs text-gray-500 mt-1">
              {currentIndex + 1} of {sortedWeeks.length}
            </div>
          )}
        </div>
        
        {currentWeek && selectedWeek !== currentWeek.id && (
          <button
            onClick={handleCurrentWeek}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors font-medium border border-green-300 hover:border-green-400"
          >
            Go to Current
          </button>
        )}
      </div>
      
      <button
        onClick={handleNext}
        disabled={currentIndex >= sortedWeeks.length - 1}
        className={`p-3 rounded-lg border-2 transition-all duration-200 ${
          currentIndex >= sortedWeeks.length - 1
            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
            : 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 shadow-sm hover:shadow-md'
        }`}
        title={currentIndex >= sortedWeeks.length - 1 ? "No next weeks available" : "Go to next week"}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default WeekPicker;