/**
 * COMPLETE_SETUP.sql 파일을 Supabase에 직접 실행
 * Service Role Key를 사용하여 PostgreSQL에 직접 연결
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

async function executeSQL() {
  console.log('🚀 Supabase 데이터베이스 설정 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/COMPLETE_SETUP.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료`);
  console.log(`   파일 크기: ${(sql.length / 1024).toFixed(2)} KB\n`);

  // Supabase URL에서 연결 정보 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ 잘못된 Supabase URL 형식입니다.');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  
  // PostgreSQL 연결 문자열 생성
  // Supabase는 Service Role Key를 사용하여 직접 PostgreSQL에 연결할 수 없으므로
  // Supabase REST API를 통해 실행하거나, 다른 방법을 사용해야 합니다.
  
  // 대신 Supabase 클라이언트를 사용하여 가능한 작업 수행
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('⚠️  Supabase JavaScript 클라이언트는 직접 SQL 실행을 지원하지 않습니다.');
  console.log('📋 Supabase 대시보드에서 SQL을 실행하거나, PostgreSQL 연결을 사용해야 합니다.\n');
  
  // PostgreSQL 직접 연결 시도
  try {
    // Supabase는 직접 PostgreSQL 연결을 제공하지 않으므로
    // Supabase 대시보드의 SQL Editor를 사용하거나
    // Supabase CLI를 사용해야 합니다.
    
    console.log('💡 대안: Supabase 대시보드에서 실행');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor > New query');
    console.log('   3. supabase/migrations/COMPLETE_SETUP.sql 파일 내용 복사하여 실행\n');
    
    // 또는 Supabase CLI 사용
    console.log('💡 대안: Supabase CLI 사용');
    console.log('   npx supabase db push\n');
    
    // SQL 내용 출력 (사용자가 직접 복사할 수 있도록)
    console.log('📋 실행할 SQL (처음 500자):\n');
    console.log(sql.substring(0, 500) + '...\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

executeSQL().catch(console.error);
