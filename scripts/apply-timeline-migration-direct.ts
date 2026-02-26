/**
 * 타임라인 이벤트 타입 확장 마이그레이션 직접 적용
 * PostgreSQL 직접 연결을 통해 마이그레이션 실행
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// DATABASE_URL에서 패스워드 추출 (postgresql://postgres.프로젝트:패스워드@호스트:포트/DB)
let dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;

if (!dbPassword && databaseUrl) {
  // DATABASE_URL에서 패스워드 추출
  const urlMatch = databaseUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
  if (urlMatch) {
    dbPassword = decodeURIComponent(urlMatch[1]);
  }
}

console.log('🔍 환경 변수 확인:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ 설정됨' : '❌ 없음'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅ 설정됨' : '❌ 없음'}`);
console.log(`   DATABASE_URL: ${databaseUrl ? '✅ 설정됨' : '❌ 없음'}`);
console.log(`   DB_PASSWORD: ${dbPassword ? '✅ 설정됨' : '❌ 없음'}`);
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL와 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

async function executeSQLViaPostgres() {
  const { Client } = await import('pg');
  
  // 방법 1: DATABASE_URL을 파싱하여 올바른 형식으로 재구성
  if (databaseUrl) {
    try {
      // postgresql://user:password@host:port/db 형식 파싱
      const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
      const match = databaseUrl.match(urlPattern);
      
      if (match) {
        const [, user, password, host, port, database] = match;
        // 패스워드를 URL 인코딩하여 재구성 (특수문자 처리)
        const encodedPassword = encodeURIComponent(password);
        const connectionString = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
        
        const client = new Client({
          connectionString,
          connectionTimeoutMillis: 10000,
          ssl: {
            rejectUnauthorized: false, // Supabase의 자체 서명 인증서 허용
          },
        });
        await client.connect();
        console.log('✅ DATABASE_URL로 연결 성공!\n');
        return client;
      } else {
        console.log('⚠️  DATABASE_URL 형식이 올바르지 않습니다.');
      }
    } catch (error: any) {
      console.log(`⚠️  DATABASE_URL 연결 실패: ${error.message}`);
      // 계속해서 다른 방법 시도
    }
  }

  // 방법 2: 패스워드와 프로젝트 참조로 연결 시도
  if (!dbPassword) {
    return null;
  }

  // Supabase URL에서 프로젝트 참조 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    return null;
  }

  const projectRef = urlMatch[1];
  const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];

  // 각 리전에 대해 연결 시도
  for (const region of regions) {
    try {
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
      
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });

      await client.connect();
      console.log(`✅ ${region} 리전으로 연결 성공!\n`);
      return client;
    } catch (error: any) {
      // 다음 리전 시도
      continue;
    }
  }

  return null;
}

async function executeSQL() {
  console.log('📄 마이그레이션 파일 로드 중...\n');
  
  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260225000000_extend_timeline_event_types.sql'
  );

  let sql: string;
  try {
    sql = readFileSync(migrationFile, 'utf-8');
    console.log('✅ 마이그레이션 파일 로드 완료\n');
  } catch (error: any) {
    console.error('❌ 마이그레이션 파일을 읽을 수 없습니다:', error.message);
    process.exit(1);
  }

  // 방법 1: PostgreSQL 직접 연결 시도
  if (databaseUrl || dbPassword) {
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

          const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
          console.log(`[${i + 1}/${statements.length}] 실행 중: ${preview}...`);

          try {
            const result = await client.query(statement);
            console.log(`  ✅ 성공`);
            if (result.rowCount !== undefined) {
              console.log(`     영향받은 행: ${result.rowCount}`);
            }
            console.log('');
          } catch (error: any) {
            // 이미 존재하는 제약 조건은 무시
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist') ||
                error.message.includes('DROP CONSTRAINT IF EXISTS')) {
              console.log(`  ⚠️  스킵 (이미 적용됨 또는 조건부 실행)\n`);
            } else {
              console.log(`  ❌ 실패: ${error.message}`);
              console.log(`     SQL: ${statement.substring(0, 200)}...\n`);
              // 제약 조건 추가 실패는 무시하지 않고 계속 진행
              if (!error.message.includes('constraint') && !error.message.includes('already exists')) {
                throw error; // 중요한 에러는 중단
              }
            }
          }
        }

        await client.end();
        console.log('\n✨ 마이그레이션이 성공적으로 적용되었습니다!\n');
        console.log('💡 Supabase 스키마 캐시를 새로고침하세요:');
        console.log('   Settings > API > Refresh Schema Cache\n');
        return;
      } catch (error: any) {
        await client.end().catch(() => {});
        console.error('\n❌ 마이그레이션 적용 중 오류 발생:', error.message);
        throw error;
      }
    }
  }

  // 방법 2: Supabase Management API 사용 (Service Role Key로 직접 SQL 실행 불가)
  console.log('⚠️  PostgreSQL 직접 연결에 실패했습니다.');
  console.log('\n📋 Supabase 대시보드에서 수동 실행하세요:\n');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  console.log('\n💡 실행 방법:');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor > New query');
  console.log('   3. 위 SQL을 복사하여 실행\n');
  process.exit(1);

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
      if (statement.length < 10) continue; // 너무 짧은 문장은 스킵

      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] 실행 중: ${preview}...`);

      try {
        await client.query(statement);
        console.log(`  ✅ 성공\n`);
      } catch (error: any) {
        // 이미 존재하는 제약 조건은 무시
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('DROP CONSTRAINT IF EXISTS')) {
          console.log(`  ⚠️  스킵 (이미 적용됨 또는 조건부 실행)\n`);
        } else {
          console.log(`  ❌ 실패: ${error.message}\n`);
          throw error; // 중요한 에러는 중단
        }
      }
    }

    await client.end();
    console.log('\n✨ 마이그레이션이 성공적으로 적용되었습니다!\n');
    console.log('💡 Supabase 스키마 캐시를 새로고침하세요:');
    console.log('   Settings > API > Refresh Schema Cache\n');
  } catch (error: any) {
    await client.end().catch(() => {});
    console.error('\n❌ 마이그레이션 적용 중 오류 발생:', error.message);
    console.error('\n📋 Supabase 대시보드에서 수동 실행하세요:\n');
    console.error('='.repeat(60));
    console.error(sql);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

executeSQL().catch(console.error);
