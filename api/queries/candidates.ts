'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess, verifyJobPostAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { getStageNameByStageId } from '@/constants/stages';
import { formatInTimeZone } from 'date-fns-tz';
import type { Candidate } from '@/types/candidates';

type CandidateListRow = Candidate & {
  // Supabase join 결과가 배열로 내려오는 경우가 있어 정규화가 필요합니다.
  job_posts?: Candidate['job_posts'] | Array<Candidate['job_posts']>;
};

type ConfirmedScheduleRow = {
  candidate_id: string;
  stage_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
};

/**
 * 현재 조직의 모든 후보자 조회
 * 관리자일 경우 모든 조직의 후보자를 조회하고, 일반 사용자는 자신의 조직 후보자만 조회합니다.
 * @param jobPostId 특정 채용 공고의 후보자만 조회 (선택)
 * @returns 후보자 목록
 */
export async function getCandidates(jobPostId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return [];
    }

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // job_post_id 필터링 및 후보자 조회
    // - 목록 테이블에서 필요한 필드만 선택해 페이로드를 줄입니다.
    // - 기본적으로 아카이브되지 않은 후보자만 조회합니다.
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        id,
        name,
        email,
        phone,
        status,
        current_stage_id,
        job_post_id,
        ai_score,
        total_experience_months,
        experience,
        parsed_data,
        created_at,
        job_posts (
          id,
          title,
          organization_id,
          process_id,
          processes (
            id,
            name,
            stages
          )
        )
      `)
      .in('job_post_id', jobPostIds)
      .eq('archived', false) // 아카이브되지 않은 후보자만 조회
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    // ✅ Supabase join 결과가 job_posts를 배열로 내려주는 경우가 있어,
    // UI에서 항상 "단일 객체"로 다룰 수 있게 여기서 정규화합니다.
    // ✅ Supabase 반환 타입이 상황에 따라 더 넓게 추론되어, 직접 캐스팅이 빌드(TypeScript)에서 실패할 수 있습니다.
    // 따라서 unknown을 한 번 거쳐 “정규화 로직” 기준으로 안전하게 단언합니다.
    const normalized: Candidate[] =
      ((data || []) as unknown as CandidateListRow[]).map((row) => {
        const jp = row?.job_posts;
        return {
          ...row,
          job_posts: Array.isArray(jp) ? jp[0] : jp,
        } as Candidate;
      }) || [];

    // ✅ 후보자 목록 파이프라인(확정 체크 노드/툴팁)용 confirmed 스케줄 매핑
    // - 규칙: “가장 가까운 미래 confirmed 1개”, 없으면 “가장 최근 confirmed 1개”
    const candidateIds = normalized.map((c) => String(c?.id ?? '')).filter(Boolean);
    if (candidateIds.length === 0) return normalized;

    const { data: confirmedSchedules, error: confirmedError } = await supabase
      .from('schedules')
      .select('candidate_id, stage_id, scheduled_at, duration_minutes')
      .in('candidate_id', candidateIds)
      .eq('workflow_status', 'confirmed');

    // 스케줄 조회 실패는 치명적이지 않으므로, 후보자 목록은 그대로 반환합니다.
    if (confirmedError || !confirmedSchedules || confirmedSchedules.length === 0) {
      return normalized.map((c) => ({ ...c, confirmed_schedule: null }));
    }

    const KST_TZ = 'Asia/Seoul';
    const nowKstYmdHm = formatInTimeZone(new Date(), KST_TZ, 'yyyy-MM-dd HH:mm');

    const toKstComparable = (iso: string) => formatInTimeZone(iso, KST_TZ, 'yyyy-MM-dd HH:mm');

    const safeConfirmed = (confirmedSchedules as unknown as ConfirmedScheduleRow[]) || [];
    const byCandidate = new Map<string, ConfirmedScheduleRow[]>();
    for (const s of safeConfirmed) {
      const cid = String(s?.candidate_id ?? '');
      if (!cid) continue;
      const list = byCandidate.get(cid) || [];
      list.push(s);
      byCandidate.set(cid, list);
    }

    const pickOne = (list: ConfirmedScheduleRow[]) => {
      const safe = Array.isArray(list) ? list.filter(Boolean) : [];
      if (safe.length === 0) return null;

      const future = safe
        .filter((s) => {
          const at = String(s?.scheduled_at ?? '');
          if (!at) return false;
          return toKstComparable(at) >= nowKstYmdHm;
        })
        .sort((a, b) => {
          const aAt = toKstComparable(String(a?.scheduled_at ?? ''));
          const bAt = toKstComparable(String(b?.scheduled_at ?? ''));
          return aAt.localeCompare(bAt);
        });

      if (future.length > 0) return future[0];

      // 미래가 없으면 “가장 최근(최신) 확정”을 선택
      const pastOrAny = safe.sort((a, b) => {
        const aAt = toKstComparable(String(a?.scheduled_at ?? ''));
        const bAt = toKstComparable(String(b?.scheduled_at ?? ''));
        return bAt.localeCompare(aAt);
      });
      return pastOrAny[0] || null;
    };

    return normalized.map((c) => {
      const cid = String(c?.id ?? '');
      const list = byCandidate.get(cid) || [];
      const pick = pickOne(list);
      return {
        ...c,
        confirmed_schedule: pick
          ? {
              stage_id: String(pick.stage_id),
              scheduled_at: String(pick.scheduled_at),
              duration_minutes:
                typeof pick.duration_minutes === 'number' ? pick.duration_minutes : null,
            }
          : null,
      };
    });
  });
}

/**
 * 특정 후보자 상세 정보 조회
 * @param id 후보자 ID
 * @returns 후보자 상세 정보
 */
export async function getCandidateById(id: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(id);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title,
          description,
          process_id,
          processes (
            id,
            name,
            stages
          )
        )
      `)
      .eq('id', id)
      .single();

    // ai_summary, current_salary, expected_salary 필드는 자동으로 포함됨 (SELECT * 사용)

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    // current_stage_id가 null인 경우 기본값 설정 (New Application)
    if (data && !data.current_stage_id) {
      data.current_stage_id = 'stage-1';
    }

    return data;
  });
}

