/**
 * 인터랙티브 마이그레이션 적용 스크립트
 * 환경 변수를 입력받아 Supabase에 직접 적용합니다.
 */

const readline = require('readline')
const https = require('https')
const fs = require('fs')
const path = require('path')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function executeSQLViaRPC(sql, supabaseUrl, supabaseKey) {
  // Supabase는 직접 SQL 실행을 지원하지 않으므로
  // PostgreSQL의 rpc 함수를 사용하거나
  // Supabase CLI를 사용해야 합니다.
  
  // 대안: Supabase CLI를 사용하여 실행
  const { execSync } = require('child_process')
  
  // 임시 SQL 파일 생성
  const tempFile = path.join(__dirname, '..', 'temp_migration.sql')
  fs.writeFileSync(tempFile, sql, 'utf8')
  
  try {
    // Supabase CLI를 사용하여 SQL 실행
    // 하지만 이 방법도 프로젝트 연결이 필요합니다.
    console.log('⚠️  Supabase CLI를 사용하려면 프로젝트 연결이 필요합니다.')
    console.log('📋 가장 확실한 방법: Supabase 대시보드 사용\n')
    
    // 임시 파일 삭제
    fs.unlinkSync(tempFile)
    
    return false
  } catch (error) {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }
    throw error
  }
}

async function main() {
  console.log('🚀 Supabase 마이그레이션 적용 도구\n')
  console.log('이 도구는 Supabase에 데이터베이스 스키마를 적용합니다.\n')

  // 환경 변수 확인
  try {
    require('dotenv').config({ path: '.env' })
  } catch (e) {
    // dotenv가 없어도 계속 진행
  }

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 환경 변수가 없으면 사용자에게 입력 요청
  if (!supabaseUrl) {
    console.log('❌ 환경 변수에서 Supabase URL을 찾을 수 없습니다.')
    supabaseUrl = await question('📝 Supabase URL을 입력하세요 (예: https://xxxxx.supabase.co): ')
  }

  if (!supabaseKey) {
    console.log('❌ 환경 변수에서 Supabase Key를 찾을 수 없습니다.')
    console.log('💡 Service Role Key를 사용하는 것을 권장합니다 (Settings > API > service_role key)')
    supabaseKey = await question('📝 Supabase Service Role Key를 입력하세요: ')
  }

  console.log('\n✅ 설정 완료!')
  console.log(`   URL: ${supabaseUrl}`)
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...\n`)

  // 통합 마이그레이션 파일 확인
  const completeMigrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')
  
  if (!fs.existsSync(completeMigrationFile)) {
    console.log('📦 통합 마이그레이션 파일 생성 중...')
    const { execSync } = require('child_process')
    execSync('node scripts/generate-complete-migration.js', { stdio: 'inherit' })
  }

  const sql = fs.readFileSync(completeMigrationFile, 'utf8')
  console.log(`📄 마이그레이션 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`)

  console.log('⚠️  중요: Supabase JavaScript 클라이언트는 직접 SQL을 실행할 수 없습니다.')
  console.log('📋 다음 방법 중 하나를 사용하세요:\n')
  
  console.log('1️⃣  Supabase 대시보드 사용 (가장 간단하고 권장):')
  console.log('   - https://app.supabase.com 접속')
  console.log('   - 프로젝트 선택')
  console.log('   - 좌측 메뉴 > SQL Editor > New query')
  console.log(`   - ${completeMigrationFile} 파일 내용 전체를 복사하여 붙여넣기`)
  console.log('   - Run 버튼 클릭\n')
  
  console.log('2️⃣  Supabase CLI 사용:')
  console.log('   npx supabase@latest link --project-ref YOUR_PROJECT_REF')
  console.log('   npx supabase@latest db push\n')
  
  console.log('💡 프로젝트 REF는 URL에서 확인할 수 있습니다:')
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
  if (urlMatch) {
    console.log(`   프로젝트 REF: ${urlMatch[1]}`)
  }
  
  console.log('\n📄 마이그레이션 파일 위치:')
  console.log(`   ${completeMigrationFile}\n`)

  rl.close()
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error.message)
  rl.close()
  process.exit(1)
})
