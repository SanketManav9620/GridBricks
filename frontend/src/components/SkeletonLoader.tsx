import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-stone-200 border border-stone-200/80', className)}
    />
  );
};

export const SkeletonKpiGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs space-y-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonChart: React.FC<{ height?: string }> = ({ height = 'h-80' }) => {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-stone-200 bg-white p-6 shadow-xs flex flex-col justify-between',
        height
      )}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
};
