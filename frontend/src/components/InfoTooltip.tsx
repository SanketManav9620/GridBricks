import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, className }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        className="text-slate-400 hover:text-teal-600 transition-colors p-0.5 rounded focus:outline-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(!visible)}
        aria-label="Information"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 text-xs text-slate-700 bg-white border border-slate-200/90 rounded-lg shadow-xl pointer-events-none">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
        </div>
      )}
    </div>
  );
};
