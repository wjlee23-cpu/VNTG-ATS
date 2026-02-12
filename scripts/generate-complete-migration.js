/**
 * 모든 마이그레이션을 하나의 파일로 합치는 스크립트
 * Supabase 대시보드에서 한 번에 실행할 수 있습니다.
 */

const fs = require('fs')
const path = require('path')

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
const outputFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')

const migrations = [
  '001_initial_schema.sql',
  '002_phase2_features.sql',
  '003_phase3_resume_parsing.sql'
]

console.log('📦 마이그레이션 파일 통합 중...\n')

let completeSQL = `-- ============================================
-- RecruitOps 완전한 데이터베이스 스키마
-- ============================================
-- 이 파일은 모든 마이그레이션을 통합한 완전한 스키마입니다.
-- Supabase 대시보드의 SQL Editor에서 이 파일 전체를 실행하세요.
-- 
-- 실행 방법:
-- 1. https://app.supabase.com 접속
-- 2. 프로젝트 선택
-- 3. 좌측 메뉴에서 "SQL Editor" 클릭
-- 4. "New query" 클릭
-- 5. 아래 전체 내용을 복사하여 붙여넣기
-- 6. "Run" 버튼 클릭
-- ============================================

`

for (const migrationFile of migrations) {
  const filePath = path.join(migrationsDir, migrationFile)
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  파일을 찾을 수 없습니다: ${migrationFile}`)
    continue
  }

  console.log(`✅ ${migrationFile} 추가됨`)
  completeSQL += `\n-- ============================================\n`
  completeSQL += `-- ${migrationFile}\n`
  completeSQL += `-- ============================================\n\n`
  completeSQL += fs.readFileSync(filePath, 'utf8')
  completeSQL += `\n\n`
}

fs.writeFileSync(outputFile, completeSQL, 'utf8')

console.log(`\n✅ 통합 완료: ${outputFile}`)
console.log(`\n📋 다음 단계:`)
console.log(`   1. ${outputFile} 파일을 열어보세요`)
console.log(`   2. Supabase 대시보드 (https://app.supabase.com) 접속`)
console.log(`   3. 프로젝트 선택 > SQL Editor > New query`)
console.log(`   4. 파일 내용 전체를 복사하여 붙여넣기`)
console.log(`   5. Run 버튼 클릭\n`)
