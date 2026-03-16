import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const env = process.env;
const keys = Object.keys(env).filter(k => 
  k.includes('SUPABASE') || 
  k.includes('DB') || 
  k.includes('POSTGRES') ||
  k.includes('DATABASE')
);

console.log('관련 환경 변수:');
keys.forEach(k => {
  const value = env[k];
  if (value) {
    const displayValue = k.includes('PASSWORD') || k.includes('KEY') || k.includes('SECRET')
      ? value.substring(0, 10) + '...'
      : value;
    console.log(`  ${k}: ${displayValue}`);
  } else {
    console.log(`  ${k}: (없음)`);
  }
});