/**
 * 특정 채용 공고의 후보자 목록 조회 (상태별 필터링 가능)
 * @param jobPostId 채용 공고 ID
 * @param status 상태 필터 (선택)
 * @returns 후보자 목록
 */
export async function getCandidatesByJobPost(
  jobPostId: string,
  status?: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
) {
  return withErrorHandling(async () => {
    // job_post 접근 권한 확인
    await verifyJobPostAccess(jobPostId);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let query = supabase
      .from('candidates')
      .select('*')
      .eq('job_post_id', jobPostId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 단계별 후보자 수 조회
 * @returns 단계별 후보자 수
 */
export async function getCandidatesByStage() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return {};
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 모든 후보자 조회 (current_stage_id 포함, 아카이브되지 않은 후보자만)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('current_stage_id')
      .in('job_post_id', jobPostIds)
      .eq('archived', false); // 아카이브되지 않은 후보자만 조회

    // 단계별 카운트 (current_stage_id를 단계 이름으로 매핑)
    const byStage: Record<string, number> = {};
    
    // 단계 이름 목록 (사용자가 정의한 단계)
    const stageNames = [
      'New Application',
      'HR Screening',
      'Application Review',
      'Competency Assessment',
      'Technical Test',
      '1st Interview',
      'Reference Check',
      '2nd Interview',
      'Offer',
    ];

    // 각 단계별로 초기값 설정
    stageNames.forEach(stageName => {
      byStage[stageName] = 0;
    });

    candidates?.forEach(candidate => {
      // current_stage_id는 process의 stage ID("stage-1", "stage-2" 등)이므로
      // 매핑 상수를 사용하여 단계 이름으로 변환
      const stageName = getStageNameByStageId(candidate.current_stage_id) || 'New Application';
      
      // stageName이 정의된 단계 목록에 포함되어 있으면 카운트 증가
      if (stageNames.includes(stageName)) {
        byStage[stageName] = (byStage[stageName] || 0) + 1;
      } else {
        // 정의되지 않은 단계는 'New Application'으로 카운트
        byStage['New Application'] = (byStage['New Application'] || 0) + 1;
      }
    });

    return byStage;
  });
}

/**
 * 아카이브된 후보자의 단계별 수 조회
 * @returns 아카이브된 후보자의 단계별 수
 */
export async function getArchivedCandidatesByStage() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return {};
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 아카이브된 후보자만 조회 (current_stage_id 포함)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('current_stage_id')
      .in('job_post_id', jobPostIds)
      .eq('archived', true); // 아카이브된 후보자만 조회

    // 단계별 카운트 (current_stage_id를 단계 이름으로 매핑)
    const byStage: Record<string, number> = {};
    
    // 단계 이름 목록 (사용자가 정의한 단계)
    const stageNames = [
      'New Application',
      'HR Screening',
      'Application Review',
      'Competency Assessment',
      'Technical Test',
      '1st Interview',
      'Reference Check',
      '2nd Interview',
      'Offer',
    ];

    // 각 단계별로 초기값 설정
    stageNames.forEach(stageName => {
      byStage[stageName] = 0;
    });

    candidates?.forEach(candidate => {
      // current_stage_id는 process의 stage ID("stage-1", "stage-2" 등)이므로
      // 매핑 상수를 사용하여 단계 이름으로 변환
      const stageName = getStageNameByStageId(candidate.current_stage_id) || 'New Application';
      
      // stageName이 정의된 단계 목록에 포함되어 있으면 카운트 증가
      if (stageNames.includes(stageName)) {
        byStage[stageName] = (byStage[stageName] || 0) + 1;
      } else {
        // 정의되지 않은 단계는 'New Application'으로 카운트
        byStage['New Application'] = (byStage['New Application'] || 0) + 1;
      }
    });

    return byStage;
  });
}

