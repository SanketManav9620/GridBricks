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
  variant?: 'default' | 'burgundy' | 'beige' | 'teal' | 'amber' | 'rose' | 'blue';
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
  const variantStyles: Record<string, string> = {
    default: 'border-stone-200/90 bg-white text-stone-900 shadow-xs hover:border-stone-300',
    burgundy: 'border-burgundy-200/90 bg-white text-stone-900 shadow-xs hover:border-burgundy-300',
    beige: 'border-beige-300/90 bg-white text-stone-900 shadow-xs hover:border-beige-400',
    teal: 'border-burgundy-200/90 bg-white text-stone-900 shadow-xs hover:border-burgundy-300',
    amber: 'border-beige-300/90 bg-white text-stone-900 shadow-xs hover:border-beige-400',
    rose: 'border-burgundy-300 bg-burgundy-50/30 text-stone-900 shadow-xs hover:border-burgundy-400',
    blue: 'border-stone-300 bg-stone-50/50 text-stone-900 shadow-xs hover:border-stone-400',
  };

  const iconStyles: Record<string, string> = {
    default: 'text-stone-600 bg-stone-100 border border-stone-200',
    burgundy: 'text-burgundy-700 bg-burgundy-50 border border-burgundy-200',
    beige: 'text-beige-800 bg-beige-100 border border-beige-300',
    teal: 'text-burgundy-700 bg-burgundy-50 border border-burgundy-200',
    amber: 'text-beige-800 bg-beige-100 border border-beige-300',
    rose: 'text-burgundy-700 bg-burgundy-100 border border-burgundy-200',
    blue: 'text-stone-700 bg-stone-100 border border-stone-200',
  };

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border transition-all duration-200 hover:shadow-sm',
        variantStyles[variant] || variantStyles.default,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 font-mono">
            {title}
          </span>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', iconStyles[variant] || iconStyles.default)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-stone-900">{value}</span>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-beige-100 border border-beige-300 text-stone-800 font-mono">
            {badge}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-stone-500 mt-1 font-sans">{subtitle}</p>}
    </div>
  );
};
