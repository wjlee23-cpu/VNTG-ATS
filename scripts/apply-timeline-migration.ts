/**
 * 타임라인 이벤트 타입 확장 마이그레이션 적용 스크립트
 * 
 * 사용법:
 *   npx tsx scripts/apply-timeline-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL와 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 타임라인 이벤트 타입 확장 마이그레이션 적용 시작...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260225000000_extend_timeline_event_types.sql'
  );

  let sql: string;
  try {
    sql = readFileSync(migrationFile, 'utf-8');
    console.log('📄 마이그레이션 파일 로드 완료\n');
  } catch (error: any) {
    console.error('❌ 마이그레이션 파일을 읽을 수 없습니다:', error.message);
    process.exit(1);
  }

  // SQL 문장 분리 (세미콜론 기준)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  console.log(`📝 총 ${statements.length}개의 SQL 문장을 실행합니다.\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue; // 너무 짧은 문장은 스킵

    const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] 실행 중: ${preview}...`);

    try {
      // Supabase는 직접 SQL 실행을 지원하지 않으므로, 
      // PostgreSQL 클라이언트를 사용하거나 Management API를 사용해야 합니다.
      // 여기서는 pg 라이브러리를 사용합니다.
      
      // 대안: Supabase의 REST API를 통해 SQL 실행
      // 하지만 Supabase는 직접 SQL 실행을 제한하므로,
      // 여기서는 사용자에게 Supabase 대시보드에서 실행하도록 안내하거나,
      // PostgreSQL 직접 연결을 시도합니다.

      // DATABASE_URL이 있으면 PostgreSQL 직접 연결 시도
      const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
      
      if (databaseUrl) {
        // PostgreSQL 직접 연결
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: databaseUrl,
          ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
        });

        try {
          await client.connect();
          await client.query(statement);
          await client.end();
          console.log(`  ✅ 성공\n`);
          successCount++;
        } catch (error: any) {
          await client.end().catch(() => {});
          
          // 이미 존재하는 제약 조건은 무시
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('DROP CONSTRAINT IF EXISTS')) {
            console.log(`  ⚠️  스킵 (이미 적용됨 또는 조건부 실행)\n`);
            successCount++;
          } else {
            console.log(`  ❌ 실패: ${error.message}\n`);
            failCount++;
          }
        }
      } else {
        // DATABASE_URL이 없으면 Supabase Management API 시도
        console.log(`  ⚠️  DATABASE_URL이 없어 직접 실행할 수 없습니다.`);
        console.log(`  📋 Supabase 대시보드에서 수동 실행이 필요합니다.\n`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ 오류: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('='.repeat(50) + '\n');

  if (failCount > 0) {
    console.log('⚠️  일부 SQL 문장이 자동 실행되지 않았습니다.');
    console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
    console.log(sql);
    console.log('\n');
  } else {
    console.log('✨ 마이그레이션이 성공적으로 적용되었습니다!\n');
    console.log('💡 Supabase 스키마 캐시를 새로고침하세요:');
    console.log('   Settings > API > Refresh Schema Cache\n');
  }
}

applyMigration().catch(console.error);
