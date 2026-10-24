import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wind, Activity, BarChart3, BookOpen, ShieldCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-navy-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/30 text-teal-400 shadow-sm">
              <Wind className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-white font-mono text-base">
                  GRIDBRICKS
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-500/30">
                  UK Wind Desk
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Day-Ahead Power Trading & Buffer Sizing</p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav aria-label="Main Navigation" className="flex items-center space-x-1 sm:space-x-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80 border border-transparent'
                )
              }
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Day-Ahead Desk</span>
            </NavLink>

            <NavLink
              to="/accuracy"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80 border border-transparent'
                )
              }
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Accuracy & Buffer Sizing</span>
            </NavLink>

            <NavLink
              to="/method"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  isActive
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/80 border border-transparent'
                )
              }
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Methodology</span>
            </NavLink>
          </nav>


          {/* Right Status Indicator */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-navy-800 border border-slate-700/80 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              <span className="text-slate-300 font-medium">BMRS Elexon API</span>
            </div>

            <div className="flex items-center space-x-1 text-slate-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Jan 2026 Decisions</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-navy-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span>Great Britain National Wind Fleet (BMRS FUELHH & WINDFOR datasets)</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://data.elexon.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-400 transition-colors inline-flex items-center space-x-1"
            >
              <span>Elexon Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <span className="text-slate-400">AI-Assisted Pair Programming Implementation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
