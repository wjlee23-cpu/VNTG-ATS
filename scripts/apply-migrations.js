/**
 * Supabase 마이그레이션 적용 스크립트
 * 
 * 사용법:
 * node scripts/apply-migrations.js
 * 
 * 환경 변수 필요:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 환경 변수가 설정되지 않았습니다.')
    console.error('필요한 환경 변수:')
    console.error('  - NEXT_PUBLIC_SUPABASE_URL')
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    console.error('\n.env 파일을 확인하거나 환경 변수를 설정해주세요.')
    process.exit(1)
  }

  console.log('🔗 Supabase에 연결 중...')
  const supabase = createClient(supabaseUrl, supabaseKey)

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
      // Supabase는 직접 SQL 실행을 지원하지 않으므로, 
      // 각 SQL 문을 분리하여 실행해야 합니다.
      // 하지만 더 나은 방법은 Supabase Management API를 사용하는 것입니다.
      
      // 대신 사용자에게 Supabase 대시보드에서 실행하도록 안내
      console.log(`\n⚠️  Supabase JavaScript 클라이언트는 직접 SQL을 실행할 수 없습니다.`)
      console.log(`\n📋 다음 방법 중 하나를 사용하세요:\n`)
      console.log(`1. Supabase 대시보드 사용:`)
      console.log(`   - https://app.supabase.com 접속`)
      console.log(`   - 프로젝트 선택 > SQL Editor`)
      console.log(`   - ${migrationFile} 내용을 복사하여 실행\n`)
      
      console.log(`2. Supabase CLI 사용:`)
      console.log(`   npm install -g supabase`)
      console.log(`   supabase link --project-ref YOUR_PROJECT_REF`)
      console.log(`   supabase db push\n`)
      
      break
    } catch (error) {
      console.error(`❌ ${migrationFile} 적용 실패:`, error.message)
      process.exit(1)
    }
  }

  console.log('\n✅ 마이그레이션 가이드가 출력되었습니다.')
}

// 환경 변수 로드 (dotenv 사용)
try {
  require('dotenv').config({ path: '.env' })
} catch (e) {
  // dotenv가 없어도 계속 진행
}

applyMigrations().catch(console.error)
