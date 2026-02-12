/**
 * Supabase CLI를 사용하여 마이그레이션 적용
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// dotenv로 환경 변수 로드
try {
  require('dotenv').config({ path: '.env' })
} catch (e) {
  // dotenv가 없어도 계속 진행
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.')
  console.error('\n.env 파일에 다음을 추가하세요:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
  process.exit(1)
}

// URL에서 project-ref 추출
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
if (!urlMatch) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.')
  console.error(`   현재 URL: ${supabaseUrl}`)
  console.error('   예상 형식: https://your-project-ref.supabase.co')
  process.exit(1)
}

const projectRef = urlMatch[1]
console.log(`📦 프로젝트: ${projectRef}`)

// Supabase 프로젝트 연결
console.log('\n🔗 Supabase 프로젝트에 연결 중...')
try {
  // 비대화형 모드로 연결
  execSync(`npx supabase@latest link --project-ref ${projectRef} --password ${process.env.SUPABASE_DB_PASSWORD || ''}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
} catch (error) {
  console.error('\n⚠️  자동 연결 실패. 수동으로 연결이 필요할 수 있습니다.')
  console.error('\n다음 명령어를 실행하세요:')
  console.error(`   npx supabase@latest link --project-ref ${projectRef}`)
  console.error('\n또는 Supabase 대시보드에서 직접 SQL을 실행하세요.')
  process.exit(1)
}

// 마이그레이션 적용
console.log('\n📄 마이그레이션 적용 중...')
try {
  execSync('npx supabase@latest db push', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
  console.log('\n✅ 마이그레이션이 성공적으로 적용되었습니다!')
} catch (error) {
  console.error('\n❌ 마이그레이션 적용 실패')
  console.error('\n대안: Supabase 대시보드에서 직접 실행하세요:')
  console.error('   1. https://app.supabase.com 접속')
  console.error('   2. 프로젝트 선택 > SQL Editor')
  console.error('   3. supabase/migrations/ 폴더의 SQL 파일들을 순서대로 실행')
  process.exit(1)
}
