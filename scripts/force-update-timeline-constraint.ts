/**
 * 타임라인 이벤트 타입 제약 조건 강제 업데이트
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

async function forceUpdateConstraint() {
  console.log('🔧 타임라인 이벤트 타입 제약 조건 강제 업데이트 중...\n');

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

    // 1. 기존 제약 조건 제거
    console.log('1️⃣  기존 제약 조건 제거 중...');
    try {
      await client.query(`
        ALTER TABLE timeline_events
        DROP CONSTRAINT IF EXISTS timeline_events_type_check;
      `);
      console.log('   ✅ 기존 제약 조건 제거 완료\n');
    } catch (error: any) {
      console.log(`   ⚠️  제거 실패 (이미 없을 수 있음): ${error.message}\n`);
    }

    // 2. 새로운 제약 조건 추가
    console.log('2️⃣  새로운 제약 조건 추가 중...');
    try {
      await client.query(`
        ALTER TABLE timeline_events
        ADD CONSTRAINT timeline_events_type_check 
        CHECK (type IN (
          'system_log', 
          'schedule_created', 
          'schedule_confirmed', 
          'stage_changed', 
          'email', 
          'email_received',
          'comment', 
          'comment_created',
          'comment_updated',
          'scorecard', 
          'scorecard_created',
          'approval',
          'stage_evaluation',
          'archive',
          'interviewer_response',
          'schedule_regenerated',
          'position_changed'
        ));
      `);
      console.log('   ✅ 새로운 제약 조건 추가 완료\n');
    } catch (error: any) {
      console.error(`   ❌ 추가 실패: ${error.message}\n`);
      throw error;
    }

    // 3. 확인
    console.log('3️⃣  제약 조건 확인 중...');
    const { rows } = await client.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'timeline_events'::regclass
        AND contype = 'c'
        AND conname LIKE '%type%';
    `);

    if (rows.length === 0) {
      console.log('   ⚠️  제약 조건을 찾을 수 없습니다.\n');
    } else {
      const definition = rows[0].constraint_definition;
      console.log(`   제약 조건: ${rows[0].constraint_name}`);
      
      const newTypes = [
        'interviewer_response',
        'schedule_regenerated',
        'position_changed',
        'email_received',
        'comment_created',
        'comment_updated',
        'scorecard_created'
      ];

      let allFound = true;
      for (const type of newTypes) {
        const found = definition.includes(`'${type}'`);
        if (!found) {
          allFound = false;
          console.log(`   ❌ ${type} 누락`);
        }
      }

      if (allFound) {
        console.log('   ✅ 모든 새로운 타입이 포함되어 있습니다!\n');
        console.log('✨ 제약 조건 업데이트 완료!\n');
      } else {
        console.log('   ⚠️  일부 타입이 누락되었습니다.\n');
      }
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

forceUpdateConstraint().catch(console.error);
