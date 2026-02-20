'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * 로그인 후 사용자가 users 테이블에 없으면 자동으로 생성
 * 최초 사용자는 admin, 그 외는 recruiter로 설정
 * @vntgcorp.com 도메인 사용자는 admin으로 설정
 */
export async function ensureUserExists() {
  const supabase = await createClient();

  // 현재 로그인한 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: '인증이 필요합니다.' };
  }

  // 사용자가 users 테이블에 있는지 확인
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', user.id)
    .single();

  // 이미 존재하면 성공
  if (!userError && userData) {
    return { success: true, user: userData };
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
      return { error: '조직 생성에 실패했습니다.' };
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

  if (createError || !newUser) {
    return { error: '사용자 생성에 실패했습니다.' };
  }

  return { success: true, user: newUser };
}

/**
 * 로그아웃 처리
 * @returns 성공 여부
 */
export async function signOut() {
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { error: error.message };
  }
  
  return { success: true };
}