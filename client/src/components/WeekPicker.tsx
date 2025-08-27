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
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Previous week"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">
            Week {selectedWeekData?.week_number || '?'}
          </div>
          <div className="text-sm text-gray-600">
            {selectedWeekData?.season_year || new Date().getFullYear()}
          </div>
        </div>
        
        {currentWeek && selectedWeek !== currentWeek.id && (
          <button
            onClick={handleCurrentWeek}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors"
          >
            Current
          </button>
        )}
      </div>
      
      <button
        onClick={handleNext}
        disabled={currentIndex >= sortedWeeks.length - 1}
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Next week"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default WeekPicker;