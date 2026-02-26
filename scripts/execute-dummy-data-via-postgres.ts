/**
 * PostgreSQL 직접 연결을 통한 더미 데이터 마이그레이션 적용
 * Supabase는 PostgreSQL이므로 직접 연결하여 SQL을 실행합니다.
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// 환경 변수 로드
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (require('fs').existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
} else if (require('fs').existsSync(envPath)) {
  config({ path: envPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseProjectId = process.env.SUPABASE_PROJECT_ID;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

// Supabase URL에서 프로젝트 참조 추출
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
  process.exit(1);
}

const projectRef = urlMatch[1];

async function executeSQL() {
  console.log('🚀 더미 데이터 마이그레이션 적용 시작...\n');
  console.log(`🔗 프로젝트: ${projectRef}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260224000000_comprehensive_dummy_data.sql'
  );
  
  if (!require('fs').existsSync(migrationFile)) {
    console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${migrationFile}`);
    process.exit(1);
  }

  const sql = readFileSync(migrationFile, 'utf-8');
  console.log(`📄 마이그레이션 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // PostgreSQL 연결 정보 구성
  // Supabase의 직접 연결은 보통 다음과 같습니다:
  // Host: db.{project_ref}.supabase.co
  // Port: 5432
  // Database: postgres
  // User: postgres.{project_ref}
  // Password: (별도 설정 필요)
  
  // 하지만 비밀번호가 없으면 Management API를 사용해야 합니다.
  // 또는 Supabase CLI를 통해 연결할 수 있습니다.
  
  // 방법 1: 환경 변수에서 DB 비밀번호 확인
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;
  
  if (dbPassword) {
    console.log('📝 방법 1: PostgreSQL 직접 연결 시도...\n');
    
    const client = new Client({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: `postgres.${projectRef}`,
      password: dbPassword,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log('✅ PostgreSQL 연결 성공!\n');

      // SQL 실행 (전체를 한 번에 실행)
      console.log('📝 SQL 실행 중...\n');
      await client.query(sql);
      
      console.log('✅ 더미 데이터 마이그레이션 적용 완료!\n');
      
      // 결과 확인
      const result = await client.query(`
        SELECT 
          'organizations' as table_name, COUNT(*) as count FROM organizations
        UNION ALL
        SELECT 'users', COUNT(*) FROM users
        UNION ALL
        SELECT 'processes', COUNT(*) FROM processes
        UNION ALL
        SELECT 'job_posts', COUNT(*) FROM job_posts
        UNION ALL
        SELECT 'candidates', COUNT(*) FROM candidates
        UNION ALL
        SELECT 'schedules', COUNT(*) FROM schedules
        UNION ALL
        SELECT 'schedule_options', COUNT(*) FROM schedule_options
        UNION ALL
        SELECT 'timeline_events', COUNT(*) FROM timeline_events
        UNION ALL
        SELECT 'emails', COUNT(*) FROM emails
        UNION ALL
        SELECT 'comments', COUNT(*) FROM comments
        UNION ALL
        SELECT 'scorecards', COUNT(*) FROM scorecards
        UNION ALL
        SELECT 'resume_files', COUNT(*) FROM resume_files
        UNION ALL
        SELECT 'application_submissions', COUNT(*) FROM application_submissions
        UNION ALL
        SELECT 'stage_evaluations', COUNT(*) FROM stage_evaluations
        ORDER BY table_name;
      `);
      
      console.log('📊 생성된 데이터 통계:');
      console.log('='.repeat(50));
      result.rows.forEach((row: any) => {
        console.log(`  ${row.table_name.padEnd(25)}: ${row.count}개`);
      });
      console.log('='.repeat(50));
      
      await client.end();
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

  // 방법 2: Supabase Management API 사용
  console.log('\n📝 방법 2: Supabase Management API 시도...\n');
  
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (accessToken && supabaseProjectId) {
    try {
      // Management API를 통한 SQL 실행
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${supabaseProjectId}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: sql
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Management API를 통한 SQL 실행 완료!\n');
        console.log('결과:', result);
        return;
      } else {
        const errorText = await response.text();
        console.log(`⚠️  Management API 실행 실패: ${response.status} ${errorText}`);
      }
    } catch (error: any) {
      console.log(`⚠️  Management API 호출 실패: ${error.message}`);
    }
  }

  // 방법 3: Supabase CLI 사용
  console.log('\n📝 방법 3: Supabase CLI 사용 안내...\n');
  console.log('💡 Supabase CLI를 사용하여 마이그레이션을 적용할 수 있습니다:');
  console.log(`   supabase db push --db-url "postgresql://postgres.[password]@db.${projectRef}.supabase.co:5432/postgres"`);
  console.log('\n또는 Supabase 대시보드에서 직접 실행하세요:');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor');
  console.log('   3. New query 클릭');
  console.log('   4. 마이그레이션 파일 내용 복사하여 실행\n');
}

executeSQL().catch(console.error);
