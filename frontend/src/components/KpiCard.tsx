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
    default: 'border-slate-800 bg-navy-900/80 text-slate-100',
    teal: 'border-teal-500/30 bg-navy-900/90 text-teal-300 card-glow',
    amber: 'border-amber-500/30 bg-navy-900/90 text-amber-300 card-amber-glow',
    rose: 'border-rose-500/30 bg-navy-900/90 text-rose-300',
    blue: 'border-sky-500/30 bg-navy-900/90 text-sky-300',
  };

  const iconStyles = {
    default: 'text-slate-400 bg-navy-800',
    teal: 'text-teal-400 bg-teal-950/60 border border-teal-500/20',
    amber: 'text-amber-400 bg-amber-950/60 border border-amber-500/20',
    rose: 'text-rose-400 bg-rose-950/60 border border-rose-500/20',
    blue: 'text-sky-400 bg-sky-950/60 border border-sky-500/20',
  };

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border backdrop-blur-md transition-all duration-200 hover:border-slate-700',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </span>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        {Icon && (
          <div className={cn('p-2 rounded-lg', iconStyles[variant])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-white">{value}</span>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-navy-800 border border-slate-700 text-slate-300">
            {badge}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-400 truncate">{subtitle}</p>}
    </div>
  );
};
