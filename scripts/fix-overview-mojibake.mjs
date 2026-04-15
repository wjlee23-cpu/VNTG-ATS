import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '..', 'app', '(dashboard)', 'OverviewClient.tsx');
let s = fs.readFileSync(p, 'utf8');

// '더' + any single char + '우기' -> full label
s = s.replace(/ : '더.우기'\}/, " : '\uB354\uBBF8 \uCC44\uC6B0\uAE30'}");

// Hero button text (line may start with garbage bytes)
s = s.replace(/\n[^\S\n]*[^\n]*\uC158 \uCC98\uB9AC\uD558\uAE30\s*\n/, '\n              \uAE34\uAE09 \uC561\uC158 \uCC98\uB9AC\uD558\uAE30\n');

// 4th KPI: prefix before "리드타임"
s = s.replace(
  /(<p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider flex items-center gap-1\.5 relative">\s*\n)[^\n]*(\uB9AC\uB4DC\uD0C0\uC784 <Info)/,
  '$1              \uD3C9\uADE0 $2'
);

// Funnel stage label (was broken)
s = s.replace(
  /\{ key: 'final', label: '[^']*', count: finalCombined \}/,
  "{ key: 'final', label: '\uC624\uD37C \u00B7 \uC785\uC0AC', count: finalCombined }"
);

// Funnel card title
s = s.replace(
  /(<h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">)[^<]+(<\/h2>\s*\n\s*<span className="text-xs font-bold text-indigo-600)/,
  '$1\uCC44\uC6A9 \uD37C\uB110$2'
);

// Urgent badge
s = s.replace(
  /(\{urgent && \(\s*<span className="text-\[10px\] font-bold text-red-500 bg-red-50 px-1\.5 py-0\.5 rounded shrink-0">\s*\n\s*)[^<]+(<\/span>)/,
  '$1\uAE34\uAE09$2'
);

s = s.replace(/\uB4F1\uB85D\uB41C \uD3EC\uC9C0\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4\.\./g, '\uB4F1\uB85D\uB41C \uD3EC\uC9C0\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
s = s.replace(/\uC624\uB298 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4\.\./g, '\uC624\uB298 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');

fs.writeFileSync(p, s, 'utf8');
console.log('OverviewClient mojibake fixes applied');
