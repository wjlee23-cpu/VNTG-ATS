/**
 * 특정 후보자의 타임라인 이벤트 확인 스크립트
 * 사용법: npx tsx scripts/check-candidate-timeline.ts <candidate_id>
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const candidateId = process.argv[2];

if (!databaseUrl) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

if (!candidateId) {
  console.error('❌ 후보자 ID를 입력하세요.');
  console.error('사용법: npx tsx scripts/check-candidate-timeline.ts <candidate_id>');
  process.exit(1);
}

async function checkCandidateTimeline() {
  console.log(`🔍 후보자 ${candidateId}의 타임라인 이벤트 확인 중...\n`);

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

    // 후보자 존재 확인
    const { rows: candidateRows } = await client.query(`
      SELECT id, name, email FROM candidates WHERE id = $1;
    `, [candidateId]);

    if (candidateRows.length === 0) {
      console.log(`❌ 후보자를 찾을 수 없습니다: ${candidateId}\n`);
      await client.end();
      process.exit(1);
    }

    const candidate = candidateRows[0];
    console.log(`👤 후보자: ${candidate.name} (${candidate.email})\n`);

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
    `, [candidateId]);

    console.log(`📊 타임라인 이벤트 개수: ${timelineRows.length}\n`);

    if (timelineRows.length === 0) {
      console.log('⚠️  타임라인 이벤트가 없습니다.\n');
      
      // 최근 일정 확인
      const { rows: scheduleRows } = await client.query(`
        SELECT id, workflow_status, created_at
        FROM schedules
        WHERE candidate_id = $1
        ORDER BY created_at DESC
        LIMIT 5;
      `, [candidateId]);

      if (scheduleRows.length > 0) {
        console.log(`📅 최근 일정 ${scheduleRows.length}개 발견:\n`);
        scheduleRows.forEach((schedule: any) => {
          console.log(`   - 일정 ID: ${schedule.id}`);
          console.log(`     상태: ${schedule.workflow_status}`);
          console.log(`     생성일: ${schedule.created_at}`);
        });
        console.log('\n💡 일정이 있지만 타임라인 이벤트가 없는 경우, 타임라인 이벤트 생성에 문제가 있을 수 있습니다.\n');
      }
    } else {
      console.log(`📋 타임라인 이벤트 목록:\n`);
      timelineRows.forEach((row: any, index: number) => {
        console.log(`${index + 1}. [${row.type}] ${row.created_at}`);
        const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        if (content?.message) {
          console.log(`   메시지: ${content.message}`);
        }
        console.log('');
      });
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ 확인 중 오류 발생:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

checkCandidateTimeline().catch(console.error);
