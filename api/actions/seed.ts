'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, requireAdmin } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';
import { revalidatePath } from 'next/cache';

/**
 * 더미 데이터 생성 (관리자 전용)
 * 조직, 프로세스, 채용 공고, 후보자, 면접 일정 등을 생성합니다.
 */
export async function seedDummyData() {
  return withErrorHandling(async () => {
    // 관리자 권한 확인
    const user = await requireAdmin();
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // 더미 데이터 상수
    const dummyJobTitles = [
      'Senior Product Designer',
      'Product Manager',
      'UX Researcher',
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Developer',
      'Data Engineer',
      'DevOps Engineer',
    ];

    const dummyNames = [
      'Sarah Kim', 'James Lee', 'Emma Park', 'Michael Choi', 'Lisa Jung',
      'David Kim', 'Sophia Park', 'Daniel Lee', 'Olivia Kim', 'Ryan Park',
      'Grace Lee', 'Kevin Choi', 'Amy Yoon', 'Tom Kim', 'Jessica Park',
      'Chris Lee', 'Maria Kim', 'John Park', 'Emily Choi', 'Alex Lee',
    ];

    const dummyProcessStages = [
      { id: 'stage-1', name: '서류 전형', order: 1, interviewers: [] },
      { id: 'stage-2', name: '1차 면접', order: 2, interviewers: [] },
      { id: 'stage-3', name: '2차 면접', order: 3, interviewers: [] },
      { id: 'stage-4', name: '최종 면접', order: 4, interviewers: [] },
      { id: 'stage-5', name: '최종 합격', order: 5, interviewers: [] },
    ];

    // 1. 조직 확인 또는 생성
    let organizationId = user.organizationId;
    
    const { data: org } = await serviceClient
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single();

    if (!org) {
      throw new Error('조직을 찾을 수 없습니다.');
    }

    // 2. 프로세스 확인 또는 생성
    let { data: existingProcess } = await serviceClient
      .from('processes')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', '기본 채용 프로세스')
      .maybeSingle();

    let processId: string;
    if (existingProcess) {
      processId = existingProcess.id;
    } else {
      const { data: process, error: processError } = await serviceClient
        .from('processes')
        .insert({
          organization_id: organizationId,
          name: '기본 채용 프로세스',
          stages: dummyProcessStages,
        })
        .select('id')
        .single();

      if (processError || !process) {
        throw new Error(`프로세스 생성 실패: ${processError?.message || '알 수 없는 오류'}`);
      }
      processId = process.id;
    }

    // 3. 채용 공고 생성 (8개)
    const jobPosts = [];
    for (let i = 0; i < 8; i++) {
      const { data: jobPost, error: jobError } = await serviceClient
        .from('job_posts')
        .insert({
          organization_id: organizationId,
          title: dummyJobTitles[i],
          description: `${dummyJobTitles[i]} 포지션에 대한 상세 설명입니다.\n\n주요 업무:\n- 관련 업무 수행\n- 팀과의 협업\n- 프로젝트 관리\n\n자격 요건:\n- 관련 경력 3년 이상\n- 협업 능력\n- 문제 해결 능력`,
          process_id: processId,
        })
        .select('id')
        .single();

      if (!jobError && jobPost) {
        jobPosts.push(jobPost);
      }
    }

    if (jobPosts.length === 0) {
      throw new Error('채용 공고 생성에 실패했습니다.');
    }

    // 4. 후보자 생성 (30명)
    const candidates = [];
    const statuses: Array<'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'> = 
      ['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
    
    for (let i = 0; i < 30; i++) {
      const jobPost = jobPosts[i % jobPosts.length];
      const status = statuses[i % statuses.length];
      const stageIndex = Math.min(Math.floor(i / 6), dummyProcessStages.length - 1);
      const stageId = dummyProcessStages[stageIndex].id;
      
      const matchScore = 70 + Math.floor(Math.random() * 30);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (30 - (i % 30)));

      const { data: candidate, error: candidateError } = await serviceClient
        .from('candidates')
        .insert({
          job_post_id: jobPost.id,
          name: dummyNames[i % dummyNames.length],
          email: `candidate${i + 1}@example.com`,
          phone: `010-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          status: status,
          current_stage_id: stageId,
          token: crypto.randomUUID(),
          parsed_data: {
            match_score: matchScore,
            skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'].slice(0, Math.floor(Math.random() * 4) + 1),
            experience: `${Math.floor(Math.random() * 5) + 2}년`,
            education: ['학사', '석사'][Math.floor(Math.random() * 2)],
          },
          created_at: createdAt.toISOString(),
        })
        .select('id')
        .single();

      if (!candidateError && candidate) {
        candidates.push(candidate);
      }
    }

    // 5. 면접 일정 생성 (15개)
    const schedules = [];
    const scheduleStatuses: Array<'pending' | 'confirmed' | 'rejected' | 'completed'> = 
      ['pending', 'confirmed', 'rejected', 'completed'];
    const responses: Array<'accepted' | 'rejected' | 'pending'> = 
      ['accepted', 'rejected', 'pending'];
    
    for (let i = 0; i < 15; i++) {
      const candidate = candidates[i % candidates.length];
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + Math.floor(Math.random() * 14) + 1);
      scheduledAt.setHours(10 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);

      const { data: schedule, error: scheduleError } = await serviceClient
        .from('schedules')
        .insert({
          candidate_id: candidate.id,
          stage_id: dummyProcessStages[Math.floor(Math.random() * 3) + 1].id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: [30, 60, 90][Math.floor(Math.random() * 3)],
          status: scheduleStatuses[Math.floor(Math.random() * scheduleStatuses.length)],
          interviewer_ids: [],
          candidate_response: responses[Math.floor(Math.random() * responses.length)],
          beverage_preference: ['coffee', 'tea', 'water', 'juice', 'none'][Math.floor(Math.random() * 5)],
        })
        .select('id')
        .single();

      if (!scheduleError && schedule) {
        schedules.push(schedule);
      }
    }

    // 캐시 무효화
    revalidatePath('/dashboard');

    return {
      organizations: 1,
      processes: 1,
      jobPosts: jobPosts.length,
      candidates: candidates.length,
      schedules: schedules.length,
    };
  });
}
