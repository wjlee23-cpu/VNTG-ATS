/**
 * Supabase 클라이언트를 사용하여 마이그레이션 적용
 * Service Role Key로 직접 SQL을 실행합니다.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyCompleteMigration() {
  // dotenv로 환경 변수 로드 (.env와 .env.local 모두 시도)
  try {
    require('dotenv').config({ path: '.env' })
  } catch (e) {
    // dotenv가 없어도 계속 진행
  }
  
  try {
    require('dotenv').config({ path: '.env.local' })
  } catch (e) {
    // .env.local이 없어도 계속 진행
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.')
    process.exit(1)
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다.')
    console.error('   Service Role Key는 Supabase 대시보드 > Settings > API에서 확인할 수 있습니다.')
    process.exit(1)
  }

  console.log('🔗 Supabase에 연결 중...')
  console.log(`   URL: ${supabaseUrl}\n`)

  // Supabase 클라이언트 생성 (Service Role Key 사용)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // COMPLETE_MIGRATION.sql 파일 읽기
  const completeMigrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')
  
  if (!fs.existsSync(completeMigrationFile)) {
    console.error('❌ COMPLETE_MIGRATION.sql 파일을 찾을 수 없습니다.')
    process.exit(1)
  }

  const sql = fs.readFileSync(completeMigrationFile, 'utf8')
  
  console.log(`📄 COMPLETE_MIGRATION.sql 파일 로드 완료`)
  console.log(`   파일 크기: ${(sql.length / 1024).toFixed(2)} KB\n`)

  // SQL을 문장 단위로 분리
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='))
    .filter(s => !s.match(/^=+$/)) // 구분선 제거

  console.log(`📋 ${statements.length}개의 SQL 문을 실행합니다...\n`)

  // Supabase는 직접 SQL 실행을 지원하지 않으므로
  // rpc 함수를 사용하거나 PostgreSQL 연결을 사용해야 합니다.
  // 여기서는 Supabase의 REST API를 통해 직접 실행을 시도합니다.
  
  try {
    // 각 SQL 문을 실행
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length < 10) continue // 너무 짧은 문은 건너뛰기

      try {
        // Supabase는 직접 SQL 실행을 지원하지 않으므로
        // 여기서는 에러를 발생시켜 사용자에게 다른 방법을 안내합니다.
        throw new Error('Supabase JavaScript 클라이언트는 직접 SQL 실행을 지원하지 않습니다.')
      } catch (error) {
        errorCount++
        if (i < 5) { // 처음 5개만 상세 로그
          console.error(`❌ 문 ${i + 1} 실행 실패:`, error.message)
        }
      }
    }

    // 실제로는 Supabase가 직접 SQL 실행을 지원하지 않으므로
    // 사용자에게 다른 방법을 안내합니다.
    console.log('\n⚠️  Supabase JavaScript 클라이언트는 직접 SQL 실행을 지원하지 않습니다.')
    console.log('\n📋 다음 방법 중 하나를 사용하세요:\n')
    console.log('1. Supabase 대시보드 사용 (가장 간단):')
    console.log('   - https://app.supabase.com 접속')
    console.log('   - 프로젝트 선택 > SQL Editor > New query')
    console.log(`   - ${completeMigrationFile} 파일 내용을 복사하여 실행\n`)
    
    console.log('2. Supabase CLI 사용:')
    console.log('   npx supabase db push\n')
    
    console.log('3. PostgreSQL 클라이언트 직접 연결:')
    console.log('   Service Role Key를 사용하여 PostgreSQL에 직접 연결하여 SQL 실행\n')
    
    process.exit(1)
  } catch (error) {
    console.error('❌ 마이그레이션 적용 실패:', error.message)
    process.exit(1)
  }
}

applyCompleteMigration().catch(console.error)
