/**
 * PostgreSQL 클라이언트를 사용하여 Supabase에 직접 연결하여 SQL 실행
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

async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 중...\n`);

  if (!dbPassword) {
    console.log('⚠️  SUPABASE_DB_PASSWORD 환경 변수가 필요합니다.');
    console.log('📋 Database Password는 Supabase 대시보드 > Project Settings > Database에서 확인할 수 있습니다.\n');
    return false;
  }

  // Connection Pooling 연결 문자열 구성
  // 여러 리전 시도
  const regions = [
    'ap-northeast-2', // 서울
    'us-east-1',      // 미국 동부
    'us-west-1',      // 미국 서부
    'eu-west-1',      // 유럽
  ];

  for (const region of regions) {
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
    
    const client = new Client({
      connectionString,
    });

    try {
      console.log(`🔗 ${region} 리전으로 연결 시도...`);
      await client.connect();
      console.log(`✅ PostgreSQL 연결 성공! (${region})\n`);

      console.log(`📝 SQL 실행 중...\n`);
      await client.query(sql);
      console.log(`✅ ${description} 완료!\n`);

      await client.end();
      return true;
    } catch (error: any) {
      await client.end().catch(() => {});
      if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
        console.log(`⚠️  ${region} 리전 연결 실패, 다음 리전 시도...\n`);
        continue;
      } else {
        console.error(`❌ ${description} 실패:`, error.message);
        return false;
      }
    }
  }

  console.log('❌ 모든 리전 연결 실패');
  return false;
}

async function main() {
  console.log('🚀 Supabase 스키마 생성 및 더미 데이터 삽입 시작...\n');
  console.log(`🔗 프로젝트: ${projectRef}\n`);

  // SQL 파일 읽기
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );

  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );

  // 1. 스키마 생성
  const schemaSuccess = await executeSQL(schemaSQL, '스키마 생성');

  if (!schemaSuccess) {
    console.log('\n❌ 스키마 생성 실패');
    console.log('💡 Supabase 대시보드에서 직접 SQL을 실행하세요.\n');
    process.exit(1);
  }

  // 2. 더미 데이터 삽입
  const seedSuccess = await executeSQL(seedSQL, '더미 데이터 삽입');

  if (!seedSuccess) {
    console.log('\n⚠️  더미 데이터 삽입 실패 (스키마는 생성됨)');
    process.exit(1);
  }

  // 3. 결과 확인
  console.log('📊 생성된 데이터 확인 중...\n');

  // 다시 연결하여 결과 확인
  if (dbPassword) {
    const regions = ['ap-northeast-2', 'us-east-1', 'us-west-1', 'eu-west-1'];
    
    for (const region of regions) {
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
      const client = new Client({ connectionString });

      try {
        await client.connect();
        
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

        console.log('✅ 생성된 데이터:');
        console.log(JSON.stringify(result.rows[0], null, 2));
        console.log('\n✨ 모든 작업 완료!\n');

        await client.end();
        break;
      } catch (error: any) {
        await client.end().catch(() => {});
        if (!regions.includes(region) || regions.indexOf(region) === regions.length - 1) {
          console.log('⚠️  결과 확인 실패 (데이터는 생성되었을 수 있음)');
        }
        continue;
      }
    }
  }
}

main().catch(console.error);
