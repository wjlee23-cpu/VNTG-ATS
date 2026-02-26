/**
 * 타임라인 이벤트 확인 스크립트
 * 특정 후보자의 타임라인 이벤트를 확인
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

async function checkTimelineEvents() {
  console.log('🔍 타임라인 이벤트 확인 중...\n');

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

    // 1. 전체 타임라인 이벤트 개수 확인
    const { rows: countRows } = await client.query(`
      SELECT COUNT(*) as count FROM timeline_events;
    `);
    console.log(`📊 전체 타임라인 이벤트 개수: ${countRows[0].count}\n`);

    // 2. 최근 타임라인 이벤트 10개 조회
    const { rows: recentRows } = await client.query(`
      SELECT 
        id,
        candidate_id,
        type,
        content,
        created_at,
        created_by
      FROM timeline_events
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    if (recentRows.length === 0) {
      console.log('⚠️  타임라인 이벤트가 하나도 없습니다.\n');
    } else {
      console.log(`📋 최근 타임라인 이벤트 ${recentRows.length}개:\n`);
      recentRows.forEach((row: any, index: number) => {
        console.log(`${index + 1}. [${row.type}] ${row.candidate_id}`);
        console.log(`   생성일: ${row.created_at}`);
        console.log(`   내용: ${JSON.stringify(row.content).substring(0, 100)}...`);
        console.log('');
      });
    }

    // 3. schedule_created 타입 이벤트 확인
    const { rows: scheduleCreatedRows } = await client.query(`
      SELECT COUNT(*) as count FROM timeline_events WHERE type = 'schedule_created';
    `);
    console.log(`📅 schedule_created 타입 이벤트: ${scheduleCreatedRows[0].count}개\n`);

    // 4. interviewer_response 타입 이벤트 확인
    const { rows: interviewerResponseRows } = await client.query(`
      SELECT COUNT(*) as count FROM timeline_events WHERE type = 'interviewer_response';
    `);
    console.log(`💬 interviewer_response 타입 이벤트: ${interviewerResponseRows[0].count}개\n`);

    // 5. 최근 생성된 schedules 확인
    const { rows: scheduleRows } = await client.query(`
      SELECT 
        id,
        candidate_id,
        workflow_status,
        created_at
      FROM schedules
      ORDER BY created_at DESC
      LIMIT 5;
    `);

    if (scheduleRows.length > 0) {
      console.log(`📅 최근 생성된 일정 ${scheduleRows.length}개:\n`);
      for (const schedule of scheduleRows) {
        console.log(`   일정 ID: ${schedule.id}`);
        console.log(`   후보자 ID: ${schedule.candidate_id}`);
        console.log(`   상태: ${schedule.workflow_status}`);
        console.log(`   생성일: ${schedule.created_at}`);
        
        // 해당 일정에 대한 타임라인 이벤트 확인
        const { rows: timelineRows } = await client.query(`
          SELECT type, created_at
          FROM timeline_events
          WHERE candidate_id = $1
          ORDER BY created_at DESC
          LIMIT 5;
        `, [schedule.candidate_id]);
        
        if (timelineRows.length === 0) {
          console.log(`   ⚠️  이 후보자에 대한 타임라인 이벤트가 없습니다.`);
        } else {
          console.log(`   ✅ 타임라인 이벤트 ${timelineRows.length}개:`);
          timelineRows.forEach((event: any) => {
            console.log(`      - [${event.type}] ${event.created_at}`);
          });
        }
        console.log('');
      }
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ 확인 중 오류 발생:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

checkTimelineEvents().catch(console.error);
