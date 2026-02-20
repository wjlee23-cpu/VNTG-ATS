'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Clock, Users, Briefcase, Zap, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { viewToPath, type AppView } from '@/types/navigation';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const recentSearches = [
  { id: '1', text: 'Sarah Kim', type: 'candidate', icon: Users, action: 'candidates' as AppView },
  { id: '2', text: 'Senior Designer positions', type: 'job', icon: Briefcase, action: 'jobs' as AppView },
  { id: '3', text: 'Interview scheduled today', type: 'action', icon: Clock, action: 'calendar' as AppView },
];

const suggestions = [
  { id: '1', text: 'View all active candidates', action: 'candidates' as AppView, icon: Users },
  { id: '2', text: 'Create new job posting', action: 'job-create' as AppView, icon: Briefcase },
  { id: '3', text: 'Analytics dashboard', action: 'analytics' as AppView, icon: TrendingUp },
  { id: '4', text: 'Team management', action: 'team' as AppView, icon: Zap },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  const handleSelect = (action: AppView) => {
    const path = viewToPath(action);
    router.push(path);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-[640px] z-50 animate-scale-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <Search size={20} className="text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidates, jobs, or type a command..."
              className="flex-1 outline-none text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {query === '' && (
              <>
                {/* Recent Searches */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                    Recent
                  </div>
                  {recentSearches.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.action)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Icon size={16} className="text-gray-600" />
                        </div>
                        <span className="flex-1 text-left text-sm text-gray-700">{item.text}</span>
                        <ArrowRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>

                {/* Suggestions */}
                <div className="px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                    Suggestions
                  </div>
                  {suggestions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.action)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-main/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-main/10 flex items-center justify-center group-hover:bg-brand-main/20 transition-colors">
                          <Icon size={16} className="text-brand-main" />
                        </div>
                        <span className="flex-1 text-left text-sm text-gray-700 group-hover:text-brand-dark">{item.text}</span>
                        <ArrowRight size={14} className="text-brand-main opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {query !== '' && (
              <div className="px-4 py-3">
                <div className="text-sm text-gray-500 px-3 py-2">
                  Searching for "<span className="font-semibold text-gray-900">{query}</span>"...
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">esc</kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
