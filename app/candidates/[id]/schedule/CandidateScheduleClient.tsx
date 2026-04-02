'use client';

import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock, Loader2 } from 'lucide-react';
import { confirmCandidateSchedule } from '@/api/actions/schedules';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ko } from 'date-fns/locale/ko';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getStageNameByStageId } from '@/constants/stages';

interface CandidateScheduleClientProps {
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  schedule: {
    id: string;
    stage_id?: string;
    duration_minutes: number;
    interviewer_ids: string[];
  };
  options: Array<{
    id: string;
    scheduled_at: string;
    status: string;
  }>;
  positionName?: string;
  token: string;
  isConfirmed?: boolean;
}

export function CandidateScheduleClient({
  candidate,
  schedule,
  options,
  positionName,
  token,
  isConfirmed: initialIsConfirmed = false,
}: CandidateScheduleClientProps) {
  const router = useRouter();
  // KST 타임존 상수
  const KST_TIMEZONE = 'Asia/Seoul';
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(initialIsConfirmed);
  const [confirmedOption, setConfirmedOption] = useState<{
    id: string;
    scheduled_at: string;
  } | null>(initialIsConfirmed && options.length > 0 ? options[0] : null);

  // 옵션들을 KST 기준 “일(날짜)” 단위로 그룹화합니다.
  // - 각 날짜 섹션 내부에는 시간 선택 버튼이 들어갑니다.
  const optionsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        dateKey: string; // 예: "2026-02-25"
        dateKst: Date;
        items: Array<{
          optionId: string;
          timeLabel: string; // 예: "오후 2:00"
          sortKey: number; // 버튼 정렬을 위해 scheduled_at(KST) ms를 보관합니다.
        }>;
      }
    >();

    for (const opt of options) {
      const dateKst = toZonedTime(new Date(opt.scheduled_at), KST_TIMEZONE);
      const dateKey = format(dateKst, 'yyyy-MM-dd', { locale: ko });
      const timeLabel = format(dateKst, 'a h:mm', { locale: ko });
      const sortKey = dateKst.getTime();

      const prev = map.get(dateKey);
      if (!prev) {
        map.set(dateKey, {
          dateKey,
          dateKst,
          items: [{ optionId: opt.id, timeLabel, sortKey }],
        });
      } else {
        prev.items.push({ optionId: opt.id, timeLabel, sortKey });
      }
    }

    // 날짜 오름차순 정렬(시간 선택 UI는 date 섹션만 정렬되면 충분합니다)
    const result = Array.from(map.values()).sort((a, b) => a.dateKst.getTime() - b.dateKst.getTime());
    // 섹션 내부 시간도 scheduled_at 순서대로 유지되도록 정렬합니다.
    for (const section of result) {
      section.items.sort((a, b) => a.sortKey - b.sortKey);
    }

    return result;
  }, [options]);

  // 확정 완료 화면/버튼용 문자열을 미리 계산합니다.
  const stageName = schedule.stage_id ? getStageNameByStageId(schedule.stage_id) || schedule.stage_id : '';
  const scheduleTitle = `${positionName || '포지션 미지정'} ${stageName}`.trim();
  const detailsLink = `/candidates/${candidate.id}/schedule?token=${token}`;

  const handleSelect = async (optionId: string) => {
    setIsSubmitting(true);
    setSelectedOptionId(optionId);

    try {
      const result = await confirmCandidateSchedule(schedule.id, optionId, token);

      if (result.error) {
        toast.error(result.error);
        setIsSubmitting(false);
        setSelectedOptionId(null);
      } else {
        toast.success('면접 일정이 확정되었습니다!');
        // 성공 상태로 변경하고 선택된 옵션 저장
        setIsConfirmed(true);
        const selectedOption = options.find(opt => opt.id === optionId);
        if (selectedOption) {
          setConfirmedOption(selectedOption);
        }
        setIsSubmitting(false);
        // 페이지 새로고침하여 서버에서 확정된 일정 정보를 가져오기
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    } catch (error) {
      toast.error('일정 확정에 실패했습니다.');
      console.error(error);
      setIsSubmitting(false);
      setSelectedOptionId(null);
    }
  };

  // 일정 확정 완료 화면 (서버에서 이미 확정된 경우 또는 클라이언트에서 방금 확정한 경우)
  if (isConfirmed && confirmedOption) {
    const confirmedDateKst = toZonedTime(new Date(confirmedOption.scheduled_at), KST_TIMEZONE);
    const confirmedAtLabel = format(confirmedDateKst, 'yyyy. MM. dd (EEE) a h:mm', { locale: ko });

    // 첨부 HTML(확정 안내) 톤을 웹에서도 그대로 재현합니다.
    return (
      <div className="min-h-screen bg-[#F7F7F8] py-12 px-4 font-sans text-neutral-900 antialiased text-center">
        <div className="max-w-[600px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 overflow-hidden">
          <div className="p-10 sm:p-14">
            <div className="text-5xl mb-6">🎉</div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-4">
              면접 일정이 확정되었습니다!
            </h1>

            <p className="text-base text-neutral-600 leading-relaxed mb-10 max-w-[400px] mx-auto">
              안녕하세요, <strong className="font-semibold text-neutral-900">{candidate.name}</strong>님.
              <br />
              선택해주신 시간으로 면접 일정이 최종 확정되었습니다.
            </p>

            <div className="bg-neutral-900 rounded-2xl p-8 mb-10 shadow-[0_12px_24px_rgba(0,0,0,0.15)]">
              <p className="text-xs font-bold tracking-widest text-neutral-400 uppercase mb-2">{scheduleTitle}</p>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{confirmedAtLabel}</p>
            </div>

            <p className="text-sm text-neutral-600 leading-relaxed mb-8">
              자세한 화상 면접 접속 링크 및 사전 안내 사항은 아래 버튼을 눌러 확인해주시기 바랍니다.
              면접에서 뵙기를 기대하겠습니다.
            </p>

            <a
              href={detailsLink}
              className="inline-block bg-white text-neutral-900 border border-neutral-200 text-sm font-semibold px-8 py-3.5 rounded-xl shadow-sm hover:border-neutral-900 transition-colors text-decoration-none w-full sm:w-auto"
            >
              면접 상세 안내 확인하기
            </a>

            <hr className="border-neutral-100 my-10" />

            <p className="text-xs text-neutral-400 font-medium">© 2026 VNTGCorp Recruitment Team.</p>
          </div>
        </div>
      </div>
    );
  }

  // 일정 선택 화면
  return (
    <div className="min-h-screen bg-[#F7F7F8] font-sans antialiased text-neutral-900">
      <header className="bg-white border-b border-neutral-200 shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <div className="w-8 h-8 bg-neutral-900 text-white rounded-lg flex items-center justify-center text-sm">
              V
            </div>
            VNTG
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 flex items-center justify-center text-xs font-semibold">
              {(candidate.name || 'U')[0]}
            </div>
            <span className="text-sm font-medium text-neutral-600">{candidate.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        <div className="mb-10 text-center sm:text-left">
          <span className="inline-block px-3 py-1 mb-4 bg-neutral-100 border border-neutral-200 text-neutral-600 rounded-md text-xs font-bold tracking-wider uppercase">
            {stageName}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-3">
            면접 일정 선택
          </h1>
          <p className="text-base text-neutral-500">
            원하시는 날짜와 시간을 하나만 선택해주세요. 시간은 한국 표준시(KST) 기준입니다.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 p-8 sm:p-10 space-y-12">
          {optionsByDate.map((section) => (
            <section key={section.dateKey}>
              <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3 mb-6">
                <CalendarDays className="w-5 h-5 text-neutral-400" />
                <h2 className="text-lg font-bold text-neutral-900">
                  {format(section.dateKst, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {section.items.map((item) => {
                  const isSelected = selectedOptionId === item.optionId;
                  return (
                    <button
                      key={item.optionId}
                      type="button"
                      onClick={() => handleSelect(item.optionId)}
                      disabled={isSubmitting}
                      className={[
                        'flex items-center justify-center gap-2 py-3.5 px-4 bg-white border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700',
                        'hover:border-neutral-900 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:text-neutral-900 transition-all',
                        'active:scale-[0.98]',
                        isSelected ? 'border-neutral-900 text-neutral-900' : '',
                        'focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10',
                      ].join(' ')}
                    >
                      {isSubmitting && isSelected ? (
                        <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4 text-neutral-400" />
                      )}
                      {item.timeLabel}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
