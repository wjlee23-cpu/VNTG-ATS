import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../app/(dashboard)/OverviewClient.tsx');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /console\.error\('[^']*',\s*error\)/,
  "console.error('\uC0AC\uC6A9\uC790 \uD504\uB85C\uD544 \uB85C\uB4DC \uC2E4\uD328:', error)"
);

const hero = `                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-1">
                  {aiInsight?.trim() ? (
                    aiInsight
                  ) : (
                    <>
                      \uC774\uBC88 \uC8FC \uCC44\uC6A9 \uB9AC\uB4DC\uD0C0\uC784\uC774 \uC9C0\uB09C\uC8FC \uB300\uBE44{' '}
                      <span className="text-indigo-600">
                        {useRealTth && displayTthChange !== 0
                          ? \`\${Math.abs(displayTthChange).toFixed(1)}\uC77C \${displayTthChange < 0 ? '\uB2E8\uCD95' : '\uC99D\uAC00'}\`
                          : '1.2\uC77C \uB2E8\uCD95'}
                      </span>
                      \uB418\uC5C8\uC2B5\uB2C8\uB2E4.
                    </>
                  )}
                </h1>
                <p className="text-sm text-neutral-500 font-medium">
                  \uC624\uB298 \uAE34\uAE09\uD558\uAC8C \uCC98\uB9AC\uD574\uC57C \uD560 \uC11C\uB958 \uAC80\uD1A0\uAC00 {resumeReviewWaiting}\uAC74 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4.
                </p>`;

c = c.replace(/\s*<h1 className="text-2xl[\s\S]*?<\/p>\s*\n\s*\{userRole/, `\n${hero}\n                {userRole`);

const btn = ` \uAE34\uAE09 \uC561\uC158 \uCC98\uB9AC\uD558\uAE30`;
c = c.replace(/\n[^\n]*\uC561\uC158 \uCC98\uB9AC\uD558\uAE30[^\n]*/, `\n            ${btn}`);

c = c.replace(
  /: '\uB354\uBBF8 \uB370\uC774\uD130\uB85C[^\n]*'/,
  ": '\uB354\uBBF8 \uB370\uC774\uD130\uB85C \uCC44\uC6B0\uAE30'"
);

c = c.replace(/uppercase tracking-w[^\n]*\uC9C0\uC6D0<\/p>/, 'uppercase tracking-wider">\uC2E0\uADDC \uC9C0\uC6D0</p>');
c = c.replace(/uppercase tracking-w[^\n]*\uC9C4\uD589<\/p>/, 'uppercase tracking-wider">\uBA74\uC811 \uC9C4\uD589</p>');
c = c.replace(/\uC624[^\n]*\uBC1C\uC1A1<\/p>/, '\uC624\uD37C \uBC1C\uC1A1</p>');
c = c.replace(/\n\s*\uD3C9[^\n]*\uB9AC\uB4DC\uD0C0\uC784/m, '\n              \uD3C9\uADE0 \uB9AC\uB4DC\uD0C0\uC784');

c = c.replace(/label: '\uBA74[^\n]*\uC9C4\uD589'/, "label: '\uBA74\uC811 \uC9C4\uD589'");
c = c.replace(/label: '\uCD5C[^\n]*\uACBD'/, "label: '\uCD5C\uC885 \uD569\uACA9'");

c = c.replace(/>진행[^\n]*<\/th>/, '>\uC9C4\uD589\uB960</th>');
c = c.replace(/\uB4F1\uB85D\uB41C \uD3EC\uC9C0[^\n]*\uC5C6\uC2B5\uB2C8\uB2E4/, '\uB4F1\uB85D\uB41C \uD3EC\uC9C0\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');

c = c.replace(/uppercase tracking-w[^\n]*\uC77C\uC815<\/h2>/, 'uppercase tracking-wider">\uC624\uB298\uC758 \uC561\uC158 \uBC0F \uC77C\uC815</h2>');

c = c.replace(/>\uAE34\uAE09</, '>\uAE34\uAE09<'); // badge
c = c.replace(/\uC624[^\n]*\uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4/, '\uC624\uB298 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');

c = c.replace(/uppercase tracking-w[^\n]*\uD37C\uB12C/, 'uppercase tracking-wider">\uCC44\uC6A9 \uC804\uD658 \uD37C\uB12C</h2>');
c = c.replace(/\uCD5C\uC885 \uC804\uD658[^\n]*%/, '\uCD5C\uC885 \uC804\uD658\uC728 {finalConversionPct}%');

c = c.replace(
  /const leadSummary = `\$\{bottleneckStage\.label\}[^`]+`;/,
  "const leadSummary = `\${bottleneckStage.label} \uAD6C\uAC04\uC5D0\uC11C \uAC00\uC7A5 \uC624\uB798 \uAC78\uB9BD\uB2C8\uB2E4.`;"
);

fs.writeFileSync(p, c, 'utf8');
console.log('fixed hero and labels');
