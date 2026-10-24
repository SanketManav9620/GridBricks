import React from 'react';
import { Clock } from 'lucide-react';

interface CutoffSelectProps {
  cutoff: string;
  onChange: (newCutoff: string) => void;
  className?: string;
}

const PRESET_CUTOFFS = [
  { value: '09:30', label: '09:30 London (Pre-auction early)' },
  { value: '11:00', label: '11:00 London (Standard D-1 Gate)' },
  { value: '11:30', label: '11:30 London (Midday run)' },
  { value: '12:00', label: '12:00 London (EPEX Auction Close)' },
  { value: '14:00', label: '14:00 London (Post-auction near)' },
];

export const CutoffSelect: React.FC<CutoffSelectProps> = ({ cutoff, onChange, className }) => {
  return (
    <div
      className={`flex items-center space-x-2 bg-navy-900 border border-slate-700/80 rounded-lg px-3 py-1.5 ${className || ''}`}
    >
      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">D-1 Cutoff:</span>
      <select
        value={cutoff}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-semibold font-mono text-amber-300 cursor-pointer focus:outline-none"
      >
        {PRESET_CUTOFFS.map((c) => (
          <option key={c.value} value={c.value} className="bg-navy-900 text-slate-100">
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
};
