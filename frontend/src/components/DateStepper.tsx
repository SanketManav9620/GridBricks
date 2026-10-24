import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDateLabel } from '@/lib/utils';

interface DateStepperProps {
  currentDate: string;
  availableDates: string[];
  onChange: (newDate: string) => void;
  className?: string;
}

export const DateStepper: React.FC<DateStepperProps> = ({
  currentDate,
  availableDates,
  onChange,
  className,
}) => {
  const currentIndex = availableDates.indexOf(currentDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < availableDates.length - 1;

  const handlePrev = () => {
    if (hasPrev) onChange(availableDates[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onChange(availableDates[currentIndex + 1]);
  };

  return (
    <div
      className={`flex items-center space-x-1.5 bg-navy-900 border border-slate-700/80 rounded-lg p-1 focus-within:ring-2 focus-within:ring-teal-500/60 transition-all ${className || ''}`}
    >
      <button
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="Previous Delivery Day"
        className="p-1.5 rounded-md hover:bg-navy-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="relative flex items-center px-2 py-0.5">
        <Calendar className="w-3.5 h-3.5 text-teal-400 mr-2 shrink-0" />
        <select
          value={currentDate}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Select Delivery Date"
          className="appearance-none bg-transparent text-xs sm:text-sm font-semibold text-white font-mono cursor-pointer focus:outline-none pr-4"
        >
          {availableDates.map((d) => (
            <option key={d} value={d} className="bg-navy-900 text-slate-100">
              {formatDateLabel(d)} ({d})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="Next Delivery Day"
        className="p-1.5 rounded-md hover:bg-navy-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

    </div>
  );
};
