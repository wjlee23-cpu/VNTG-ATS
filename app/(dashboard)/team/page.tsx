import { getCurrentUser } from '@/api/utils/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { TeamClient } from './TeamClient';

export default async function TeamPage() {
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  
  // 관리자일 경우 Service Role Client를 사용하여 모든 사용자 조회
  const client = isAdmin ? createServiceClient() : await createClient();

  const { data: users, error } = await client
    .from('users')
    .select('*')
    .eq('organization_id', user.organizationId)
    .order('created_at', { ascending: false });

  return (
    <TeamClient 
      users={users || []}
      error={error?.message}
      isAdmin={isAdmin}
    />
  );
}
