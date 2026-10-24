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
      className={`flex flex-col items-center justify-center p-8 rounded-xl border border-rose-500/20 bg-navy-900/60 text-center ${
        className || ''
      }`}
    >
      <div className="p-3 rounded-full bg-rose-950/60 border border-rose-500/30 text-rose-400 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-200 uppercase tracking-wide">{title}</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-900/40 border border-rose-600/40 text-rose-300 hover:bg-rose-900/60 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry Query</span>
        </button>
      )}
    </div>
  );
};
