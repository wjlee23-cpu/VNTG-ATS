'use client';

import { useState, useEffect } from 'react';
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
import { getUserProfile } from '@/api/queries/auth';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentView = pathToView(pathname);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 사용자 역할 확인
  useEffect(() => {
    async function checkUserRole() {
      try {
        const result = await getUserProfile();
        if (result.data) {
          setIsAdmin(result.data.role === 'admin');
        }
      } catch (error) {
        console.error('사용자 역할 확인 실패:', error);
      } finally {
        setIsLoading(false);
      }
    }
    checkUserRole();
  }, []);

  const menuItems = [
    { icon: LayoutGrid, label: 'Overview', view: 'overview' as AppView, path: '/dashboard' },
    { icon: Users, label: 'Candidates', view: 'candidates' as AppView, path: '/candidates' },
    { icon: Briefcase, label: 'Jobs', view: 'jobs' as AppView, path: '/jobs' },
    { icon: FileEdit, label: 'JD Requests', view: 'jd-requests' as AppView, path: '/jd-requests' },
    { icon: Calendar, label: 'Calendar', view: 'calendar' as AppView, path: '/calendar' },
    { icon: BarChart3, label: 'Analytics', view: 'analytics' as AppView, path: '/analytics' },
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
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 bg-background border-r border-border flex-col items-center py-6 gap-2 z-50">
      {/* Logo (DS 2.0: Neutral 기반) */}
      <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center mb-6">
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
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative",
                isActive
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'
              )}
              title={item.label}
            >
              <Icon size={20} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>

              {/* Active Indicator (DS 2.0: Neutral) */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-neutral-900 rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative",
                isActive
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'
              )}
              title={item.label}
            >
              <Icon size={20} />
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>

              {/* Active Indicator (DS 2.0: Neutral) */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-neutral-900 rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
