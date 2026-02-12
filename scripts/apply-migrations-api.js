/**
 * Supabase Management API를 사용하여 마이그레이션 적용
 * 환경 변수가 설정되어 있어야 합니다.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// dotenv로 환경 변수 로드
try {
  require('dotenv').config({ path: '.env' })
} catch (e) {
  // dotenv가 없어도 계속 진행
}

async function executeSQL(sql, supabaseUrl, accessToken) {
  return new Promise((resolve, reject) => {
    // Supabase URL에서 project-ref 추출
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
    if (!urlMatch) {
      reject(new Error('Invalid Supabase URL format'))
      return
    }
    
    const projectRef = urlMatch[1]
    
    // Supabase Management API를 사용하여 SQL 실행
    // 참고: 이 방법은 Supabase Management API의 실제 엔드포인트가 필요합니다
    // 현재는 Supabase가 직접 SQL 실행을 위한 공개 API를 제공하지 않으므로
    // Supabase CLI나 대시보드를 사용해야 합니다.
    
    console.log('⚠️  Supabase Management API는 직접 SQL 실행을 지원하지 않습니다.')
    console.log('📋 다음 방법 중 하나를 사용하세요:\n')
    console.log('1. Supabase 대시보드 사용 (가장 간단):')
    console.log('   - https://app.supabase.com 접속')
    console.log('   - 프로젝트 선택 > SQL Editor > New query')
    console.log('   - supabase/migrations/COMPLETE_MIGRATION.sql 파일 내용 복사하여 실행\n')
    
    console.log('2. Supabase CLI 사용:')
    console.log('   npx supabase@latest link --project-ref YOUR_PROJECT_REF')
    console.log('   npx supabase@latest db push\n')
    
    reject(new Error('Direct SQL execution not supported via API'))
  })
}

async function applyMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 환경 변수가 설정되지 않았습니다.')
    console.error('\n필요한 환경 변수:')
    console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (권장) 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('\n.env 파일을 확인하거나 환경 변수를 설정해주세요.')
    console.error('\n📋 대안: Supabase 대시보드에서 직접 실행')
    console.error('   supabase/migrations/COMPLETE_MIGRATION.sql 파일을 사용하세요.')
    process.exit(1)
  }

  console.log('🔗 Supabase에 연결 중...')
  console.log(`   URL: ${supabaseUrl}`)

  // 통합 마이그레이션 파일 읽기
  const completeMigrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')
  
  if (!fs.existsSync(completeMigrationFile)) {
    console.error('❌ 통합 마이그레이션 파일을 찾을 수 없습니다.')
    console.error('   먼저 scripts/generate-complete-migration.js를 실행하세요.')
    process.exit(1)
  }

  const sql = fs.readFileSync(completeMigrationFile, 'utf8')
  
  try {
    await executeSQL(sql, supabaseUrl, supabaseKey)
    console.log('✅ 마이그레이션이 성공적으로 적용되었습니다!')
  } catch (error) {
    console.error('❌ 마이그레이션 적용 실패:', error.message)
    console.error('\n📋 Supabase 대시보드를 사용하여 수동으로 적용하세요:')
    console.error(`   파일: ${completeMigrationFile}`)
    process.exit(1)
  }
}

applyMigrations().catch(console.error)
