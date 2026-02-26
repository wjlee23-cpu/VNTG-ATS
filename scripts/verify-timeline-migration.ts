/**
 * 타임라인 이벤트 타입 마이그레이션 확인 스크립트
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

async function verifyMigration() {
  console.log('🔍 타임라인 이벤트 타입 마이그레이션 확인 중...\n');

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

    // 제약 조건 확인
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
      console.log('⚠️  timeline_events_type_check 제약 조건을 찾을 수 없습니다.');
    } else {
      console.log('✅ 제약 조건 확인:\n');
      rows.forEach((row: any) => {
        console.log(`   제약 조건 이름: ${row.constraint_name}`);
        console.log(`   정의: ${row.constraint_definition}\n`);
      });

      // 새로운 타입들이 포함되어 있는지 확인
      const definition = rows[0].constraint_definition;
      const newTypes = [
        'interviewer_response',
        'schedule_regenerated',
        'position_changed',
        'email_received',
        'comment_created',
        'comment_updated',
        'scorecard_created'
      ];

      console.log('📋 새로운 타입 확인:\n');
      let allFound = true;
      for (const type of newTypes) {
        const found = definition.includes(`'${type}'`);
        console.log(`   ${type}: ${found ? '✅' : '❌'}`);
        if (!found) {
          allFound = false;
        }
      }

      console.log('');
      if (allFound) {
        console.log('✨ 모든 새로운 타입이 제약 조건에 포함되어 있습니다!\n');
      } else {
        console.log('⚠️  일부 타입이 제약 조건에 포함되지 않았습니다.');
        console.log('   마이그레이션을 다시 실행하세요.\n');
      }
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ 확인 중 오류 발생:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

verifyMigration().catch(console.error);
