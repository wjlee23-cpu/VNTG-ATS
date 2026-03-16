'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Candidate } from '@/types/candidates';

interface CompensationCardProps {
  candidate: Candidate;
  showCompensation: boolean;
  onShowCompensationChange: (value: boolean) => void;
}

/** Compensation 카드 (View/Hide 토글) */
export function CompensationCard({
  candidate,
  showCompensation,
  onShowCompensationChange,
}: CompensationCardProps) {
  return (
    <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Compensation</h3>
        {showCompensation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShowCompensationChange(false)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <EyeOff className="w-4 h-4 mr-2" />
            Hide
          </Button>
        )}
      </div>
      <div>
        {!showCompensation ? (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Click to view sensitive data</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowCompensationChange(true)}
              className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Current</p>
              <p className="text-xl font-semibold text-foreground">
                {candidate.current_salary || 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Expected</p>
              <p className="text-xl font-semibold text-foreground">
                {candidate.expected_salary || 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
