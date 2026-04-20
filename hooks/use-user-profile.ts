import { useEffect, useMemo, useState } from 'react';
import { getUserProfile } from '@/api/queries/auth';

type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager';
  organizationId: string;
  avatarUrl: string | null;
};

type UseUserProfileState = {
  data: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

// ✅ 클라이언트 전역(탭 내) 캐시
// - Sidebar, TopBar 등 여러 컴포넌트가 동시에 떠도 서버 왕복을 1번으로 줄입니다.
let cachedUserProfile: UserProfile | null = null;
let cachedAt = 0;
let inflight: Promise<UserProfile | null> | null = null;

const TTL_MS = 30_000; // 짧은 캐시(10~30초) 허용 정책에 맞춤

async function fetchUserProfileWithCache(): Promise<UserProfile | null> {
  const now = Date.now();
  if (cachedUserProfile && now - cachedAt <= TTL_MS) return cachedUserProfile;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const result = await getUserProfile();
      if (result.data) {
        cachedUserProfile = result.data as UserProfile;
        cachedAt = Date.now();
        return cachedUserProfile;
      }
      // data가 없으면 캐시를 비우고 null 처리
      cachedUserProfile = null;
      cachedAt = Date.now();
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useUserProfile(): UseUserProfileState {
  const [data, setData] = useState<UserProfile | null>(cachedUserProfile);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedUserProfile);
  const [error, setError] = useState<string | null>(null);

  const refresh = useMemo(() => {
    return async () => {
      try {
        setIsLoading(true);
        setError(null);
        // 강제 새로고침: 캐시 무효화
        cachedUserProfile = null;
        cachedAt = 0;
        const next = await fetchUserProfileWithCache();
        setData(next);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '사용자 정보를 불러오는데 실패했습니다.';
        setError(msg);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(!cachedUserProfile);
        const next = await fetchUserProfileWithCache();
        if (cancelled) return;
        setData(next);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '사용자 정보를 불러오는데 실패했습니다.';
        setError(msg);
        setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error, refresh };
}

