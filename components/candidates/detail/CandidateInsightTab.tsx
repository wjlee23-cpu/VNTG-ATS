'use client';

import { Sparkles, ThumbsUp, AlertTriangle, MessageSquareText, Loader2 } from 'lucide-react';
import type { Candidate, AiInterviewQuestionItem } from '@/types/candidates';
import { getScoreBadge } from './candidate-ai-badge';

interface CandidateInsightTabProps {
  candidate: Candidate;
  /** 프로필 탭 첨부 개수 — 공고 없음/대기 상태 안내에 사용 */
  resumeFileCount?: number;
  /** 이력서 업로드 직후·Gemini 분석 중 */
  isResumeAiAnalyzing?: boolean;
}

function normalizeInterviewQuestions(raw: Candidate['ai_interview_questions']): AiInterviewQuestionItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const q = (item as { question?: string }).question;
      if (!q || typeof q !== 'string') return null;
      const intent = (item as { intent?: string }).intent;
      return { question: q, intent: typeof intent === 'string' ? intent : undefined };
    })
    .filter(Boolean) as AiInterviewQuestionItem[];
}

function hasLinkedJobPost(candidate: Candidate): boolean {
  const id = candidate.job_post_id;
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * JD 매칭 요약 문단: DB 요약이 없을 때 상태·공고·첨부 여부에 맞는 안내
 */
function resolveJdMatchFallbackText(
  candidate: Candidate,
  resumeFileCount: number | undefined,
): string {
  const status = candidate.ai_analysis_status ?? null;

  if (!hasLinkedJobPost(candidate)) {
    return '이 후보자에게 채용 공고가 연결되어 있지 않아 JD 매칭 분석을 실행할 수 없습니다. 프로필에서 지원 공고를 지정한 뒤 첨부 파일을 다시 업로드하거나 분석을 실행해 주세요.';
  }

  if (status === 'processing') {
    return 'AI 분석이 진행 중입니다. 완료되면 이 화면에 점수와 요약이 표시됩니다.';
  }

  if (status === 'pending') {
    if (resumeFileCount !== undefined && resumeFileCount > 0) {
      return '첨부 파일은 있으나 분석 결과가 아직 반영되지 않았습니다. 잠시 후 다시 열어보거나, 업로드가 끝난 뒤에도 계속되면 서버 로그를 확인해 주세요.';
    }
    return 'AI 분석 대기 중입니다. 이력서·경력기술서 등 PDF/DOC/DOCX를 업로드하면 분석이 시작됩니다.';
  }

  if (status === 'failed') {
    return candidate.ai_summary?.trim()
      ? candidate.ai_summary.trim()
      : 'AI 분석에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.';
  }

  return 'AI 분석 결과가 아직 없습니다. 이력서를 업로드하면 분석이 시작됩니다.';
}

/** AI Insight 탭 — JD 매칭, 강약점, Gemini 추천 면접 질문 */
export function CandidateInsightTab({
  candidate,
  resumeFileCount,
  isResumeAiAnalyzing = false,
}: CandidateInsightTabProps) {
  const score = candidate.ai_score ?? null;
  const summaryTrimmed = (candidate.ai_summary || '').trim();
  const strengths = candidate.ai_strengths || [];
  const weaknesses = candidate.ai_weaknesses || [];
  const badge = getScoreBadge(score);
  const interviewQs = normalizeInterviewQuestions(candidate.ai_interview_questions);
  const status = candidate.ai_analysis_status ?? null;
  const insightLoading = isResumeAiAnalyzing || status === 'processing';

  const hasSummary = summaryTrimmed.length > 0;
  const jdBody = hasSummary ? summaryTrimmed : resolveJdMatchFallbackText(candidate, resumeFileCount);

  const jdToneClass =
    status === 'failed'
      ? 'text-amber-900/90'
      : !hasSummary && !hasLinkedJobPost(candidate)
        ? 'text-amber-900/90'
        : !hasSummary && (status === 'processing' || status === 'pending')
          ? 'text-blue-900/80'
          : 'text-neutral-600';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white relative">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-8">
        {insightLoading ? (
          <div
            className="mb-6 flex items-center gap-3 rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/70 to-blue-50/60 px-4 py-3 text-sm text-indigo-900/90 shadow-[0_8px_28px_-12px_rgba(37,99,235,0.18)]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600" aria-hidden />
            <span>Gemini가 JD 매칭 분석을 진행 중입니다. 완료되면 점수·요약·강약점이 표시됩니다.</span>
          </div>
        ) : null}

        {/* Grid: flex 대신 1열이 남은 폭을 확실히 가져가도록 minmax(0,1fr) 사용 */}
        <div
          className={`mb-8 grid grid-cols-1 gap-6 rounded-xl border bg-[#FCFCFC] p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-8 ${
            insightLoading
              ? 'border-indigo-100/90 shadow-[0_8px_30px_-10px_rgba(37,99,235,0.12)]'
              : 'border-neutral-200'
          }`}
        >
          <div className="flex flex-col items-center justify-center border-b border-neutral-200 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8">
            {insightLoading ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" aria-hidden />
                <span className="text-xs font-medium text-indigo-600/90">분석 중</span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tighter text-neutral-900">{score ?? '—'}</span>
                  {score !== null && <span className="text-lg font-medium text-neutral-400">/100</span>}
                </div>
                {badge && (
                  <div className={`mt-3 ${badge.className}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                    {badge.text}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="min-w-0 max-w-full">
            <div className="mb-2 flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
              <span className="text-sm font-semibold leading-snug text-neutral-900">AI JD Match Analysis</span>
            </div>
            <p
              className={`text-sm leading-relaxed [overflow-wrap:anywhere] ${insightLoading ? 'animate-pulse text-indigo-800/70' : jdToneClass}`}
            >
              {insightLoading
                ? '분석이 끝나면 JD 대비 적합도 요약이 이곳에 표시됩니다.'
                : jdBody}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              강점 (Strengths)
            </h4>
            {insightLoading ? (
              <ul className="space-y-3" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <li key={i} className="h-4 rounded-md bg-indigo-100/50 animate-pulse" style={{ width: `${88 - i * 12}%` }} />
                ))}
              </ul>
            ) : strengths.length > 0 ? (
              <ul className="space-y-4">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 shrink-0" />
                    <p className="text-sm text-neutral-600 leading-relaxed">{strength}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">강점 정보가 없습니다.</p>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              보완점 (Gaps)
            </h4>
            {insightLoading ? (
              <ul className="space-y-3" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <li key={i} className="h-4 rounded-md bg-blue-100/50 animate-pulse" style={{ width: `${82 - i * 10}%` }} />
                ))}
              </ul>
            ) : weaknesses.length > 0 ? (
              <ul className="space-y-4">
                {weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 shrink-0" />
                    <p className="text-sm text-neutral-600 leading-relaxed">{weakness}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">보완점 정보가 없습니다.</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
            <MessageSquareText className="h-4 w-4 text-indigo-500" />
            Gemini 추천 면접 질문
          </h4>
          {interviewQs.length > 0 ? (
            <div className="space-y-3">
              {interviewQs.map((item, i) => (
                <div key={i} className="p-4 rounded-lg bg-[#FCFCFC] border border-neutral-200">
                  <p className="text-sm font-semibold text-neutral-900 mb-1">{item.question}</p>
                  {item.intent ? <p className="text-xs text-neutral-500">의도: {item.intent}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`p-4 rounded-lg border text-sm ${
                insightLoading
                  ? 'border-indigo-100 bg-indigo-50/40 flex items-center gap-2 text-indigo-900/85'
                  : 'border-amber-100 bg-amber-50/50 text-amber-900/80'
              }`}
            >
              {insightLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" aria-hidden />
                  면접 질문은 분석이 완료되면 표시됩니다.
                </>
              ) : status === 'processing' ? (
                '면접 질문은 분석이 완료되면 표시됩니다.'
              ) : (
                '아직 추천 면접 질문이 없습니다. AI 분석이 완료되면 Gemini가 질문을 제안합니다.'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
