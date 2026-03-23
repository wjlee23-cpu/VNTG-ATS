'use client';

import { Sparkles, ThumbsUp, AlertTriangle, MessageSquareText } from 'lucide-react';
import type { Candidate, AiInterviewQuestionItem } from '@/types/candidates';
import { getScoreBadge } from './candidate-ai-badge';

interface CandidateInsightTabProps {
  candidate: Candidate;
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

/** AI Insight 탭 — JD 매칭, 강약점, Gemini 추천 면접 질문 */
export function CandidateInsightTab({ candidate }: CandidateInsightTabProps) {
  const score = candidate.ai_score ?? null;
  const summary = candidate.ai_summary || '';
  const strengths = candidate.ai_strengths || [];
  const weaknesses = candidate.ai_weaknesses || [];
  const badge = getScoreBadge(score);
  const interviewQs = normalizeInterviewQuestions(candidate.ai_interview_questions);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white relative">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-8">
        {/* Grid: flex 대신 1열이 남은 폭을 확실히 가져가도록 minmax(0,1fr) 사용 */}
        <div className="mb-8 grid grid-cols-1 gap-6 rounded-xl border border-neutral-200 bg-[#FCFCFC] p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-8">
          <div className="flex flex-col items-center justify-center border-b border-neutral-200 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8">
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
          </div>
          <div className="min-w-0 max-w-full">
            <div className="mb-2 flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
              <span className="text-sm font-semibold leading-snug text-neutral-900">AI JD Match Analysis</span>
            </div>
            <p className="text-sm leading-relaxed text-neutral-600 [overflow-wrap:anywhere]">
              {summary || 'AI 분석 결과가 아직 없습니다. 이력서를 업로드하면 분석이 시작됩니다.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              강점 (Strengths)
            </h4>
            {strengths.length > 0 ? (
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
            {weaknesses.length > 0 ? (
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
            <MessageSquareText className="w-4 h-4 text-indigo-500" />
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
            <div className="p-4 rounded-lg border border-amber-100 bg-amber-50/50 text-sm text-amber-900/80">
              아직 추천 면접 질문이 없습니다. AI 분석이 완료되면 Gemini가 질문을 제안합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
