/**
 * Supabase CLI를 사용하여 스키마 생성 및 더미 데이터 삽입
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

async function executeSQL(sql: string, description: string): Promise<void> {
  console.log(`\n📝 ${description} 실행 중...\n`);

  // 임시 SQL 파일 생성
  const tempFile = resolve(process.cwd(), 'temp_migration.sql');
  writeFileSync(tempFile, sql, 'utf-8');

  try {
    // Supabase CLI를 사용하여 SQL 실행
    // npx supabase db execute --file <file> --project-ref <ref>
    const command = `npx supabase db execute --file "${tempFile}" --project-ref ${projectRef}`;
    console.log(`실행 명령: ${command}\n`);
    
    const shell =
      process.platform === 'win32'
        ? 'powershell.exe'
        : (process.env.SHELL || '/bin/bash');

    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
      cwd: process.cwd(),
      // 타입 에러 방지를 위해 `shell`은 문자열로 설정합니다.
      shell,
    });

    console.log(`✅ ${description} 완료!\n`);
  } catch (error: any) {
    console.error(`❌ ${description} 실패:`);
    console.error(error.message);
    console.log('\n💡 대안: Supabase 대시보드 > SQL Editor에서 직접 실행하세요.\n');
  } finally {
    // 임시 파일 삭제
    if (existsSync(tempFile)) {
      try {
        require('fs').unlinkSync(tempFile);
      } catch (e) {
        // 무시
      }
    }
  }
}

async function main() {
  console.log('🚀 Supabase 스키마 생성 및 더미 데이터 삽입 시작...\n');
  console.log(`🔗 프로젝트: ${projectRef}\n`);

  // 1. 스키마 생성 SQL 읽기
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );

  // 2. 더미 데이터 SQL 읽기
  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );

  // 3. 스키마 생성 실행
  await executeSQL(schemaSQL, '스키마 생성');

  // 4. 더미 데이터 삽입 실행
  await executeSQL(seedSQL, '더미 데이터 삽입');

  console.log('\n✨ 모든 작업 완료!\n');
}

main().catch(console.error);
