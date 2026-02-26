/**
 * 면접 일정 날짜 범위 필드 마이그레이션 직접 적용
 * 사용자가 제공한 SQL을 사용하여 Supabase에 직접 적용
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const databaseUrl = process.env.DATABASE_URL || process.env.database_url;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;

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

// 사용자가 제공한 SQL
const sql = `-- schedules 테이블 수정
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS original_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_schedules_original_date_range ON schedules(original_start_date, original_end_date);
CREATE INDEX IF NOT EXISTS idx_schedules_retry_count ON schedules(retry_count);

-- 코멘트 추가 (필드 설명)
COMMENT ON COLUMN schedules.original_start_date IS '최초 관리자가 선택한 시작 날짜 (날짜 범위 확장 시 기준점)';
COMMENT ON COLUMN schedules.original_end_date IS '최초 관리자가 선택한 종료 날짜 (날짜 범위 확장 시 기준점)';
COMMENT ON COLUMN schedules.retry_count IS '날짜 범위 확장 재시도 횟수 (최대 5회)';`;

async function executeSQLViaPostgres() {
  const { Client } = await import('pg');
  
  // 방법 1: DATABASE_URL이 있으면 직접 사용
  if (databaseUrl) {
    try {
      // URL 형식 확인 및 정리
      let connectionString = databaseUrl.trim();
      
      // 따옴표 제거 (환경 변수에 따옴표가 포함된 경우)
      connectionString = connectionString.replace(/^["']|["']$/g, '');
      
      // postgres:// 형식이면 postgresql://로 변환
      if (connectionString.startsWith('postgres://')) {
        connectionString = connectionString.replace('postgres://', 'postgresql://');
      }
      
      // URL 형식 검증
      if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
        throw new Error(`DATABASE_URL은 postgresql:// 또는 postgres://로 시작해야 합니다. 현재: ${connectionString.substring(0, 20)}...`);
      }
      
      console.log(`📝 DATABASE_URL 연결 시도 중...`);
      console.log(`   연결 문자열 시작: ${connectionString.substring(0, 50)}...`);
      
      // SSL 설정
      const needsSSL = connectionString.includes('sslmode=require') || 
                      connectionString.includes('pooler.supabase.com') ||
                      connectionString.includes('.supabase.co');
      
      // 방법 1-1: connectionString 직접 사용
      try {
        const client = new Client({
          connectionString: connectionString,
          connectionTimeoutMillis: 15000,
          ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
        });
        
        await client.connect();
        console.log('✅ DATABASE_URL을 통한 연결 성공! (connectionString 방식)\n');
        return client;
      } catch (urlError: any) {
        // 방법 1-2: 정규식으로 URL 파싱해서 개별 파라미터로 전달
        if (urlError.message.includes('Invalid URL')) {
          console.log(`   ⚠️  connectionString 방식 실패, 정규식 파싱 방식으로 재시도...`);
          
          try {
            // 정규식으로 PostgreSQL URL 파싱
            // 형식: postgresql://user:password@host:port/database?params
            const match = connectionString.match(/^postgresql?:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?(?:\/([^?]+))?(?:\?(.+))?$/);
            
            if (!match) {
              throw new Error('URL 형식을 파싱할 수 없습니다.');
            }
            
            const [, user, password, host, portStr, database, queryParams] = match;
            const port = portStr ? parseInt(portStr) : 5432;
            const dbName = database || 'postgres';
            
            // 쿼리 파라미터에서 sslmode 확인
            const hasSSLMode = queryParams && queryParams.includes('sslmode=require');
            const finalNeedsSSL = needsSSL || hasSSLMode;
            
            console.log(`   📝 파싱 결과: host=${host}, port=${port}, user=${user ? user.substring(0, 20) + '...' : 'N/A'}, database=${dbName}`);
            
            const client = new Client({
              host: host,
              port: port,
              user: user || 'postgres',
              password: password || '',
              database: dbName,
              connectionTimeoutMillis: 15000,
              ssl: finalNeedsSSL ? { rejectUnauthorized: false } : undefined,
            });
            
            await client.connect();
            console.log('✅ DATABASE_URL을 통한 연결 성공! (정규식 파싱 방식)\n');
            return client;
          } catch (parseError: any) {
            throw new Error(`URL 파싱 실패: ${parseError.message}`);
          }
        } else {
          throw urlError;
        }
      }
    } catch (error: any) {
      console.log(`⚠️  DATABASE_URL 연결 실패: ${error.message}`);
      if (error.message.includes('Invalid URL') || error.message.includes('ECONNREFUSED')) {
        console.log(`   💡 DATABASE_URL 형식을 확인해주세요.`);
        console.log(`   💡 예상 형식: postgresql://user:password@host:port/database`);
        console.log(`   💡 Supabase 형식: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`);
      }
      // 계속해서 다른 방법 시도
    }
  }

  // 방법 2: DB_PASSWORD가 있으면 Supabase 연결 문자열 구성
  if (dbPassword) {
    // Supabase URL에서 프로젝트 참조 추출
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      return null;
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
  }

  return null;
}

async function executeSQL() {
  console.log('🚀 면접 일정 날짜 범위 필드 마이그레이션 적용 시작...\n');

  // 방법 1: PostgreSQL 직접 연결 시도 (DATABASE_URL 또는 DB_PASSWORD 사용)
  if (databaseUrl || dbPassword) {
    console.log('📝 방법 1: PostgreSQL 직접 연결 시도...\n');
    const client = await executeSQLViaPostgres();
    
    if (client) {
      try {
        // SQL을 세미콜론으로 분리하여 각 문장 실행
        // 주석 제거 및 빈 줄 제거
        const cleanedSQL = sql
          .split('\n')
          .map(line => {
            // 주석 제거
            const commentIndex = line.indexOf('--');
            if (commentIndex >= 0) {
              return line.substring(0, commentIndex).trim();
            }
            return line.trim();
          })
          .filter(line => line.length > 0)
          .join('\n');
        
        const statements = cleanedSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => s + ';');

        console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.length < 10) continue;

          try {
            const result = await client.query(statement);
            console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
            if (result.command) {
              console.log(`     명령: ${result.command}, 영향받은 행: ${result.rowCount || 0}`);
            }
          } catch (error: any) {
            // 이미 존재하는 객체는 무시 (IF NOT EXISTS로 인해 에러가 발생하지 않아야 하지만, 혹시 모를 경우 대비)
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key') ||
                error.message.includes('relation') && error.message.includes('already exists')) {
              console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 스킵 (이미 존재)`);
              console.log(`     메시지: ${error.message.substring(0, 100)}`);
            } else {
              console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
              console.log(`     SQL: ${statement.substring(0, 100)}...`);
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

  // 방법 2: Supabase REST API를 통한 시도 (DDL은 보통 안 되지만 시도)
  console.log('\n📝 방법 2: Supabase REST API 시도...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // SQL 문장들을 개별적으로 실행 시도
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue;

    // Supabase는 DDL을 직접 실행할 수 없으므로, 
    // 여기서는 실패할 것으로 예상되지만 시도해봅니다
    try {
      // RPC 함수가 있다면 시도
      const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql'];
      let success = false;
      
      for (const funcName of rpcFunctions) {
        try {
          const { data, error } = await supabase.rpc(funcName, {
            sql_query: statement,
            query: statement,
            sql: statement,
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
    } catch (error: any) {
      console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 불가: ${error.message}`);
    }
  }

  if (successCount > 0) {
    console.log(`\n✨ ${successCount}개의 문장이 성공적으로 실행되었습니다!`);
  } else {
    console.log('\n❌ 자동 실행이 불가능합니다.');
    console.log('\n📋 Supabase 대시보드에서 직접 실행하세요:');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor');
    console.log('   3. New query 클릭');
    console.log('   4. 아래 SQL을 복사하여 실행:\n');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
  }
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
