/**
 * 인증 및 권한 체크 유틸리티
 * 모든 Server Actions와 Queries에서 사용하는 공통 인증 로직
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * 권한 레벨 타입 정의
 */
export type UserRole = 'admin' | 'recruiter' | 'interviewer';

/**
 * 권한 계층 정의 (높을수록 권한이 큼)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  recruiter: 2,
  interviewer: 1,
};

/**
 * 사용자 role이 필요한 role 이상인지 확인합니다.
 * @param userRole 사용자의 role
 * @param requiredRole 필요한 최소 role
 * @returns 권한이 있으면 true, 없으면 false
 */
export function checkRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 현재 로그인한 사용자 정보와 organization_id를 가져옵니다.
 * 사용자가 users 테이블에 없으면 자동으로 생성합니다.
 * @returns 사용자 정보와 organization_id, auth.user 정보 포함
 * @throws 인증되지 않은 경우 에러 발생
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  
  // 현재 로그인한 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('인증이 필요합니다. 로그인해주세요.');
  }

  // users 테이블에서 organization_id 가져오기
  let { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', user.id)
    .single();

  // 사용자가 없으면 자동으로 생성
  if (userError || !userData) {
    // Service Role Key 확인
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다. 사용자 자동 생성에 필요합니다.'
      );
    }

    // Service Role Client를 사용하여 RLS 정책 우회 (조직 생성/조회용)
    const serviceClient = createServiceClient();

    // 전체 users 테이블의 사용자 수 확인 (최초 사용자 판단용)
    const { count: totalUsers } = await serviceClient
      .from('users')
      .select('*', { count: 'exact', head: true });

    // 기본 조직 찾기 또는 생성 (Service Role Client 사용)
    let { data: organization } = await serviceClient
      .from('organizations')
      .select('id')
      .limit(1)
      .maybeSingle();

    // 조직이 없으면 생성
    if (!organization) {
      const { data: newOrg, error: orgError } = await serviceClient
        .from('organizations')
        .insert({ name: 'VNTG Tech' })
        .select('id')
        .single();

      if (orgError || !newOrg) {
        // 더 자세한 에러 정보 로깅 (개발 환경)
        if (process.env.NODE_ENV === 'development') {
          console.error('조직 생성 실패 상세:', {
            error: orgError,
            newOrg,
          });
        }
        throw new Error(
          `조직 생성에 실패했습니다: ${orgError?.message || '알 수 없는 오류'}. 관리자에게 문의하세요.`
        );
      }
      organization = newOrg;
    }

    // 최초 사용자는 admin, 그 외는 recruiter로 설정
    // 또는 특정 이메일 도메인(@vntgcorp.com)은 admin으로 설정
    const userEmail = user.email || '';
    const isVNTGEmail = userEmail.endsWith('@vntgcorp.com');
    const isFirstUser = (totalUsers || 0) === 0;
    const userRole = (isFirstUser || isVNTGEmail) ? 'admin' : 'recruiter';

    // 사용자 생성 (Service Role Client 사용하여 RLS 정책 우회)
    const { data: newUser, error: createError } = await serviceClient
      .from('users')
      .insert({
        id: user.id,
        email: userEmail,
        organization_id: organization.id,
        role: userRole,
      })
      .select('id, email, organization_id, role')
      .single();

    if (createError) {
      // 중복 키 에러인 경우 (이미 다른 경로에서 생성되었을 수 있음) 재시도
      if (createError.code === '23505' || createError.message?.includes('duplicate')) {
        // 재시도: users 테이블에서 다시 조회
        const { data: retryUserData, error: retryError } = await serviceClient
          .from('users')
          .select('id, email, organization_id, role')
          .eq('id', user.id)
          .single();

        if (!retryError && retryUserData) {
          userData = retryUserData;
        } else {
          // 더 자세한 에러 정보 로깅 (개발 환경)
          if (process.env.NODE_ENV === 'development') {
            console.error('사용자 생성 실패 상세 (재시도 후):', {
              error: createError,
              retryError,
              userId: user.id,
              email: userEmail,
              organizationId: organization.id,
              role: userRole,
            });
          }
          throw new Error(
            `사용자 정보 생성에 실패했습니다: ${createError.message || '알 수 없는 오류'}. 관리자에게 문의하세요.`
          );
        }
      } else {
        // 다른 종류의 에러
        // 더 자세한 에러 정보 로깅 (개발 환경)
        if (process.env.NODE_ENV === 'development') {
          console.error('사용자 생성 실패 상세:', {
            error: createError,
            errorCode: createError.code,
            errorMessage: createError.message,
            errorDetails: createError.details,
            userId: user.id,
            email: userEmail,
            organizationId: organization.id,
            role: userRole,
          });
        }
        throw new Error(
          `사용자 정보 생성에 실패했습니다: ${createError.message || '알 수 없는 오류'}. 관리자에게 문의하세요.`
        );
      }
    } else if (!newUser) {
      throw new Error('사용자 정보 생성에 실패했습니다: 응답 데이터가 없습니다. 관리자에게 문의하세요.');
    } else {
      userData = newUser;
    }
  }

  return {
    userId: userData.id,
    email: userData.email,
    organizationId: userData.organization_id,
    role: userData.role,
    // auth.user 객체 정보 (프로필 이미지 등에 사용)
    authUser: user,
  };
}

