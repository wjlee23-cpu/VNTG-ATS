import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Supabase 스키마 타입이 실제 DB와 미세하게 달라도 빌드가 멈추지 않도록 제네릭 타입을 느슨하게 둡니다.
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
