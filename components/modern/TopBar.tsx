'use client';

import { Search, Bell, ChevronDown, Command, LogOut, User, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getUserProfile } from '@/api/queries/auth';
import { signOut } from '@/api/actions/auth';
import { toast } from 'sonner';

interface TopBarProps {
  onCommandOpen: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'recruiter' | 'interviewer';
  organizationId: string;
  avatarUrl: string | null;
}

export function TopBar({ onCommandOpen }: TopBarProps) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const result = await getUserProfile();
        if (result.data) {
          setUserProfile(result.data);
        }
      } catch (error) {
        console.error('사용자 프로필 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUserProfile();
  }, []);

  // 로그아웃 처리
  const handleSignOut = async () => {
    try {
      const result = await signOut();
      if (result.success) {
        toast.success('로그아웃되었습니다.');
        router.push('/');
        router.refresh();
      } else {
        toast.error(result.error || '로그아웃에 실패했습니다.');
        console.error('로그아웃 실패:', result.error);
      }
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다.');
      console.error('로그아웃 중 오류:', error);
    }
  };

  // 역할 표시 텍스트
  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: '관리자',
      recruiter: '채용담당자',
      interviewer: '면접관',
    };
    return roleMap[role] || role;
  };

  // 이니셜 생성 (이메일에서 첫 글자 추출)
  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:gap-4 sm:px-6">
      {/* Left: Search — w-full만 주면 우측(알림·프로필) 폭이 0에 가까워져 텍스트가 세로로 깨질 수 있음 */}
      <button
        onClick={onCommandOpen}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-muted px-3 py-2 transition-all hover:bg-muted/80 sm:px-4 md:w-96 md:flex-none"
      >
        <Search size={16} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground">
          Search candidates, jobs...
        </span>
        <div className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground sm:flex">
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <button className="relative w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all">
          <Bell size={18} className="text-foreground" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
        </button>

        {/* User Menu */}
        {!loading && userProfile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex max-w-full shrink-0 items-center gap-2 rounded-xl px-2 py-2 transition-all hover:bg-muted sm:gap-3 sm:px-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={userProfile.avatarUrl || undefined} alt={userProfile.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-dark to-brand-main text-sm font-semibold text-white">
                    {getInitials(userProfile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-medium text-foreground md:max-w-[12rem]">
                    {userProfile.displayName}
                  </span>
                  <span className="block whitespace-nowrap text-xs text-muted-foreground">
                    {getRoleText(userProfile.role)}
                  </span>
                </div>
                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userProfile.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userProfile.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>프로필</span>
              </DropdownMenuItem>
              {userProfile.role === 'admin' && (
                <DropdownMenuItem className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>관리자 설정</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // 로딩 중이거나 사용자 정보가 없을 때 기본 표시 (에러 발생 시에도 표시)
          <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-all">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User size={14} />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">게스트</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </header>
  );
}
