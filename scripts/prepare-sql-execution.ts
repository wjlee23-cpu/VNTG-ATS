/**
 * Supabase 대시보드에서 실행할 SQL 준비 및 안내
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  console.log('📋 Supabase 스키마 생성 및 더미 데이터 삽입 준비\n');
  console.log('='.repeat(80));
  console.log('다음 단계를 따라주세요:\n');
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택');
  console.log('3. 좌측 메뉴에서 "SQL Editor" 클릭');
  console.log('4. "New query" 버튼 클릭\n');
  console.log('='.repeat(80));
  console.log('\n📝 1단계: 스키마 생성 SQL 실행\n');
  console.log('아래 SQL을 복사하여 Supabase SQL Editor에 붙여넣고 "Run" 버튼을 클릭하세요:\n');
  console.log('-'.repeat(80));
  
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );
  console.log(schemaSQL);
  
  console.log('\n' + '-'.repeat(80));
  console.log('\n✅ 스키마 생성이 완료되면 다음 단계로 진행하세요.\n');
  console.log('='.repeat(80));
  console.log('\n📝 2단계: 더미 데이터 삽입 SQL 실행\n');
  console.log('아래 SQL을 복사하여 Supabase SQL Editor에 붙여넣고 "Run" 버튼을 클릭하세요:\n');
  console.log('-'.repeat(80));
  
  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );
  console.log(seedSQL);
  
  console.log('\n' + '-'.repeat(80));
  console.log('\n✅ 더미 데이터 삽입이 완료되면 다음 쿼리로 결과를 확인하세요:\n');
  console.log('SELECT ');
  console.log('  (SELECT COUNT(*) FROM organizations) as organizations,');
  console.log('  (SELECT COUNT(*) FROM processes) as processes,');
  console.log('  (SELECT COUNT(*) FROM job_posts) as job_posts,');
  console.log('  (SELECT COUNT(*) FROM candidates) as candidates,');
  console.log('  (SELECT COUNT(*) FROM schedules) as schedules,');
  console.log('  (SELECT COUNT(*) FROM schedule_options) as schedule_options,');
  console.log('  (SELECT COUNT(*) FROM timeline_events) as timeline_events;\n');
  console.log('='.repeat(80));
  console.log('\n✨ 완료!\n');
}

main().catch(console.error);
