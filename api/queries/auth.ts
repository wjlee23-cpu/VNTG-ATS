'use server';

import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 로그인한 사용자의 프로필 정보를 조회합니다.
 * 클라이언트 컴포넌트에서 사용할 수 있는 Server Action입니다.
 * 사용자가 users 테이블에 없으면 자동으로 생성합니다.
 * @returns 사용자 프로필 정보 (이메일, 역할, 프로필 이미지 등)
 */
export async function getUserProfile() {
  return withErrorHandling(async () => {
    // getCurrentUser()는 사용자가 없으면 자동으로 생성합니다
    const user = await getCurrentUser();
    const authUser = user.authUser;

    // 구글 OAuth에서 가져온 프로필 이미지 URL
    // user.user_metadata.avatar_url 또는 user.user_metadata.picture 사용
    const avatarUrl = authUser.user_metadata?.avatar_url || 
                     authUser.user_metadata?.picture || 
                     null;

    // 사용자 이름 (이메일에서 추출하거나 user_metadata에서 가져오기)
    const displayName = authUser.user_metadata?.full_name || 
                       authUser.user_metadata?.name || 
                       user.email.split('@')[0];

    return {
      id: user.userId,
      email: user.email,
      displayName,
      role: user.role,
      organizationId: user.organizationId,
      avatarUrl,
    };
  });
}
