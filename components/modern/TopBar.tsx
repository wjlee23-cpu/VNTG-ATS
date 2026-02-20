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
        {!loading && userProfile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userProfile.avatarUrl || undefined} alt={userProfile.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-dark to-brand-main text-white text-sm font-semibold">
                    {getInitials(userProfile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-700">{userProfile.displayName}</span>
                  <span className="text-xs text-gray-500">{getRoleText(userProfile.role)}</span>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userProfile.displayName}</p>
                  <p className="text-xs leading-none text-gray-500">{userProfile.email}</p>
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
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // 로딩 중이거나 사용자 정보가 없을 때 기본 표시 (에러 발생 시에도 표시)
          <button className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center text-white text-sm font-semibold">
              HR
            </div>
            <span className="text-sm font-medium text-gray-700">HR Team</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
        )}
      </div>
    </header>
  );
}
