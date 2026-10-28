import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wind, Activity, BarChart3, BookOpen, ShieldCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#f7f6f3] text-stone-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-stone-200/90 bg-[#faf9f6]/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-burgundy-50 border border-burgundy-200 text-burgundy-700 shadow-2xs">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-tight text-stone-900 font-mono text-base">
                  GRIDBRICKS
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-beige-100 text-burgundy-900 border border-beige-300">
                  UK Wind Desk
                </span>
              </div>
              <p className="text-[11px] text-stone-500">Day-Ahead Power Trading & Buffer Sizing</p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav aria-label="Main Navigation" className="flex items-center space-x-1 sm:space-x-1.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600',
                  isActive
                    ? 'bg-burgundy-700 text-white shadow-xs border border-burgundy-800'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-beige-100/70 border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Activity className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-burgundy-700')} />
                  <span>Day-Ahead Desk</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/accuracy"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600',
                  isActive
                    ? 'bg-burgundy-700 text-white shadow-xs border border-burgundy-800'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-beige-100/70 border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <BarChart3 className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-beige-700')} />
                  <span>Accuracy & Buffer Sizing</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/method"
              className={({ isActive }) =>
                cn(
                  'flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600',
                  isActive
                    ? 'bg-burgundy-700 text-white shadow-xs border border-burgundy-800'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-beige-100/70 border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <BookOpen className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-stone-600')} />
                  <span>Methodology</span>
                </>
              )}
            </NavLink>
          </nav>

          {/* Right Status Indicator */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-xs shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-stone-700 font-medium font-mono text-[11px]">BMRS Elexon API</span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-beige-100 border border-beige-300 text-xs font-medium text-stone-800 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-burgundy-700" />
              <span className="font-mono text-[11px]">Jan 2026 Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-[#faf9f6] py-4 text-center text-xs text-stone-500 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span>Great Britain National Wind Fleet (BMRS FUELHH & WINDFOR datasets)</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://data.elexon.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 hover:text-burgundy-700 transition-colors inline-flex items-center space-x-1 font-medium"
            >
              <span>Elexon Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <span className="text-stone-500">AI-Assisted Pair Programming Implementation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
