/**
 * Supabase Management API를 사용하여 SQL 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

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

  const accessToken = supabaseAccessToken || supabaseServiceKey;

  try {
    // Supabase Management API를 통한 SQL 실행 시도
    // 참고: 실제로는 이 API가 직접 SQL 실행을 지원하지 않을 수 있습니다.
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': accessToken || '',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${description} 완료!\n`);
      console.log('결과:', JSON.stringify(result, null, 2));
      return true;
    } else {
      const errorText = await response.text();
      console.log(`⚠️  Management API를 사용할 수 없습니다.`);
      console.log(`   HTTP ${response.status}: ${errorText.substring(0, 300)}\n`);
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Management API 호출 실패`);
    console.log(`   에러: ${error.message}\n`);
    return false;
  }
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

  // 스키마 생성 시도
  const schemaSuccess = await executeSQL(schemaSQL, '스키마 생성');

  if (!schemaSuccess) {
    console.log('❌ 자동 실행이 불가능합니다.');
    console.log('\n📋 Supabase 대시보드에서 다음 SQL을 실행하세요:\n');
    console.log('='.repeat(80));
    console.log('1. https://app.supabase.com 접속');
    console.log('2. 프로젝트 선택 > SQL Editor > New query');
    console.log('3. 아래 SQL 파일 내용을 복사하여 실행:\n');
    console.log(`   - ${resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql')}`);
    console.log(`   - ${resolve(process.cwd(), 'scripts/seed-dummy-data.sql')}`);
    console.log('='.repeat(80));
    process.exit(1);
  }

  // 더미 데이터 삽입 시도
  await executeSQL(seedSQL, '더미 데이터 삽입');

  console.log('\n✨ 모든 작업 완료!\n');
}

main().catch(console.error);
