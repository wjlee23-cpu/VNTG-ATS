/**
 * PostgreSQL 클라이언트를 사용하여 Supabase에 직접 연결하여 SQL 실행
 * Connection Pooling을 통해 연결
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function executeSQL() {
  console.log('🚀 PostgreSQL을 통한 Supabase 연결 시도...\n');

  // Supabase URL에서 프로젝트 참조 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ 잘못된 Supabase URL 형식입니다.');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  
  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/COMPLETE_SETUP.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // Supabase Connection Pooling 연결 문자열
  // 형식: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  // 하지만 Database Password가 필요합니다.
  
  if (!dbPassword) {
    console.log('⚠️  SUPABASE_DB_PASSWORD 환경 변수가 필요합니다.');
    console.log('📋 Database Password는 Supabase 대시보드 > Project Settings > Database에서 확인할 수 있습니다.\n');
    console.log('💡 또는 Supabase 대시보드에서 직접 SQL을 실행하세요:\n');
    console.log('='.repeat(60));
    console.log('1. https://app.supabase.com 접속');
    console.log('2. 프로젝트 선택 > SQL Editor > New query');
    console.log('3. supabase/migrations/COMPLETE_SETUP.sql 파일 내용 복사하여 실행');
    console.log('='.repeat(60));
    process.exit(1);
  }

  // Connection Pooling 연결 문자열 구성
  // 참고: 실제 region은 Supabase 대시보드에서 확인해야 합니다.
  // 일반적으로: aws-0-ap-northeast-2.pooler.supabase.com (서울 리전)
  const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require`;

  console.log('🔗 PostgreSQL 연결 시도...\n');

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('✅ PostgreSQL 연결 성공!\n');

    console.log('📝 SQL 실행 중...\n');
    
    // SQL 실행
    await client.query(sql);
    
    console.log('✅ SQL 실행 완료!\n');
    
    // 결과 확인
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations) as organizations,
        (SELECT COUNT(*) FROM processes) as processes,
        (SELECT COUNT(*) FROM job_posts) as job_posts,
        (SELECT COUNT(*) FROM candidates) as candidates,
        (SELECT COUNT(*) FROM schedules) as schedules,
        (SELECT COUNT(*) FROM schedule_options) as schedule_options,
        (SELECT COUNT(*) FROM timeline_events) as timeline_events;
    `);
    
    console.log('📊 생성된 데이터:\n');
    console.log(result.rows[0]);
    
    await client.end();
    console.log('\n✨ 모든 작업 완료!');
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    
    // 연결 문자열 문제일 수 있으므로 다른 리전 시도
    if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
      console.log('\n💡 다른 리전을 시도하거나, Supabase 대시보드에서 직접 실행하세요.');
      console.log('   Connection Pooling 주소는 Supabase 대시보드 > Project Settings > Database에서 확인할 수 있습니다.\n');
    }
    
    await client.end().catch(() => {});
    process.exit(1);
  }
}

executeSQL().catch(console.error);
