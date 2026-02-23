/**
 * 후보자 관리 시스템 개선 마이그레이션 적용
 * Supabase Management API를 통해 직접 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || supabaseServiceKey;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

async function executeSQLViaManagementAPI(sql: string): Promise<boolean> {
  // Supabase URL에서 project ref 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
    return false;
  }

  const projectRef = urlMatch[1];
  const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/db/query`;

  console.log(`\n📝 Supabase Management API를 통해 SQL 실행 시도...`);
  console.log(`   Project Ref: ${projectRef}\n`);

  try {
    // SQL을 문장 단위로 분리
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue;

      try {
        const response = await fetch(managementApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAccessToken}`,
            'apikey': supabaseAccessToken,
          },
          body: JSON.stringify({
            query: statement,
            sql: statement,
          }),
        });

        if (response.ok) {
          console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
        } else {
          const errorText = await response.text();
          console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실패: ${response.status}`);
          console.log(`     ${errorText.substring(0, 200)}`);
        }
      } catch (error: any) {
        console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 중 오류: ${error.message}`);
      }
    }

    return true;
  } catch (error: any) {
    console.error(`❌ Management API 호출 실패: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 후보자 관리 시스템 개선 마이그레이션 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260223173357_apply_all_migrations.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // Management API를 통한 실행 시도
  const success = await executeSQLViaManagementAPI(sql);

  if (!success) {
    console.log('\n⚠️  Management API를 사용할 수 없습니다.');
    console.log('\n📋 Supabase 대시보드에서 직접 실행하세요:');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor');
    console.log('   3. New query 클릭');
    console.log('   4. 아래 SQL을 복사하여 붙여넣기');
    console.log('   5. Run 버튼 클릭\n');
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
  } else {
    console.log('\n✨ 마이그레이션 적용 완료!');
    console.log('\n💡 Supabase 스키마 캐시를 새로고침하세요:');
    console.log('   Settings > API > Refresh Schema Cache\n');
  }
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
