'use client';

import { Sparkles, CheckCircle2, AlertTriangle, Loader2, FileSearch, ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';

interface MatchScoreSectionProps {
  candidate: {
    id: string;
    ai_score: number | null;
    ai_summary: string | null;
    ai_strengths: string[] | null;
    ai_weaknesses: string[] | null;
    ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
    parsed_data?: {
      match_score?: number;
    } | null;
  };
  hasResumeFile?: boolean; // 이력서 파일 존재 여부
}

/**
 * 점수에 따른 색상 및 평가 텍스트 반환
 */
function getScoreConfig(score: number) {
  if (score >= 80) {
    return {
      gradient: 'from-emerald-500 to-teal-500',
      badge: 'Excellent Fit',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    };
  } else if (score >= 60) {
    return {
      gradient: 'from-blue-500 to-indigo-500',
      badge: 'Good Potential',
      badgeColor: 'bg-blue-100 text-blue-700',
    };
  } else if (score >= 40) {
    return {
      gradient: 'from-amber-500 to-orange-500',
      badge: 'Consider',
      badgeColor: 'bg-amber-100 text-amber-700',
    };
  } else {
    return {
      gradient: 'from-rose-500 to-red-500',
      badge: 'Needs Review',
      badgeColor: 'bg-rose-100 text-rose-700',
    };
  }
}

/**
 * Skeleton 로딩 컴포넌트
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-indigo-200 rounded"></div>
        <div className="h-6 w-32 bg-indigo-200 rounded"></div>
      </div>
      <div className="flex items-center justify-center gap-8">
        <div className="w-32 h-32 bg-indigo-200 rounded-full"></div>
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-indigo-200 rounded w-3/4"></div>
          <div className="h-4 bg-indigo-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="text-center text-sm text-slate-500">
        <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
        Gemini AI가 JD와 이력서를 정밀 분석 중입니다...
      </div>
    </div>
  );
}

/**
 * Empty State 컴포넌트 (이력서 파일이 없을 때) - 스마트 가이드 UX
 */
function EmptyState() {
  const handleScrollToDocuments = () => {
    const documentsSection = document.getElementById('documents-section');
    if (documentsSection) {
      documentsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* 아이콘 영역 - Pulse 애니메이션 적용 */}
      <div className="relative mb-6">
        <div className="bg-white shadow-sm p-4 rounded-full">
          <div className="relative">
            <FileSearch className="w-10 h-10 text-indigo-400 animate-pulse" />
            <Sparkles className="w-5 h-5 text-indigo-500 absolute -top-1 -right-1 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 타이포그래피 */}
      <h3 className="text-indigo-900 font-semibold mb-2 text-center">
        AI 분석 대기 중
      </h3>
      <p className="text-indigo-700/70 text-sm mt-2 max-w-sm mx-auto text-center leading-relaxed">
        이력서를 업로드하면 AI 분석이 시작됩니다.
      </p>

      {/* 스마트 가이드 버튼 (Anchor Button) */}
      <Button
        onClick={handleScrollToDocuments}
        variant="ghost"
        className="text-indigo-600 hover:bg-indigo-100/50 mt-4 rounded-full px-4 py-2 text-sm font-medium transition-colors"
      >
        Documents 영역으로 이동
        <ChevronDown className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

/**
 * 프리미엄 AI Match Score 섹션 컴포넌트
 */
export function MatchScoreSection({ candidate, hasResumeFile = false }: MatchScoreSectionProps) {
  // 실제 AI 분석 점수만 사용 (더미 점수 완전 제거)
  const score = candidate.ai_score ?? null;
  const isActuallyProcessing = candidate.ai_analysis_status === 'processing';
  const isPending = candidate.ai_analysis_status === 'pending';
  const isFailed = candidate.ai_analysis_status === 'failed';
  const hasCompletedData = score !== null && candidate.ai_analysis_status === 'completed';

  // Empty State 조건: 이력서 파일이 없고, 분석 결과도 없는 경우
  const isEmptyState = !hasResumeFile && !hasCompletedData && !isActuallyProcessing && !isFailed;

  // Empty State 렌더링
  if (isEmptyState) {
    return (
      <div className="mb-6 bg-indigo-50/30 border-2 border-dashed border-indigo-100/70 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  // 실제로 분석 중인 경우만 로딩 표시
  if (isActuallyProcessing) {
    return (
      <div className="mb-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // 분석 실패한 경우
  if (isFailed) {
    return (
      <div className="mb-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
        </div>
        <div className="text-center py-8 text-slate-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-medium mb-1">AI 분석 중 오류가 발생했습니다.</p>
          <p className="text-xs text-slate-400">잠시 후 다시 시도해주세요.</p>
        </div>
      </div>
    );
  }

  // 분석 완료된 데이터가 있는 경우만 정상 렌더링
  if (!hasCompletedData || score === null) {
    // 파일이 업로드되었지만 분석이 완료되지 않은 경우
    if (hasResumeFile) {
      // pending 또는 null 상태인 경우 스켈레톤 UI 표시
      if (isPending || candidate.ai_analysis_status === null) {
        return (
          <div className="mb-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
            </div>
            <LoadingSkeleton />
          </div>
        );
      }
      // 기타 상태 (예상치 못한 상태)
      return (
        <div className="mb-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
          </div>
          <LoadingSkeleton />
        </div>
      );
    }
    // 파일이 없고 분석 결과도 없는 경우는 렌더링하지 않음 (이미 Empty State에서 처리됨)
    return null;
  }

  // 정상 데이터 렌더링
  const scoreConfig = getScoreConfig(score);
  const circumference = 2 * Math.PI * 56; // 반지름 56
  const offset = circumference * (1 - score / 100);

  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-blue-50/50 border border-indigo-100 rounded-xl p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-foreground">AI Match Insight</h3>
      </div>

      {/* 메인 콘텐츠: Grid Split View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* 좌측: Score 영역 */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-32 h-32 transform -rotate-90">
              {/* 배경 원 */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-slate-200"
              />
              {/* 프로그레스 원 */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={`url(#match-score-gradient-${candidate.id})`}
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id={`match-score-gradient-${candidate.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={scoreConfig.gradient.includes('emerald') ? '#10b981' : 
                                                scoreConfig.gradient.includes('blue') ? '#3b82f6' :
                                                scoreConfig.gradient.includes('amber') ? '#f59e0b' : '#ef4444'} />
                  <stop offset="100%" stopColor={scoreConfig.gradient.includes('emerald') ? '#14b8a6' : 
                                                  scoreConfig.gradient.includes('blue') ? '#6366f1' :
                                                  scoreConfig.gradient.includes('amber') ? '#f97316' : '#dc2626'} />
                </linearGradient>
              </defs>
            </svg>
            {/* 중앙 점수 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl font-bold text-foreground">{score}</span>
                <span className="text-lg text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>
          {/* 평가 뱃지 */}
          <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
            scoreConfig.badgeColor
          )}>
            {scoreConfig.badge}
          </span>
        </div>

        {/* 우측: Insights 영역 */}
        <div className="flex items-center">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/20 w-full">
            {candidate.ai_summary ? (
              <p className="text-slate-700 text-sm leading-relaxed italic">
                {candidate.ai_summary}
              </p>
            ) : (
              <p className="text-slate-500 text-sm">AI 요약이 제공되지 않았습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* 하단: Pros & Cons */}
      {(candidate.ai_strengths && candidate.ai_strengths.length > 0) || 
       (candidate.ai_weaknesses && candidate.ai_weaknesses.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-indigo-100">
          {/* Strengths */}
          {candidate.ai_strengths && candidate.ai_strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-foreground">강점</h4>
              </div>
              <ul className="space-y-2">
                {candidate.ai_strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {candidate.ai_weaknesses && candidate.ai_weaknesses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-semibold text-foreground">보완점</h4>
              </div>
              <ul className="space-y-2">
                {candidate.ai_weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
