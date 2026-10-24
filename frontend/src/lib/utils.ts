import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMW(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return (
    new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: 0,
    }).format(val) + ' MW'
  );
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toFixed(1)}%`;
}

export function formatTimeHHMM(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  } catch {
    return isoString;
  }
}

export function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeUTC(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return isoString;
  }
}

