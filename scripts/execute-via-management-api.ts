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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function executeSQL() {
  console.log('🚀 Supabase Management API를 통한 SQL 실행 시도...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/COMPLETE_SETUP.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // Supabase URL에서 프로젝트 참조 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ 잘못된 Supabase URL 형식입니다.');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  console.log(`📋 프로젝트 참조: ${projectRef}\n`);

  // Supabase Management API를 사용하여 SQL 실행 시도
  // 참고: Management API는 Access Token이 필요하며, 직접 SQL 실행을 지원하지 않을 수 있습니다.
  
  const accessToken = supabaseAccessToken || supabaseServiceKey;
  
  try {
    console.log('📝 Management API를 통한 SQL 실행 시도...\n');
    
    // Supabase Management API 엔드포인트
    // 실제로는 이 API가 직접 SQL 실행을 지원하지 않을 수 있습니다.
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': accessToken,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SQL 실행 완료!\n');
      console.log('결과:', JSON.stringify(result, null, 2));
      return;
    } else {
      const errorText = await response.text();
      console.log('⚠️  Management API를 사용할 수 없습니다.');
      console.log(`   HTTP ${response.status}: ${errorText.substring(0, 300)}\n`);
    }
  } catch (error: any) {
    console.log('⚠️  Management API 호출 실패');
    console.log(`   에러: ${error.message}\n`);
  }

  // 모든 방법이 실패한 경우
  console.log('❌ 자동 실행이 불가능합니다.');
  console.log('\n📋 Supabase 대시보드에서 다음 SQL을 실행하세요:\n');
  console.log('='.repeat(60));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택 > SQL Editor > New query');
  console.log('3. supabase/migrations/COMPLETE_SETUP.sql 파일 내용 복사하여 실행');
  console.log('='.repeat(60));
  
  process.exit(1);
}

executeSQL().catch(console.error);
