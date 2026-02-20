/**
 * 더미 데이터 생성 스크립트 (개선 버전)
 * 
 * 사용법:
 * npx tsx scripts/seed-dummy-data.ts
 * 
 * 또는:
 * npm run seed
 * 
 * 이 스크립트는 모든 테이블에 현실적인 더미 데이터를 생성합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드 (.env와 .env.local 모두 시도)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 더미 데이터 상수
const dummyOrganizations = [
  { name: 'VNTG Tech' },
  { name: '스타트업 A' },
];

const dummyJobTitles = [
  'Senior Product Designer',
  'Product Manager',
  'UX Researcher',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Engineer',
  'DevOps Engineer',
  'Mobile Developer',
  'QA Engineer',
];

const dummyNames = [
  'Sarah Kim', 'James Lee', 'Emma Park', 'Michael Choi',
  'Lisa Jung', 'David Kim', 'Sophia Park', 'Daniel Lee',
  'Olivia Kim', 'Ryan Park', 'Grace Lee', 'Kevin Choi',
  'Amy Yoon', 'Tom Kim', 'Jessica Park', 'Chris Lee',
  'Maria Kim', 'John Park', 'Emily Choi', 'Alex Lee',
];

const dummyEmails = [
  'sarah.kim@example.com', 'james.lee@example.com', 'emma.park@example.com',
  'michael.choi@example.com', 'lisa.jung@example.com', 'david.kim@example.com',
];

const dummyProcessStages = [
  { id: 'stage-1', name: 'New Application', order: 1, interviewers: [] },
  { id: 'stage-2', name: 'HR Screening', order: 2, interviewers: [] },
  { id: 'stage-3', name: 'Application Review', order: 3, interviewers: [] },
  { id: 'stage-4', name: 'Competency Assessment', order: 4, interviewers: [] },
  { id: 'stage-5', name: 'Technical Test', order: 5, interviewers: [] },
  { id: 'stage-6', name: '1st Interview', order: 6, interviewers: [] },
  { id: 'stage-7', name: 'Reference Check', order: 7, interviewers: [] },
  { id: 'stage-8', name: '2nd Interview', order: 8, interviewers: [] },
];

const dummyBeverages = ['coffee', 'tea', 'water', 'juice', 'none'];

const eventTypes = [
  'system_log',
  'schedule_created',
  'schedule_confirmed',
  'stage_changed',
] as const;

// 랜덤 전화번호 생성
function generatePhone(): string {
  const middle = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const last = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `010-${middle}-${last}`;
}

// 랜덤 날짜 생성 (과거 N일 전)
function randomPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return date;
}

// 랜덤 미래 날짜 생성 (N일 후)
function randomFutureDate(daysLater: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysLater);
  date.setHours(10 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
  return date;
}

async function seedDummyData() {
  console.log('🌱 더미 데이터 생성 시작...\n');

  try {
    // 1. 조직 생성
    console.log('1️⃣ 조직 생성 중...');
    let organizationId: string;
    
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', dummyOrganizations[0].name)
      .single();

    if (existingOrg) {
      console.log('✅ 조직이 이미 존재합니다.');
      organizationId = existingOrg.id;
    } else {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert(dummyOrganizations[0])
        .select()
        .single();

      if (orgError) {
        throw orgError;
      }
      console.log('✅ 조직 생성 완료');
      organizationId = org.id;
    }

    // 2. 사용자 생성 (테스트용 - 실제로는 auth.users에 먼저 생성해야 함)
    // 여기서는 users 테이블에 직접 삽입하지 않고, 기존 사용자가 있다고 가정합니다.
    console.log('\n2️⃣ 사용자 확인 중...');
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('organization_id', organizationId)
      .limit(5);

    let userIds: string[] = [];
    if (existingUsers && existingUsers.length > 0) {
      userIds = existingUsers.map(u => u.id);
      console.log(`✅ 기존 사용자 ${userIds.length}명 사용`);
    } else {
      console.log('⚠️  사용자가 없습니다. auth.users에 먼저 사용자를 생성해주세요.');
      console.log('   더미 데이터 생성을 계속하지만, created_by 필드는 null로 설정됩니다.');
    }

    // 3. 프로세스 생성
    console.log('\n3️⃣ 채용 프로세스 생성 중...');
    let processId: string;
    
    const { data: existingProcess } = await supabase
      .from('processes')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', '기본 채용 프로세스')
      .single();

    if (existingProcess) {
      console.log('✅ 프로세스가 이미 존재합니다.');
      processId = existingProcess.id;
    } else {
      const { data: process, error: processError } = await supabase
        .from('processes')
        .insert({
          organization_id: organizationId,
          name: '기본 채용 프로세스',
          stages: dummyProcessStages,
        })
        .select()
        .single();

      if (processError) {
        throw processError;
      }
      console.log('✅ 프로세스 생성 완료');
      processId = process.id;
    }

    // 4. 채용 공고 생성
    console.log('\n4️⃣ 채용 공고 생성 중...');
    const jobPosts = [];
    const jobPostCount = 8;
    
    for (let i = 0; i < jobPostCount; i++) {
      const { data: jobPost, error: jobError } = await supabase
        .from('job_posts')
        .insert({
          organization_id: organizationId,
          title: dummyJobTitles[i % dummyJobTitles.length],
          description: `${dummyJobTitles[i % dummyJobTitles.length]} 포지션에 대한 상세 설명입니다.\n\n주요 업무:\n- 관련 업무 수행\n- 팀과의 협업\n- 프로젝트 관리\n\n자격 요건:\n- 관련 경력 3년 이상\n- 협업 능력\n- 문제 해결 능력`,
          process_id: processId,
        })
        .select()
        .single();

      if (!jobError && jobPost) {
        jobPosts.push(jobPost);
      }
    }
    console.log(`✅ ${jobPosts.length}개의 채용 공고 생성 완료`);

    // 5. 후보자 생성
    console.log('\n5️⃣ 후보자 생성 중...');
    const candidates = [];
    const candidateCount = 30;
    const statuses: Array<'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'> = 
      ['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
    
    for (let i = 0; i < candidateCount; i++) {
      const jobPost = jobPosts[i % jobPosts.length];
      const status = statuses[i % statuses.length];
      // 8단계에 걸쳐 분산 (30명 / 8단계 = 약 4명씩)
      const stageIndex = Math.min(Math.floor(i / 4), dummyProcessStages.length - 1);
      const stageId = dummyProcessStages[stageIndex].id;
      
      const matchScore = 70 + Math.floor(Math.random() * 30); // 70-100
      const createdAt = randomPastDate(30 - (i % 30));
      
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          job_post_id: jobPost.id,
          name: dummyNames[i % dummyNames.length],
          email: `candidate${i + 1}@example.com`,
          phone: generatePhone(),
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
        .select()
        .single();

      if (!candidateError && candidate) {
        candidates.push(candidate);
      }
    }
    console.log(`✅ ${candidates.length}명의 후보자 생성 완료`);

    // 6. 면접 일정 생성
    console.log('\n6️⃣ 면접 일정 생성 중...');
    const schedules = [];
    const scheduleCount = 15;
    
    for (let i = 0; i < scheduleCount; i++) {
      const candidate = candidates[i % candidates.length];
      const scheduledAt = randomFutureDate(Math.floor(Math.random() * 14) + 1);
      const statuses: Array<'pending' | 'confirmed' | 'rejected' | 'completed'> = 
        ['pending', 'confirmed', 'rejected', 'completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const responses: Array<'accepted' | 'rejected' | 'pending'> = 
        ['accepted', 'rejected', 'pending'];
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      // 면접관 선택 (userIds가 있으면 사용, 없으면 빈 배열)
      const interviewerIds = userIds.length > 0 
        ? [userIds[Math.floor(Math.random() * userIds.length)]]
        : [];

      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .insert({
          candidate_id: candidate.id,
          stage_id: dummyProcessStages[Math.floor(Math.random() * 4) + 1].id, // stage-2 ~ stage-6
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: [30, 60, 90][Math.floor(Math.random() * 3)],
          status: status,
          interviewer_ids: interviewerIds,
          candidate_response: response,
          beverage_preference: dummyBeverages[Math.floor(Math.random() * dummyBeverages.length)],
        })
        .select()
        .single();

      if (!scheduleError && schedule) {
        schedules.push(schedule);
      }
    }
    console.log(`✅ ${schedules.length}개의 면접 일정 생성 완료`);

    // 7. 타임라인 이벤트 생성
    console.log('\n7️⃣ 타임라인 이벤트 생성 중...');
    let eventCount = 0;
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const eventsPerCandidate = 3 + Math.floor(Math.random() * 4); // 3-6개
      
      for (let j = 0; j < eventsPerCandidate; j++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const createdAt = randomPastDate(30 - (i * 2 + j));
        const createdBy = userIds.length > 0 && Math.random() > 0.3 
          ? userIds[Math.floor(Math.random() * userIds.length)]
          : null;

        let content: any = {
          message: `${eventType} 이벤트가 발생했습니다.`,
        };

        // 이벤트 타입별 특별한 내용 추가
        if (eventType === 'schedule_created' && schedules.length > 0) {
          const schedule = schedules[Math.floor(Math.random() * schedules.length)];
          content.schedule_id = schedule.id;
          content.scheduled_at = schedule.scheduled_at;
        } else if (eventType === 'stage_changed') {
          const prevStage = dummyProcessStages[Math.floor(Math.random() * dummyProcessStages.length)];
          const newStage = dummyProcessStages[Math.floor(Math.random() * dummyProcessStages.length)];
          content.previous_stage = prevStage.name;
          content.new_stage = newStage.name;
        }

        const { error: eventError } = await supabase
          .from('timeline_events')
          .insert({
            candidate_id: candidate.id,
            type: eventType,
            content: content,
            created_by: createdBy,
            created_at: createdAt.toISOString(),
          });

        if (!eventError) {
          eventCount++;
        }
      }
    }
    console.log(`✅ ${eventCount}개의 타임라인 이벤트 생성 완료`);

    // 8. Schedule Options 생성 (AI 생성 일정 옵션)
    console.log('\n8️⃣ 면접 일정 옵션 생성 중...');
    let optionCount = 0;
    
    for (let i = 0; i < Math.min(5, schedules.length); i++) {
      const schedule = schedules[i];
      const optionCountPerSchedule = 3;
      
      for (let j = 0; j < optionCountPerSchedule; j++) {
        const optionTime = new Date(schedule.scheduled_at);
        optionTime.setHours(optionTime.getHours() + (j * 2) - 2);
        
        const { error: optionError } = await supabase
          .from('schedule_options')
          .insert({
            schedule_id: schedule.id,
            scheduled_at: optionTime.toISOString(),
            status: j === 1 ? 'selected' : 'pending', // 두 번째 옵션을 선택된 것으로 설정
          });

        if (!optionError) {
          optionCount++;
        }
      }
    }
    console.log(`✅ ${optionCount}개의 면접 일정 옵션 생성 완료`);

    // 최종 요약
    console.log('\n✨ 더미 데이터 생성 완료!');
    console.log(`\n📊 생성된 데이터 요약:`);
    console.log(`   - 조직: 1개`);
    console.log(`   - 채용 공고: ${jobPosts.length}개`);
    console.log(`   - 후보자: ${candidates.length}명`);
    console.log(`   - 면접 일정: ${schedules.length}개`);
    console.log(`   - 면접 일정 옵션: ${optionCount}개`);
    console.log(`   - 타임라인 이벤트: ${eventCount}개`);
    console.log(`\n💡 팁: 더 많은 데이터를 생성하려면 스크립트의 candidateCount, scheduleCount 등을 조정하세요.`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    if (error instanceof Error) {
      console.error('   메시지:', error.message);
    }
    process.exit(1);
  }
}

// 실행
seedDummyData();
