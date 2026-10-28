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
      className={`flex flex-col items-center justify-center p-12 rounded-xl border border-dashed border-stone-300 bg-white text-center shadow-xs ${
        className || ''
      }`}
    >
      <div className="p-3.5 rounded-full bg-beige-100 border border-beige-300 text-burgundy-700 mb-3">
        <Icon className="w-6 h-6 opacity-90" />
      </div>
      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider font-mono">{title}</h4>
      <p className="mt-1 text-xs text-stone-500 max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
