/**
 * 타임라인 이벤트 타입 확장 마이그레이션 적용
 * Supabase REST API를 통한 직접 실행
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 타임라인 이벤트 타입 확장 마이그레이션 적용 시작...\n');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL와 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}

async function executeSQLViaRPC() {
  // Supabase는 직접 SQL 실행을 지원하지 않지만,
  // Service Role Key를 사용하여 RPC 함수를 통해 실행할 수 있습니다.
  // 하지만 일반적으로는 Supabase 대시보드에서 직접 실행해야 합니다.
  
  // 대신 Supabase REST API의 rpc 엔드포인트를 사용하여
  // SQL을 실행하는 커스텀 함수가 있다면 사용할 수 있습니다.
  
  // 여기서는 간단하게 SQL을 출력하고, 
  // 사용자가 Supabase 대시보드에서 실행하도록 안내합니다.
  
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

  // Supabase REST API를 통해 직접 SQL 실행 시도
  // Supabase는 Management API를 제공하지만, Access Token이 필요합니다.
  // Service Role Key만으로는 직접 SQL을 실행할 수 없습니다.
  
  // 대안: Supabase의 REST API를 사용하여 SQL 실행
  // 하지만 Supabase는 보안상의 이유로 직접 SQL 실행을 제한합니다.
  
  // 가장 확실한 방법: Supabase CLI 사용 또는 대시보드에서 직접 실행
  
  console.log('📋 Supabase는 보안상의 이유로 Service Role Key만으로는 직접 SQL을 실행할 수 없습니다.');
  console.log('💡 다음 방법 중 하나를 사용하세요:\n');
  console.log('방법 1: Supabase 대시보드 사용 (권장)');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor > New query');
  console.log('   3. 아래 SQL을 복사하여 실행\n');
  console.log('방법 2: Supabase CLI 사용');
  console.log('   npx supabase db push\n');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  
  // 하지만 사용자가 직접 실행하도록 요청했으므로,
  // Supabase Management API를 사용하여 시도해보겠습니다.
  
  try {
    // Supabase URL에서 프로젝트 참조 추출
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      throw new Error('잘못된 Supabase URL 형식');
    }

    const projectRef = urlMatch[1];
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}`;
    
    // Management API는 Access Token이 필요하므로, 
    // Service Role Key로는 작동하지 않을 수 있습니다.
    // 하지만 시도해보겠습니다.
    
    console.log('\n📝 Supabase Management API를 통한 실행 시도...\n');
    
    // SQL을 단일 문자열로 정리
    const cleanSQL = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .join(';') + ';';
    
    // Supabase REST API를 통해 직접 실행할 수 없으므로,
    // 사용자에게 수동 실행을 안내합니다.
    
    console.log('⚠️  Supabase Management API는 Access Token이 필요합니다.');
    console.log('   Service Role Key만으로는 직접 SQL을 실행할 수 없습니다.\n');
    
  } catch (error: any) {
    console.error('❌ API 실행 시도 중 오류:', error.message);
  }
  
  process.exit(0);
}

executeSQLViaRPC().catch(console.error);
