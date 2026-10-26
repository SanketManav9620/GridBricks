import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load trading data',
  message = 'An error occurred while connecting to the analytics backend.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 rounded-xl border border-rose-200 bg-rose-50/40 text-center shadow-xs ${
        className || ''
      }`}
    >
      <div className="p-3 rounded-full bg-rose-100 border border-rose-200 text-rose-600 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider font-mono">{title}</h3>
      <p className="mt-1 text-xs text-slate-600 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry Query</span>
        </button>
      )}
    </div>
  );
};
