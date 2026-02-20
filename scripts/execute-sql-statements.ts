/**
 * SQL을 문장 단위로 분리하여 Supabase에 실행
 * Service Role Key를 사용하여 가능한 작업 수행
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
    db: {
      schema: 'public',
    },
  });

  // SQL을 문장 단위로 분리 (간단한 방법)
  // 주의: DO $$ 블록은 하나의 문장으로 처리해야 함
  const statements: string[] = [];
  let currentStatement = '';
  let inDoBlock = false;
  let dollarQuote = '';
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 주석 건너뛰기
    if (trimmed.startsWith('--') || trimmed.length === 0) {
      continue;
    }
    
    // DO $$ 블록 시작 감지
    if (trimmed.match(/^DO\s+\$\$/i)) {
      inDoBlock = true;
      dollarQuote = '$$';
      currentStatement = line + '\n';
      continue;
    }
    
    // DO $tag$ 블록 시작 감지
    if (trimmed.match(/^DO\s+\$(\w+)\$/i)) {
      const match = trimmed.match(/^DO\s+\$(\w+)\$/i);
      if (match) {
        inDoBlock = true;
        dollarQuote = `$${match[1]}$`;
        currentStatement = line + '\n';
        continue;
      }
    }
    
    if (inDoBlock) {
      currentStatement += line + '\n';
      
      // DO 블록 종료 감지
      if (trimmed.endsWith(dollarQuote + ';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inDoBlock = false;
        dollarQuote = '';
      }
      continue;
    }
    
    // 일반 SQL 문
    currentStatement += line + '\n';
    
    // 세미콜론으로 문장 종료
    if (trimmed.endsWith(';')) {
      const stmt = currentStatement.trim();
      if (stmt.length > 0 && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }
  
  // 마지막 문장 추가
  if (currentStatement.trim().length > 0) {
    statements.push(currentStatement.trim());
  }

  console.log(`📋 ${statements.length}개의 SQL 문으로 분리 완료\n`);

  // Supabase는 직접 SQL 실행을 지원하지 않으므로
  // 각 문장을 Supabase 클라이언트로 실행할 수 없습니다.
  // 대신 Supabase 대시보드에서 실행하도록 안내합니다.
  
  console.log('⚠️  Supabase JavaScript 클라이언트는 직접 SQL 실행을 지원하지 않습니다.');
  console.log('📋 Supabase 대시보드에서 다음 SQL을 실행하세요:\n');
  console.log('='.repeat(60));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택 > SQL Editor > New query');
  console.log('3. 아래 SQL을 복사하여 실행:\n');
  console.log(sql);
  console.log('='.repeat(60));
  
  process.exit(0);
}

executeSQL().catch(console.error);
