/**
 * 인터뷰 스케줄링 자동화 필드 마이그레이션 적용 스크립트
 * schedules 테이블에 workflow_status 컬럼 추가
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
const databaseUrl = process.env.DATABASE_URL;

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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
    return false;
  }

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
  console.log('🚀 인터뷰 스케줄링 자동화 필드 마이그레이션 적용 시작...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260222000001_add_schedule_automation_fields.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // 방법 1: PostgreSQL 직접 연결 시도
  if (dbPassword) {
    console.log('📝 방법 1: PostgreSQL 직접 연결 시도...\n');
    const client = await executeSQLViaPostgres();
    
    if (client) {
      try {
        // SQL을 정확하게 파싱하여 실행
        // 주석 제거 및 빈 줄 제거
        const cleanSql = sql
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('--'))
          .join('\n');

        // 세미콜론으로 분리하되, ALTER TABLE 같은 복합 문장은 하나로 유지
        const statements: string[] = [];
        let currentStatement = '';
        
        const lines = cleanSql.split('\n');
        for (const line of lines) {
          currentStatement += line + '\n';
          // 세미콜론으로 끝나는 문장인지 확인
          if (line.trim().endsWith(';')) {
            const trimmed = currentStatement.trim();
            if (trimmed.length > 0) {
              statements.push(trimmed);
            }
            currentStatement = '';
          }
        }
        
        // 마지막 문장 처리
        if (currentStatement.trim().length > 0) {
          statements.push(currentStatement.trim());
        }

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
                error.message.includes('IF NOT EXISTS') ||
                error.message.includes('does not exist')) {
              console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 스킵 (이미 존재하거나 적용 불가)`);
            } else {
              console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
              console.log(`     SQL: ${statement.substring(0, 100)}...`);
            }
          }
        }

        await client.end();
        console.log('\n✨ 마이그레이션 적용 완료!');
        console.log('\n💡 Supabase 스키마 캐시를 새로고침하세요:');
        console.log('   Settings > API > Refresh Schema Cache\n');
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

  // 방법 2: 수동 실행 안내
  console.log('\n❌ 자동 실행이 불가능합니다.');
  console.log('\n📋 Supabase 대시보드에서 직접 실행하세요:');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor');
  console.log('   3. New query 클릭');
  console.log('   4. 아래 SQL을 복사하여 실행:\n');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  console.log(`\n전체 SQL 파일: ${migrationFile}`);
  console.log('\n💡 마이그레이션 적용 후 Supabase 스키마 캐시를 새로고침하세요:');
  console.log('   Settings > API > Refresh Schema Cache\n');
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
