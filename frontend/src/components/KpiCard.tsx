import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from './InfoTooltip';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  tooltip?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'teal' | 'amber' | 'rose' | 'blue';
  badge?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  tooltip,
  icon: Icon,
  variant = 'default',
  badge,
  className,
}) => {
  const variantStyles = {
    default: 'border-slate-200/90 bg-white text-slate-900 shadow-xs',
    teal: 'border-teal-200 bg-white text-slate-900 shadow-xs',
    amber: 'border-amber-200 bg-white text-slate-900 shadow-xs',
    rose: 'border-rose-200 bg-white text-slate-900 shadow-xs',
    blue: 'border-sky-200 bg-white text-slate-900 shadow-xs',
  };

  const iconStyles = {
    default: 'text-slate-600 bg-slate-100 border border-slate-200',
    teal: 'text-teal-700 bg-teal-50 border border-teal-200',
    amber: 'text-amber-700 bg-amber-50 border border-amber-200',
    rose: 'text-rose-700 bg-rose-50 border border-rose-200',
    blue: 'text-sky-700 bg-sky-50 border border-sky-200',
  };

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border transition-all duration-200 hover:border-slate-300 hover:shadow-sm',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            {title}
          </span>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', iconStyles[variant])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">{value}</span>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 border border-slate-200 text-slate-700 font-mono">
            {badge}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>}
    </div>
  );
};
