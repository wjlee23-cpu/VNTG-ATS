/**
 * Supabase에 SQL을 직접 실행하는 스크립트
 * 여러 방법을 시도합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function executeSQL() {
  console.log('🚀 Supabase SQL 실행 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/COMPLETE_SETUP.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // Supabase 클라이언트 생성
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 방법 1: Supabase REST API의 rpc 함수 사용 시도
  console.log('📝 방법 1: Supabase RPC 함수를 통한 SQL 실행 시도...\n');
  
  try {
    // exec_sql 함수가 있다고 가정하고 시도
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    });

    if (error) {
      console.log('⚠️  RPC 함수를 사용할 수 없습니다.');
      console.log(`   에러: ${error.message}\n`);
    } else {
      console.log('✅ SQL 실행 완료!\n');
      console.log('결과:', data);
      return;
    }
  } catch (error: any) {
    console.log('⚠️  RPC 함수 호출 실패');
    console.log(`   에러: ${error.message}\n`);
  }

  // 방법 2: Supabase Management API 사용 시도
  console.log('📝 방법 2: Supabase Management API를 통한 SQL 실행 시도...\n');
  
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (urlMatch) {
    const projectRef = urlMatch[1];
    
    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ SQL 실행 완료!\n');
        console.log('결과:', result);
        return;
      } else {
        const errorText = await response.text();
        console.log('⚠️  Management API를 사용할 수 없습니다.');
        console.log(`   HTTP ${response.status}: ${errorText.substring(0, 200)}\n`);
      }
    } catch (error: any) {
      console.log('⚠️  Management API 호출 실패');
      console.log(`   에러: ${error.message}\n`);
    }
  }

  // 모든 방법이 실패한 경우
  console.log('❌ 자동 실행이 불가능합니다.');
  console.log('\n📋 Supabase 대시보드에서 다음 SQL을 실행하세요:\n');
  console.log('='.repeat(60));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택 > SQL Editor > New query');
  console.log('3. 아래 SQL을 복사하여 실행:\n');
  console.log(sql.substring(0, 500) + '...\n');
  console.log('='.repeat(60));
  console.log(`\n전체 SQL 파일: ${sqlFile}`);
  
  process.exit(1);
}

executeSQL().catch(console.error);
