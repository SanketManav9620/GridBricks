import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wind, Activity, BarChart3, BookOpen, ShieldCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-2xs">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-slate-900 font-mono text-base">
                  GRIDBRICKS
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80">
                  UK Wind Desk
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Day-Ahead Power Trading & Buffer Sizing</p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav aria-label="Main Navigation" className="flex items-center space-x-1 sm:space-x-1.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                )
              }
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>Day-Ahead Desk</span>
            </NavLink>

            <NavLink
              to="/accuracy"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                )
              }
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Accuracy & Buffer Sizing</span>
            </NavLink>

            <NavLink
              to="/method"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                )
              }
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              <span>Methodology</span>
            </NavLink>
          </nav>

          {/* Right Status Indicator */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-slate-700 font-medium font-mono text-[11px]">BMRS Elexon API</span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-mono text-[11px]">Jan 2026 Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span>Great Britain National Wind Fleet (BMRS FUELHH & WINDFOR datasets)</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://data.elexon.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-teal-600 transition-colors inline-flex items-center space-x-1"
            >
              <span>Elexon Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <span className="text-slate-500">AI-Assisted Pair Programming Implementation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
