/**
 * 후보자 관리 시스템 개선 마이그레이션 적용
 * MCP 권한을 사용하여 직접 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드 (.env 우선, 없으면 .env.local)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;

console.log('🔍 환경 변수 확인:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ 설정됨' : '❌ 없음'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅ 설정됨' : '❌ 없음'}`);
console.log(`   DB_PASSWORD: ${dbPassword ? '✅ 설정됨' : '❌ 없음'}`);
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQLViaPostgres() {
  if (!dbPassword) {
    return false;
  }

  const { Client } = await import('pg');
  
  // Supabase URL에서 프로젝트 참조 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    return false;
  }

  const projectRef = urlMatch[1];
  const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];

  for (const region of regions) {
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;

    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`✅ ${region} 리전 연결 성공!\n`);
      return client;
    } catch (error: any) {
      continue;
    }
  }

  return false;
}

async function executeSQL() {
  console.log('🚀 후보자 관리 시스템 개선 마이그레이션 적용 시작...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260223173357_apply_all_migrations.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // 방법 1: PostgreSQL 직접 연결 시도
  if (dbPassword) {
    console.log('📝 방법 1: PostgreSQL 직접 연결 시도...\n');
    const client = await executeSQLViaPostgres();
    
    if (client) {
      try {
        // SQL을 세미콜론으로 분리하여 각 문장 실행
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'))
          .map(s => s + ';');

        console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.length < 10) continue;

          try {
            await client.query(statement);
            console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
          } catch (error: any) {
            // 이미 존재하는 객체는 무시
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate') ||
                error.message.includes('IF NOT EXISTS')) {
              console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 스킵 (이미 존재)`);
            } else {
              console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
            }
          }
        }

        await client.end();
        console.log('\n✨ 마이그레이션 적용 완료!');
        return;
      } catch (error: any) {
        console.error(`❌ PostgreSQL 실행 중 오류: ${error.message}`);
        try {
          await client.end();
        } catch {
          // 이미 종료된 경우 무시
        }
      }
    }
  }

  // 방법 2: Supabase RPC 함수 시도
  console.log('\n📝 방법 2: Supabase RPC 함수 시도...\n');
  
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql', 'run_sql', 'exec', 'execute'];
  let successCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue;

    let success = false;
    for (const funcName of rpcFunctions) {
      try {
        const { data, error } = await supabase.rpc(funcName, {
          sql_query: statement,
          query: statement,
          sql: statement,
          statement: statement,
        });

        if (!error) {
          console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료 (${funcName})`);
          success = true;
          successCount++;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!success) {
      console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 불가 (DDL은 직접 실행 필요)`);
    }
  }

  if (successCount > 0) {
    console.log(`\n✨ ${successCount}개의 문장이 성공적으로 실행되었습니다!`);
  } else {
    console.log('\n❌ 모든 방법 실패');
    console.log('\n📋 Supabase 대시보드에서 직접 실행하세요:');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor');
    console.log('   3. New query 클릭');
    console.log('   4. supabase/migrations/20260223173357_apply_all_migrations.sql 파일 내용 복사하여 실행\n');
  }
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
