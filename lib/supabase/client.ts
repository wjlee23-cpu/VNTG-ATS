import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Next.js 빌드/프리렌더 단계에서는 서버에서 먼저 렌더링을 시도할 수 있습니다.
  // 이때 Supabase 환경변수가 없으면(@supabase/ssr가 "required"로 throw) 빌드가 바로 실패하므로,
  // 브라우저가 아닐 때는 프록시를 반환해 “빌드는 통과”하고,
  // 실제로 auth 메서드를 호출하는 순간에 명확한 에러가 나도록 합니다.
  if (typeof window === 'undefined') {
    const err = new Error('Supabase 클라이언트는 브라우저에서만 생성됩니다. (빌드 환경 변수 확인 필요)');
    return new Proxy(
      {},
      {
        get() {
          throw err;
        },
      }
    ) as any;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.'
    );
  }

  // Supabase 스키마 타입이 실제 DB와 미세하게 달라도 빌드가 멈추지 않도록 제네릭 타입을 느슨하게 둡니다.
  return createBrowserClient<any>(supabaseUrl, supabaseAnonKey);
}
