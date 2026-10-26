import React from 'react';
import { Wind, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No generation data available',
  description = 'No records match the selected date or cutoff filters.',
  icon: Icon = Wind,
  action,
  className,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 rounded-xl border border-dashed border-slate-300 bg-white text-center shadow-xs ${
        className || ''
      }`}
    >
      <div className="p-3.5 rounded-full bg-slate-100 border border-slate-200 text-teal-600 mb-3">
        <Icon className="w-6 h-6 opacity-80" />
      </div>
      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">{title}</h4>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
