'use client';

import { 
  LayoutGrid, 
  Users, 
  Briefcase, 
  Calendar, 
  BarChart3, 
  UserCircle, 
  FileText, 
  Gift,
  Settings,
  FileEdit,
  Zap
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { pathToView, type AppView } from '@/types/navigation';
import { cn } from '@/components/ui/utils';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentView = pathToView(pathname);

  const menuItems = [
    { icon: LayoutGrid, label: 'Overview', view: 'overview' as AppView, path: '/' },
    { icon: Users, label: 'Candidates', view: 'candidates' as AppView, path: '/candidates' },
    { icon: Briefcase, label: 'Jobs', view: 'jobs' as AppView, path: '/jobs' },
    { icon: FileEdit, label: 'JD Requests', view: 'jd-requests' as AppView, path: '/jd-requests' },
    { icon: Calendar, label: 'Calendar', view: 'calendar' as AppView, path: '/calendar' },
    { icon: BarChart3, label: 'Analytics', view: 'analytics' as AppView, path: '/analytics' },
    { icon: Gift, label: 'Offers', view: 'offers' as AppView, path: '/offers' },
    { icon: UserCircle, label: 'Team', view: 'team' as AppView, path: '/team' },
    { icon: FileText, label: 'Templates', view: 'templates' as AppView, path: '/templates' },
  ];

  const bottomNavItems = [
    { id: 'settings' as AppView, icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 bg-white border-r border-gray-200 flex-col items-center py-6 gap-2 z-50">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center mb-6 shadow-lg shadow-brand-main/20">
        <Zap className="text-white" size={20} />
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view || pathname.startsWith(item.path);
          
          return (
            <button
              key={item.view}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative",
                isActive
                  ? 'bg-brand-main/10 text-brand-main'
                  : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
              )}
              title={item.label}
            >
              <Icon size={20} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-brand-main rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative",
                isActive
                  ? 'bg-brand-main/10 text-brand-main'
                  : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
              )}
              title={item.label}
            >
              <Icon size={20} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-brand-main rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
