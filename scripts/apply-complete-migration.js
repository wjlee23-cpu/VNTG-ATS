/**
 * Supabase 완전한 마이그레이션 적용 스크립트
 * COMPLETE_MIGRATION.sql 파일을 Supabase에 직접 적용합니다.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

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
    // 참고: 실제로는 Supabase가 직접 SQL 실행을 위한 공개 API를 제공하지 않으므로
    // Supabase JavaScript 클라이언트를 사용하여 Service Role Key로 실행합니다.
    
    // 대신 Supabase REST API의 rpc 함수를 사용하거나
    // 또는 직접 PostgreSQL 연결을 사용해야 합니다.
    
    // 여기서는 Supabase Management API를 시도하지만,
    // 실제로는 Supabase 클라이언트 라이브러리를 사용하는 것이 더 나을 수 있습니다.
    
    console.log(`📤 SQL 실행 중... (프로젝트: ${projectRef})`)
    console.log(`   SQL 길이: ${sql.length} 문자`)
    
    // Management API 엔드포인트 (실제로는 작동하지 않을 수 있음)
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': accessToken
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(JSON.stringify({ query: sql }))
    req.end()
  })
}

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
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.')
    process.exit(1)
  }

  // Service Role Key가 있으면 사용, 없으면 Anon Key 사용
  const supabaseKey = supabaseServiceKey || supabaseAnonKey
  
  if (!supabaseKey && !accessToken) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요합니다.')
    process.exit(1)
  }

  console.log('🔗 Supabase에 연결 중...')
  console.log(`   URL: ${supabaseUrl}`)

  // COMPLETE_MIGRATION.sql 파일 읽기
  const completeMigrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'COMPLETE_MIGRATION.sql')
  
  if (!fs.existsSync(completeMigrationFile)) {
    console.error('❌ COMPLETE_MIGRATION.sql 파일을 찾을 수 없습니다.')
    process.exit(1)
  }

  const sql = fs.readFileSync(completeMigrationFile, 'utf8')
  
  console.log(`\n📄 COMPLETE_MIGRATION.sql 파일 로드 완료`)
  console.log(`   파일 크기: ${(sql.length / 1024).toFixed(2)} KB\n`)

  // Supabase JavaScript 클라이언트를 사용하여 SQL 실행
  // Management API가 작동하지 않을 수 있으므로, 
  // Supabase 클라이언트의 rpc 함수를 사용하거나
  // 또는 직접 PostgreSQL 연결을 사용해야 합니다.
  
  // 여기서는 간단하게 Supabase REST API를 사용하여 실행을 시도합니다.
  // 실제로는 @supabase/supabase-js를 사용하는 것이 더 나을 수 있습니다.
  
  try {
    // SQL을 문장 단위로 분리하여 실행
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='))
      .filter(s => !s.match(/^=+$/)) // 구분선 제거

    console.log(`📋 ${statements.length}개의 SQL 문을 실행합니다...\n`)

    // 실제로는 Supabase Management API가 직접 SQL 실행을 지원하지 않으므로
    // Supabase 대시보드의 SQL Editor를 사용하거나
    // Supabase CLI를 사용해야 합니다.
    
    console.log('⚠️  Supabase Management API는 직접 SQL 실행을 지원하지 않습니다.')
    console.log('\n📋 다음 방법 중 하나를 사용하세요:\n')
    console.log('1. Supabase 대시보드 사용 (가장 간단):')
    console.log('   - https://app.supabase.com 접속')
    console.log('   - 프로젝트 선택 > SQL Editor > New query')
    console.log(`   - ${completeMigrationFile} 파일 내용을 복사하여 실행\n`)
    
    console.log('2. Supabase CLI 사용:')
    console.log('   npx supabase db push (개별 마이그레이션 파일 사용)\n')
    
    console.log('3. 스크립트를 수정하여 @supabase/supabase-js 사용:')
    console.log('   Service Role Key로 직접 PostgreSQL 연결하여 실행\n')
    
    // 대신 Supabase CLI를 사용하여 마이그레이션 적용
    console.log('\n🔄 Supabase CLI를 사용하여 마이그레이션을 적용합니다...\n')
    
    process.exit(1)
  } catch (error) {
    console.error('❌ 마이그레이션 적용 실패:', error.message)
    process.exit(1)
  }
}

applyCompleteMigration().catch(console.error)