/**
 * 특정 organization_id에 대한 접근 권한을 확인합니다.
 * @param organizationId 확인할 organization_id
 * @throws 권한이 없는 경우 에러 발생
 */
export async function checkOrganizationAccess(organizationId: string) {
  const user = await getCurrentUser();
  
  if (user.organizationId !== organizationId) {
    throw new Error('이 조직의 데이터에 접근할 권한이 없습니다.');
  }

  return user;
}

/**
 * 특정 job_post_id가 현재 사용자의 organization에 속하는지 확인합니다.
 * 관리자는 모든 job_post에 접근할 수 있습니다.
 * @param jobPostId 확인할 job_post_id
 * @returns job_post 정보
 * @throws 권한이 없거나 job_post가 존재하지 않는 경우 에러 발생
 */
export async function verifyJobPostAccess(jobPostId: string) {
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  
  // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
  const supabase = isAdmin ? createServiceClient() : await createClient();

  // job_post 조회 및 organization_id 확인
  const { data: jobPost, error } = await supabase
    .from('job_posts')
    .select('id, organization_id, title')
    .eq('id', jobPostId)
    .single();

  if (error) {
    // RLS 정책 위반인 경우 권한 문제로 처리
    if (error.code === 'PGRST116' || error.message?.includes('row-level security')) {
      throw new Error('이 채용 공고에 접근할 권한이 없습니다.');
    }
    // 데이터가 없는 경우
    if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
      throw new Error('채용 공고를 찾을 수 없습니다.');
    }
    // 기타 에러
    throw new Error(`채용 공고 조회 중 오류가 발생했습니다: ${error.message}`);
  }

  if (!jobPost) {
    throw new Error('채용 공고를 찾을 수 없습니다.');
  }

  // 관리자는 모든 job_post에 접근 가능
  if (!isAdmin && jobPost.organization_id !== user.organizationId) {
    throw new Error('이 채용 공고에 접근할 권한이 없습니다.');
  }

  return jobPost;
}

/**
 * 특정 candidate_id가 현재 사용자의 organization에 속하는지 확인합니다.
 * 관리자는 모든 candidate에 접근할 수 있습니다.
 * @param candidateId 확인할 candidate_id
 * @returns candidate 정보
 * @throws 권한이 없거나 candidate가 존재하지 않는 경우 에러 발생
 */
export async function verifyCandidateAccess(candidateId: string) {
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  
  // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
  const supabase = isAdmin ? createServiceClient() : await createClient();

  // candidate와 연결된 job_post를 통해 organization_id 확인
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select(`
      id,
      job_post_id,
      job_posts!inner(organization_id)
    `)
    .eq('id', candidateId)
    .single();

  if (error) {
    // RLS 정책 위반인 경우 권한 문제로 처리
    if (error.code === 'PGRST116' || error.message?.includes('row-level security')) {
      throw new Error('이 후보자에 접근할 권한이 없습니다.');
    }
    // 데이터가 없는 경우
    if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
      throw new Error('후보자를 찾을 수 없습니다.');
    }
    // job_post가 없는 경우 (inner join 실패)
    if (error.message?.includes('foreign key') || error.message?.includes('job_posts')) {
      throw new Error('후보자와 연결된 채용 공고를 찾을 수 없습니다.');
    }
    // 기타 에러
    throw new Error(`후보자 조회 중 오류가 발생했습니다: ${error.message}`);
  }

  if (!candidate) {
    throw new Error('후보자를 찾을 수 없습니다.');
  }

  // job_posts는 Supabase의 관계 쿼리 결과이므로 타입 단언 필요
  // 하지만 organization_id만 확인하면 되므로 안전하게 처리
  const jobPost = candidate.job_posts as { organization_id: string } | null | undefined;
  // 관리자는 모든 candidate에 접근 가능
  if (!isAdmin && jobPost?.organization_id !== user.organizationId) {
    throw new Error('이 후보자에 접근할 권한이 없습니다.');
  }

  return candidate;
}

/**
 * 특정 role 이상의 권한이 필요한지 확인합니다.
 * @param requiredRole 필요한 최소 role
 * @returns 사용자 정보
 * @throws 권한이 없는 경우 에러 발생
 */
export async function requireRole(requiredRole: UserRole) {
  const user = await getCurrentUser();
  
  if (!checkRole(user.role, requiredRole)) {
    throw new Error(`${requiredRole} 이상의 권한이 필요합니다. 현재 권한: ${user.role}`);
  }

  return user;
}

/**
 * admin 권한이 필요한지 확인합니다.
 * @returns 사용자 정보
 * @throws admin 권한이 없는 경우 에러 발생
 */
export async function requireAdmin() {
  return requireRole('admin');
}

/**
 * recruiter 이상의 권한이 필요한지 확인합니다.
 * @returns 사용자 정보
 * @throws recruiter 이상의 권한이 없는 경우 에러 발생
 */
export async function requireRecruiterOrAdmin() {
  return requireRole('recruiter');
}

/**
 * interviewer 이상의 권한이 필요한지 확인합니다.
 * (모든 로그인한 사용자는 최소 interviewer 권한을 가지므로 사실상 모든 사용자 통과)
 * @returns 사용자 정보
 * @throws interviewer 이상의 권한이 없는 경우 에러 발생
 */
export async function requireInterviewerOrAbove() {
  return requireRole('interviewer');
}
