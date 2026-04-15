import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function patch(relPath) {
  const p = path.join(root, relPath);
  let s = fs.readFileSync(p, 'utf8');

  s = s.replace(
    /import \{ getDashboardStats, getRecentActivity, getTopCandidates, getPendingActions, getTodaySchedules, getPositionStatus \} from '@\/api\/queries\/dashboard';\r?\nimport \{ getHiringFunnel \} from '@\/api\/queries\/analytics';/,
    "import { getDashboardStats, getPendingActions, getTodaySchedules, getPositionStatus } from '@/api/queries/dashboard';\nimport { getHiringFunnel, getAnalyticsStats } from '@/api/queries/analytics';"
  );

  s = s.replace(
    /const statsResult = await getDashboardStats\(\);\r?\n  const recentActivityResult = await getRecentActivity\(\);\r?\n  const topCandidatesResult = await getTopCandidates\(1\);[^\n]*\r?\n  const pendingActionsResult = await getPendingActions\(\);/,
    'const statsResult = await getDashboardStats();\n  const analyticsStatsResult = await getAnalyticsStats();\n  const pendingActionsResult = await getPendingActions();'
  );

  s = s.replace(
    /const recentActivity = recentActivityResult\.data \|\| \[\];\r?\n  const topCandidates = topCandidatesResult\.data \|\| \[\];\r?\n  const pendingActions = pendingActionsResult\.data \|\| \[\];/,
    'const analyticsStats = analyticsStatsResult.data;\n  const pendingActions = pendingActionsResult.data || [];'
  );

  s = s.replace(
    /if \(recentActivityResult\.error\) \{\r?\n    console\.error\([^)]+\);\r?\n  \}\r?\n  if \(topCandidatesResult\.error\) \{\r?\n    console\.error\([^)]+\);\r?\n  \}\r?\n/,
    "if (analyticsStatsResult.error) {\n    console.error('\uBD84\uC11D \uC694\uC57D \uC870\uD68C \uC2E4\uD328:', analyticsStatsResult.error);\n  }\n"
  );

  s = s.replace(
    /stats=\{stats\}\r?\n      recentActivity=\{recentActivity\}\r?\n      topCandidates=\{topCandidates\}\r?\n      pendingActions=\{pendingActions\}/,
    'stats={stats}\n      pendingActions={pendingActions}'
  );

  s = s.replace(
    /hiringFunnel=\{hiringFunnel\}\r?\n      aiInsight=\{aiInsight\}\r?\n    \/>/,
    'hiringFunnel={hiringFunnel}\n      aiInsight={aiInsight}\n      confirmedHiresCount={analyticsStats?.confirmedHiresCount ?? 0}\n      averageTimeToHireDays={analyticsStats?.avgTimeToHire?.value ?? null}\n      timeToHireChangeDays={analyticsStats?.avgTimeToHire?.change ?? null}\n    />'
  );

  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', relPath);
}

patch('app/(dashboard)/page.tsx');
patch('app/dashboard/page.tsx');
