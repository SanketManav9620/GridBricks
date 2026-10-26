import React from 'react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from './InfoTooltip';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  tooltip,
  actions,
  children,
  className,
  height = 'h-80',
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-sm hover:border-slate-300',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-2 border-b border-slate-100 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-mono">{title}</h3>
            {tooltip && <InfoTooltip content={tooltip} />}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>

      <div className={cn('w-full', height)}>{children}</div>
    </div>
  );
};
