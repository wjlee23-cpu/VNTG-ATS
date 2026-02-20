/**
 * PostgreSQL 클라이언트를 사용하여 Supabase에 SQL 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

// Supabase URL에서 연결 정보 추출
// 형식: https://[project-ref].supabase.co
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
  process.exit(1);
}

const projectRef = urlMatch[1];

// Supabase PostgreSQL 연결 문자열 구성
// Supabase는 직접 DB 연결을 제공하지 않으므로, Connection Pooler를 사용하거나
// Supabase CLI를 통해 연결해야 합니다.
// 여기서는 Supabase Management API나 다른 방법을 시도합니다.

async function executeSQL() {
  console.log('🚀 Supabase SQL 실행 시작...\n');
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

  console.log('⚠️  Supabase는 직접 PostgreSQL 연결을 지원하지 않습니다.');
  console.log('📋 다음 방법 중 하나를 사용하세요:\n');
  console.log('방법 1: Supabase CLI 사용');
  console.log('   1. supabase link --project-ref ' + projectRef);
  console.log('   2. supabase db push\n');
  console.log('방법 2: Supabase 대시보드 사용');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor > New query');
  console.log('   3. 아래 SQL 파일 내용을 복사하여 실행:\n');
  console.log(`   - ${resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql')}`);
  console.log(`   - ${resolve(process.cwd(), 'scripts/seed-dummy-data.sql')}\n`);

  // Supabase CLI가 설치되어 있는지 확인
  try {
    const { execSync } = require('child_process');
    const cliVersion = execSync('supabase --version', { encoding: 'utf-8' });
    console.log(`✅ Supabase CLI 설치됨: ${cliVersion.trim()}\n`);
    console.log('💡 Supabase CLI를 사용하여 마이그레이션을 적용할 수 있습니다.\n');
  } catch (error) {
    console.log('⚠️  Supabase CLI가 설치되지 않았습니다.');
    console.log('   설치: npm install -g supabase\n');
  }

  process.exit(0);
}

executeSQL().catch(console.error);
