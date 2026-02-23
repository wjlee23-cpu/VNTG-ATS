/**
 * 후보자 관리 시스템 개선 마이그레이션 적용
 * PostgreSQL 직접 연결을 통해 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;

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

async function executeSQL() {
  console.log('🚀 후보자 관리 시스템 개선 마이그레이션 적용 시작...\n');
  console.log(`🔗 프로젝트: ${projectRef}\n`);

  if (!dbPassword) {
    console.error('❌ 데이터베이스 비밀번호가 설정되지 않았습니다.');
    console.error('다음 환경 변수 중 하나를 설정하세요:');
    console.error('  - SUPABASE_DB_PASSWORD');
    console.error('  - DATABASE_PASSWORD');
    console.error('  - POSTGRES_PASSWORD');
    console.error('\n💡 Supabase 대시보드 > Project Settings > Database에서 비밀번호를 확인하세요.\n');
    process.exit(1);
  }

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260223173357_apply_all_migrations.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // 여러 리전 시도 (일반적인 리전들)
  const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];
  let connected = false;

  for (const region of regions) {
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;

    console.log(`🔗 ${region} 리전 연결 시도...`);

    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`✅ ${region} 리전 연결 성공!\n`);

      // SQL을 세미콜론으로 분리하여 각 문장 실행
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
        .map(s => s + ';');

      console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length < 10) continue; // 너무 짧은 문장은 스킵

        try {
          await client.query(statement);
          console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
        } catch (error: any) {
          // 이미 존재하는 객체는 무시
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              error.message.includes('IF NOT EXISTS')) {
            console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 스킵 (이미 존재)`);
          } else {
            console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
            console.log(`     SQL: ${statement.substring(0, 100)}...`);
          }
        }
      }

      await client.end();
      connected = true;
      console.log('\n✨ 마이그레이션 적용 완료!');
      break;
    } catch (error: any) {
      console.log(`  ❌ ${region} 리전 연결 실패: ${error.message}`);
      try {
        await client.end();
      } catch {
        // 이미 종료된 경우 무시
      }
      continue;
    }
  }

  if (!connected) {
    console.error('\n❌ 모든 리전 연결 실패');
    console.error('\n📋 Supabase 대시보드에서 직접 실행하세요:');
    console.error('   1. https://app.supabase.com 접속');
    console.error('   2. 프로젝트 선택 > SQL Editor');
    console.error('   3. New query 클릭');
    console.error('   4. supabase/migrations/20260223173357_apply_all_migrations.sql 파일 내용 복사하여 실행\n');
    process.exit(1);
  }
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