/**
 * 후보자 통계 조회
 * @param jobPostId 채용 공고 ID (선택, 없으면 전체)
 * @returns 후보자 통계
 */
export async function getCandidateStats(jobPostId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return {
        total: 0,
        pending: 0,
        in_progress: 0,
        confirmed: 0,
        rejected: 0,
        issue: 0,
      };
    }

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // 상태별 카운트
    const statuses = ['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const status of statuses) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds)
        .eq('status', status);

      byStatus[status] = count || 0;
      total += count || 0;
    }

    // 단계별 카운트 (current_stage_id 기준)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('current_stage_id')
      .in('job_post_id', jobPostIds);

    const byStage: Record<string, number> = {};
    candidates?.forEach(candidate => {
      const stageId = candidate.current_stage_id || 'unknown';
      byStage[stageId] = (byStage[stageId] || 0) + 1;
    });

    return {
      total,
      byStatus,
      byStage,
    };
  });
}

/**
 * 아카이브된 후보자 조회
 * @param jobPostId 특정 채용 공고의 후보자만 조회 (선택)
 * @returns 아카이브된 후보자 목록
 */
export async function getArchivedCandidates(jobPostId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return [];
    }

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // 아카이브된 후보자만 조회
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title,
          organization_id,
          process_id,
          processes (
            id,
            name,
            stages
          )
        )
      `)
      .in('job_post_id', jobPostIds)
      .eq('archived', true) // 아카이브된 후보자만 조회
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`아카이브된 후보자 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 입사확정된 후보자 조회 (offers 테이블에서 offer_status='accepted'인 후보자)
 * @param jobPostId 특정 채용 공고의 후보자만 조회 (선택)
 * @returns 입사확정된 후보자 목록
 */
export async function getConfirmedCandidates(jobPostId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return [];
    }

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // 1단계: offers 테이블에서 offer_status='accepted'인 candidate_id 목록 조회
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('candidate_id')
      .eq('offer_status', 'accepted');

    if (offersError) {
      throw new Error(`입사확정 후보자 조회 실패: ${offersError.message}`);
    }

    if (!offers || offers.length === 0) {
      return [];
    }

    const candidateIds = offers.map(offer => offer.candidate_id).filter(Boolean);

    if (candidateIds.length === 0) {
      return [];
    }

    // 2단계: candidates 테이블에서 해당 candidate_id들로 조회
    const { data: confirmedCandidates, error: candidatesError } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts!inner (
          id,
          title,
          organization_id,
          process_id,
          processes (
            id,
            name,
            stages
          )
        )
      `)
      .in('id', candidateIds)
      .in('job_post_id', jobPostIds)
      .eq('archived', false); // 아카이브되지 않은 후보자만

    if (candidatesError) {
      throw new Error(`입사확정 후보자 조회 실패: ${candidatesError.message}`);
    }

    return confirmedCandidates || [];
  });
}
