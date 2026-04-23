/**
 * Activity Timeline 스레드/인용 마이그레이션 직접 적용
 * - supabase/migrations/20260423120000_activity_timeline_threads_quotes.sql 전체를 한 번에 실행 (DO $$ 블록 보존)
 * - DATABASE_URL 우선, 없으면 SUPABASE_DB_PASSWORD + pooler 연결 시도
 */

import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrlRaw = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
let databaseUrl = databaseUrlRaw?.trim().replace(/^["']|["']$/g, '');
if (databaseUrl?.startsWith('postgres://')) {
  databaseUrl = databaseUrl.replace('postgres://', 'postgresql://');
}

let dbPassword =
  process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;
if (!dbPassword && databaseUrl) {
  const urlMatch = databaseUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
  if (urlMatch) dbPassword = decodeURIComponent(urlMatch[1]);
}

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 필요합니다.');
  process.exit(1);
}

async function connectWithConnectionString(connectionString: string, label: string): Promise<import('pg').Client> {
  const { Client } = await import('pg');
  const needsSSL =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('.supabase.co');

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 25000,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log(`${label}\n`);
  return client;
}

/** connectionString이 pg에서 Invalid URL이면 호스트/유저/비밀번호 개별 연결로 재시도 */
async function connectFromDatabaseUrl(url: string): Promise<import('pg').Client | null> {
  const { Client } = await import('pg');
  const needsSSL =
    url.includes('sslmode=require') ||
    url.includes('pooler.supabase.com') ||
    url.includes('.supabase.co');

  try {
    return await connectWithConnectionString(url, '✅ DATABASE_URL로 PostgreSQL 연결 성공');
  } catch (first: unknown) {
    const msg = first instanceof Error ? first.message : String(first);
    if (!msg.includes('Invalid URL')) {
      console.warn('⚠️ DATABASE_URL 연결 실패:', msg);
      return null;
    }
  }

  try {
    const match = url.match(
      /^postgresql?:\/\/(?:([^:@]+)(?::([^@]*))?@)?([^:\/]+)(?::(\d+))?(?:\/([^?]+))?(?:\?(.+))?$/,
    );
    if (!match) {
      console.warn('⚠️ DATABASE_URL을 파싱할 수 없습니다.');
      return null;
    }
    const [, user, password, host, portStr, database, queryParams] = match;
    const port = portStr ? parseInt(portStr, 10) : 5432;
    const dbName = database || 'postgres';
    const hasSSLMode = queryParams?.includes('sslmode=require');
    const finalNeedsSSL = needsSSL || Boolean(hasSSLMode);

    const client = new Client({
      host: host!,
      port,
      user: user || 'postgres',
      password: password ?? '',
      database: dbName,
      connectionTimeoutMillis: 25000,
      ssl: finalNeedsSSL ? { rejectUnauthorized: false } : undefined,
    });
    await client.connect();
    console.log('✅ DATABASE_URL 파싱 후 개별 필드로 PostgreSQL 연결 성공\n');
    return client;
  } catch (e: unknown) {
    console.warn('⚠️ DATABASE_URL(파싱 재시도) 연결 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function connectPg(): Promise<import('pg').Client | null> {
  if (databaseUrl) {
    const c = await connectFromDatabaseUrl(databaseUrl);
    if (c) return c;
  }

  if (!dbPassword) {
    return null;
  }

  const urlMatch = supabaseUrl!.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) return null;

  const projectRef = urlMatch[1];
  const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];
  /** 세션 풀러(5432) — DDL 권장. 트랜잭션 풀러(6543)는 실패 시 보조 */
  const ports = [5432, 6543];

  for (const region of regions) {
    for (const port of ports) {
      try {
        const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:${port}/postgres?sslmode=require`;
        return await connectWithConnectionString(
          connectionString,
          `✅ Supabase pooler 연결 성공 (리전 ${region}, 포트 ${port})`,
        );
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function main() {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20260423120000_activity_timeline_threads_quotes.sql',
  );
  const sql = readFileSync(migrationPath, 'utf-8');
  console.log('📄 마이그레이션 파일:', migrationPath);
  console.log('');

  const client = await connectPg();
  if (!client) {
    console.error('❌ PostgreSQL에 연결할 수 없습니다.');
    console.error('   .env.local에 DATABASE_URL 또는 SUPABASE_DB_PASSWORD를 설정한 뒤 다시 실행하세요.');
    process.exit(1);
  }

  try {
    console.log('📝 SQL 실행 중...\n');
    await client.query(sql);
    console.log('✨ 마이그레이션 적용 완료: comments 스레드 컬럼 + timeline_events.activity_quote\n');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ 실행 실패:', msg);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
