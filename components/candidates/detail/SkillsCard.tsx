'use client';

import { Badge } from '@/components/ui/badge';

interface SkillsCardProps {
  skills: string[];
}

/** Skills 배지 목록 카드 */
export function SkillsCard({ skills }: SkillsCardProps) {
  if (skills.length === 0) return null;

  return (
    <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
      <h3 className="text-lg font-semibold text-foreground mb-4">Skills</h3>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, index) => (
          <Badge
            key={index}
            className="px-3 py-1.5 text-sm font-medium bg-primary/5 text-primary border-0 hover:bg-primary/10 transition-colors duration-200"
          >
            {skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}
