/**
 * 이름으로 후보자 찾기 및 타임라인 확인 스크립트
 * 사용법: npx tsx scripts/find-candidate-by-name.ts "조성민"
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
// 기본값으로 조성민 사용
const candidateName = process.argv[2] || process.env.CANDIDATE_NAME || '조성민';

if (!databaseUrl) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

async function findCandidateAndCheckTimeline() {
  console.log(`🔍 후보자 "${candidateName}" 찾는 중...\n`);

  // DATABASE_URL 파싱
  const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = databaseUrl.match(urlPattern);
  
  if (!match) {
    console.error('❌ DATABASE_URL 형식이 올바르지 않습니다.');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;
  const encodedPassword = encodeURIComponent(password);
  const connectionString = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공!\n');

    // 후보자 찾기 (이름으로 검색)
    const { rows: candidateRows } = await client.query(`
      SELECT 
        id, 
        name, 
        email,
        phone,
        job_post_id,
        current_stage_id,
        created_at
      FROM candidates 
      WHERE name ILIKE $1
      ORDER BY created_at DESC;
    `, [`%${candidateName}%`]);

    if (candidateRows.length === 0) {
      console.log(`❌ 후보자를 찾을 수 없습니다: ${candidateName}\n`);
      await client.end();
      process.exit(1);
    }

    console.log(`👤 찾은 후보자 ${candidateRows.length}명:\n`);
    
    for (const candidate of candidateRows) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`이름: ${candidate.name}`);
      console.log(`이메일: ${candidate.email}`);
      console.log(`전화번호: ${candidate.phone || 'N/A'}`);
      console.log(`ID: ${candidate.id}`);
      console.log(`생성일: ${candidate.created_at}`);
      console.log(`현재 단계: ${candidate.current_stage_id || 'N/A'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // 타임라인 이벤트 조회
      const { rows: timelineRows } = await client.query(`
        SELECT 
          id,
          type,
          content,
          created_at,
          created_by
        FROM timeline_events
        WHERE candidate_id = $1
        ORDER BY created_at DESC
        LIMIT 50;
      `, [candidate.id]);

      console.log(`📊 타임라인 이벤트 개수: ${timelineRows.length}\n`);

      if (timelineRows.length === 0) {
        console.log('⚠️  타임라인 이벤트가 없습니다.\n');
        
        // 최근 일정 확인
        const { rows: scheduleRows } = await client.query(`
          SELECT 
            id, 
            workflow_status, 
            status,
            scheduled_at,
            created_at,
            interviewer_ids
          FROM schedules
          WHERE candidate_id = $1
          ORDER BY created_at DESC
          LIMIT 5;
        `, [candidate.id]);

        if (scheduleRows.length > 0) {
          console.log(`📅 최근 일정 ${scheduleRows.length}개 발견:\n`);
          scheduleRows.forEach((schedule: any) => {
            console.log(`   - 일정 ID: ${schedule.id}`);
            console.log(`     상태: ${schedule.status}`);
            console.log(`     워크플로우 상태: ${schedule.workflow_status}`);
            console.log(`     예정일시: ${schedule.scheduled_at || 'N/A'}`);
            console.log(`     생성일: ${schedule.created_at}`);
            console.log(`     면접관 수: ${schedule.interviewer_ids?.length || 0}명`);
            console.log('');
          });
          console.log('💡 일정이 있지만 타임라인 이벤트가 없는 경우, 타임라인 이벤트 생성에 문제가 있을 수 있습니다.\n');
        } else {
          console.log('📅 일정이 없습니다.\n');
        }

        // 일정 옵션 확인
        if (scheduleRows.length > 0) {
          for (const schedule of scheduleRows) {
            const { rows: optionRows } = await client.query(`
              SELECT 
                id,
                scheduled_at,
                status,
                interviewer_responses,
                created_at
              FROM schedule_options
              WHERE schedule_id = $1
              ORDER BY created_at DESC;
            `, [schedule.id]);

            if (optionRows.length > 0) {
              console.log(`   📋 일정 옵션 ${optionRows.length}개:\n`);
              optionRows.forEach((option: any) => {
                console.log(`      - 옵션 ID: ${option.id}`);
                console.log(`        예정일시: ${option.scheduled_at}`);
                console.log(`        상태: ${option.status}`);
                console.log(`        면접관 응답: ${JSON.stringify(option.interviewer_responses || {})}`);
                console.log(`        생성일: ${option.created_at}`);
                console.log('');
              });
            }
          }
        }
      } else {
        console.log(`📋 타임라인 이벤트 목록:\n`);
        timelineRows.forEach((row: any, index: number) => {
          console.log(`${index + 1}. [${row.type}] ${row.created_at}`);
          const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
          if (content?.message) {
            console.log(`   메시지: ${content.message}`);
          }
          console.log(`   created_by: ${row.created_by || 'null'}`);
          console.log('');
        });
      }

      console.log('');
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ 확인 중 오류 발생:', error.message);
    console.error(error);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

findCandidateAndCheckTimeline().catch(console.error);
