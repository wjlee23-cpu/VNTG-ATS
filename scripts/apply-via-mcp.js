/**
 * Supabase MCP를 통한 마이그레이션 적용
 * 통합 마이그레이션 파일을 Supabase에 직접 적용합니다.
 */

const fs = require('fs')
const path = require('path')

// 통합 마이그레이션 파일 읽기
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')
const sql = fs.readFileSync(migrationFile, 'utf8')

console.log('📄 마이그레이션 파일 로드 완료')
console.log(`   파일 크기: ${(sql.length / 1024).toFixed(2)} KB`)
console.log(`   SQL 문 수: ${sql.split(';').filter(s => s.trim().length > 10).length}개\n`)

// SQL을 문장 단위로 분리
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='))

console.log(`✅ ${statements.length}개의 SQL 문을 준비했습니다.`)
console.log('\n📋 다음 단계:')
console.log('   Supabase MCP를 통해 이 SQL을 실행하세요.\n')

// SQL을 파일로 저장 (MCP에서 사용할 수 있도록)
const outputFile = path.join(__dirname, '..', 'supabase', 'migrations', 'READY_TO_APPLY.sql')
fs.writeFileSync(outputFile, sql, 'utf8')
console.log(`💾 실행 준비된 SQL 파일: ${outputFile}\n`)

// 첫 500자 미리보기
console.log('📝 SQL 미리보기 (처음 500자):')
console.log('─'.repeat(50))
console.log(sql.substring(0, 500) + '...\n')

module.exports = { sql, statements }
