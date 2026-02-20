/**
 * 인증 및 권한 체크 유틸리티
 * 모든 Server Actions와 Queries에서 사용하는 공통 인증 로직
 */

import { createClient } from '@/lib/supabase/server';

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
 * @returns 사용자 정보와 organization_id
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
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    throw new Error('사용자 정보를 찾을 수 없습니다.');
  }

  return {
    userId: userData.id,
    email: userData.email,
    organizationId: userData.organization_id,
    role: userData.role,
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
 * @param jobPostId 확인할 job_post_id
 * @returns job_post 정보
 * @throws 권한이 없거나 job_post가 존재하지 않는 경우 에러 발생
 */
export async function verifyJobPostAccess(jobPostId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  // job_post 조회 및 organization_id 확인
  const { data: jobPost, error } = await supabase
    .from('job_posts')
    .select('id, organization_id, title')
    .eq('id', jobPostId)
    .single();

  if (error || !jobPost) {
    throw new Error('채용 공고를 찾을 수 없습니다.');
  }

  if (jobPost.organization_id !== user.organizationId) {
    throw new Error('이 채용 공고에 접근할 권한이 없습니다.');
  }

  return jobPost;
}

/**
 * 특정 candidate_id가 현재 사용자의 organization에 속하는지 확인합니다.
 * @param candidateId 확인할 candidate_id
 * @returns candidate 정보
 * @throws 권한이 없거나 candidate가 존재하지 않는 경우 에러 발생
 */
export async function verifyCandidateAccess(candidateId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

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

  if (error || !candidate) {
    throw new Error('후보자를 찾을 수 없습니다.');
  }

  const jobPost = candidate.job_posts as any;
  if (jobPost.organization_id !== user.organizationId) {
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
