'use client';

import { Search, Bell, ChevronDown, Command } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TopBarProps {
  onCommandOpen: () => void;
}

export function TopBar({ onCommandOpen }: TopBarProps) {
  const router = useRouter();

  return (
    <header className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Left: Search */}
      <button
        onClick={onCommandOpen}
        className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all w-full md:w-96 group"
      >
        <Search size={16} className="text-gray-400" />
        <span className="text-sm text-gray-500 flex-1 text-left">Search candidates, jobs...</span>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs text-gray-400">
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative w-10 h-10 rounded-xl hover:bg-gray-50 flex items-center justify-center transition-all">
          <Bell size={18} className="text-gray-600" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>

        {/* User Menu */}
        <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center text-white text-sm font-semibold">
            HR
          </div>
          <span className="text-sm font-medium text-gray-700">HR Team</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>
    </header>
  );
}
