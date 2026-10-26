import React from 'react';
import { Clock } from 'lucide-react';

interface CutoffSelectProps {
  cutoff: string;
  onChange: (newCutoff: string) => void;
  className?: string;
}

const PRESET_CUTOFFS = [
  { value: '09:00', label: '09:00 London (Default Desk Gate)' },
  { value: '09:30', label: '09:30 London (Pre-auction early)' },
  { value: '11:00', label: '11:00 London (Standard D-1 Gate)' },
  { value: '11:30', label: '11:30 London (Midday run)' },
  { value: '12:00', label: '12:00 London (EPEX Auction Close)' },
  { value: '14:00', label: '14:00 London (Post-auction near)' },
];

export const CutoffSelect: React.FC<CutoffSelectProps> = ({ cutoff, onChange, className }) => {
  return (
    <div
      className={`flex items-center space-x-2 bg-white border border-slate-200/90 rounded-lg px-3 py-1.5 shadow-2xs focus-within:ring-2 focus-within:ring-teal-500/30 transition-all ${className || ''}`}
    >
      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">D-1 Cutoff:</span>
      <select
        value={cutoff}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select D-1 Decision Cutoff Time"
        className="bg-transparent text-xs sm:text-sm font-semibold font-mono text-slate-900 cursor-pointer focus:outline-none"
      >
        {PRESET_CUTOFFS.map((c) => (
          <option key={c.value} value={c.value} className="bg-white text-slate-900">
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
};

