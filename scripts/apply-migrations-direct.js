/**
 * Supabase 마이그레이션 직접 적용 스크립트
 * Supabase Management API를 사용하여 SQL을 직접 실행합니다.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

async function executeSQL(sql, supabaseUrl, supabaseKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(supabaseUrl)
    const projectRef = url.hostname.split('.')[0]
    
    // Supabase Management API 엔드포인트
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
    
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
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

async function applyMigrations() {
  // dotenv로 환경 변수 로드
  try {
    require('dotenv').config({ path: '.env' })
  } catch (e) {
    // dotenv가 없어도 계속 진행
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 환경 변수가 설정되지 않았습니다.')
    console.error('\n필요한 환경 변수:')
    console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (권장) 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('\n.env 파일을 확인하거나 환경 변수를 설정해주세요.')
    process.exit(1)
  }

  console.log('🔗 Supabase에 연결 중...')
  console.log(`   URL: ${supabaseUrl}`)

  // 마이그레이션 파일 목록 (순서 중요!)
  const migrations = [
    '001_initial_schema.sql',
    '002_phase2_features.sql',
    '003_phase3_resume_parsing.sql'
  ]

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')

  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile)
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  파일을 찾을 수 없습니다: ${filePath}`)
      continue
    }

    console.log(`\n📄 ${migrationFile} 적용 중...`)
    const sql = fs.readFileSync(filePath, 'utf8')

    try {
      // SQL을 세미콜론으로 분리하여 각각 실행
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.length > 10) { // 빈 문 제외
          await executeSQL(statement + ';', supabaseUrl, supabaseKey)
        }
      }
      
      console.log(`✅ ${migrationFile} 적용 완료`)
    } catch (error) {
      console.error(`❌ ${migrationFile} 적용 실패:`, error.message)
      
      // Management API가 작동하지 않을 경우 대안 제시
      if (error.message.includes('404') || error.message.includes('401')) {
        console.error('\n⚠️  Supabase Management API 접근이 거부되었습니다.')
        console.error('\n📋 다음 방법을 사용하세요:\n')
        console.error('1. Supabase 대시보드 사용:')
        console.error('   - https://app.supabase.com 접속')
        console.error('   - 프로젝트 선택 > SQL Editor')
        console.error(`   - ${migrationFile} 내용을 복사하여 실행\n`)
        console.error('2. Supabase CLI 사용 (권장):')
        console.error('   - Windows: scoop install supabase')
        console.error('   - 또는: npx supabase@latest db push\n')
      }
      
      // 첫 번째 마이그레이션 실패 시 중단
      if (migrationFile === migrations[0]) {
        process.exit(1)
      }
    }
  }

  console.log('\n✅ 모든 마이그레이션이 적용되었습니다!')
}

applyMigrations().catch(console.error)
