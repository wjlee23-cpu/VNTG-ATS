import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const origPath = path.join(root, '_overview_orig.tsx');
const targetPath = path.join(root, 'app/(dashboard)/OverviewClient.tsx');

const o = fs.readFileSync(origPath, 'utf8');
let c = fs.readFileSync(targetPath, 'utf8');

const ol = o.split(/\r?\n/);

function sliceByLineComment(startNeedle, endCommentPrefix) {
  const a = ol.findIndex((l) => l.includes(startNeedle));
  const b = ol.findIndex((l, i) => i > a && l.trimStart().startsWith(endCommentPrefix));
  if (a < 0 || b < 0) throw new Error(`slice fail ${startNeedle} -> ${endCommentPrefix}`);
  return ol.slice(a, b).join('\n');
}

function sliceUntilConst(startNeedle, nextConstLineIncludes) {
  const a = ol.findIndex((l) => l.includes(startNeedle));
  const b = ol.findIndex(
    (l, i) => i > a && l.trim().startsWith('const ') && l.includes(nextConstLineIncludes)
  );
  if (a < 0 || b < 0) throw new Error(`slice fail ${startNeedle} -> const ${nextConstLineIncludes}`);
  return ol.slice(a, b).join('\n');
}

const seed = sliceByLineComment('const handleSeedData = async () =>', '// 시간 포');
const interview = sliceUntilConst('const getInterviewTypeText = (type?: string) => {', 'getActionIcon');

c = c.replace(/  const handleSeedData = async \(\) => \{[\s\S]*?  \};\n\n  const formatTime/, seed + '\n\n  const formatTime');
c = c.replace(
  /  const getInterviewTypeText[\s\S]*?  \};\n\n  const getActionIcon/,
  interview + '\n\n  const getActionIcon'
);

fs.writeFileSync(targetPath, c, 'utf8');
console.log('Patched handleSeedData + getInterviewTypeText');
