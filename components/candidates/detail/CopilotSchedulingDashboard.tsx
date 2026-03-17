'use client';

// VNTG Design System 2.0 - Gemini AI 코파일럿 스케줄링 대시보드
// 샘플화면7.html 기반의 AI 코파일럿 기반 스플릿 뷰 스케줄링
import {
  ArrowLeft,
  Calendar,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Users,
  Info,
  Send,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { cn } from '@/components/ui/utils';

interface ScheduleSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'available' | 'tight' | 'warning';
  statusMessage?: string;
  isExcluded?: boolean;
}

interface AIAlert {
  id: string;
  type: 'warning' | 'suggestion';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
}

interface UserInfo {
  id: string;
  name: string;
  role?: string;
  calendarSaturation?: number; // 0-100
  isBusy?: boolean;
}

interface CopilotSchedulingDashboardProps {
  candidateName: string;
  stageName: string;
  dateRange: { from: Date | undefined; to: Date | undefined };
  selectedUsers: UserInfo[];
  duration: string;
  numOptions: string;
  slots: ScheduleSlot[];
  aiAlerts?: AIAlert[];
  isSyncing?: boolean;
  onBack: () => void;
  onAddUser?: () => void;
  onRemoveUser?: (userId: string) => void;
  onExcludeSlot?: (slotId: string) => void;
  onSendOptions: () => void;
  onCancel: () => void;
}

/** Gemini AI 코파일럿 스케줄링 대시보드 - VNTG Design System 2.0 */
export function CopilotSchedulingDashboard({
  candidateName,
  stageName,
  dateRange,
  selectedUsers,
  duration,
  numOptions,
  slots,
  aiAlerts = [],
  isSyncing = false,
  onBack,
  onAddUser,
  onRemoveUser,
  onExcludeSlot,
  onSendOptions,
  onCancel,
}: CopilotSchedulingDashboardProps) {
  // 날짜 범위 포맷
  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'yyyy. MM. dd', { locale: ko })} - ${format(dateRange.to, 'yyyy. MM. dd', { locale: ko })}`;
    }
    return '기간 미선택';
  };

  // 사용자 이니셜 추출
  const getUserInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // 슬롯 상태에 따른 스타일
  const getSlotStatusStyle = (status: ScheduleSlot['status']) => {
    switch (status) {
      case 'available':
        return 'w-1.5 h-1.5 rounded-full bg-emerald-500';
      case 'tight':
        return 'w-1.5 h-1.5 rounded-full bg-amber-500';
      case 'warning':
        return 'w-1.5 h-1.5 rounded-full bg-red-500';
      default:
        return 'w-1.5 h-1.5 rounded-full bg-neutral-400';
    }
  };

  // 요일 이름 추출 (한글)
  const getDayName = (date: Date) => {
    const days = ['일', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  // 필터링된 슬롯 (제외되지 않은 것만)
  const visibleSlots = slots.filter((slot) => !slot.isExcluded);

  return (
    <div className="flex h-[880px] w-full max-w-[1400px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      {/* 좌측 설정 패널 */}
      <div className="w-[400px] bg-[#FCFCFC] border-r border-neutral-200 flex flex-col shrink-0">
        {/* 헤더 */}
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-neutral-900">{candidateName} 후보자</h1>
              <p className="text-xs text-neutral-500">{stageName} 조율</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 일정 검색 기간 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
              일정 검색 기간
            </label>
            <button className="w-full flex items-center justify-between bg-white border border-neutral-200 text-neutral-900 text-sm rounded-lg px-3 py-2.5 shadow-sm">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-400" />
                {formatDateRange()}
              </span>
            </button>
          </div>

          {/* 참석자 (면접관) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                참석자 (면접관)
              </label>
              {onAddUser && (
                <button
                  onClick={onAddUser}
                  className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900"
                >
                  <Plus className="w-3 h-3 inline" /> 추가
                </button>
              )}
            </div>

            <div className="space-y-2">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg shadow-sm',
                    user.isBusy || (user.calendarSaturation && user.calendarSaturation > 80)
                      ? 'bg-amber-50/50 border border-amber-200/50'
                      : 'bg-white border border-neutral-200',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-medium',
                        user.isBusy || (user.calendarSaturation && user.calendarSaturation > 80)
                          ? 'bg-amber-500'
                          : 'bg-neutral-900',
                      )}
                    >
                      {getUserInitial(user.name)}
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-xs font-medium',
                          user.isBusy || (user.calendarSaturation && user.calendarSaturation > 80)
                            ? 'text-amber-900'
                            : 'text-neutral-900',
                        )}
                      >
                        {user.name}
                        {user.role && ` (${user.role})`}
                      </p>
                      {user.calendarSaturation && user.calendarSaturation > 80 && (
                        <p className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          캘린더 {user.calendarSaturation}% 포화
                        </p>
                      )}
                    </div>
                  </div>
                  {onRemoveUser && (
                    <button
                      onClick={() => onRemoveUser(user.id)}
                      className="text-neutral-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 소요 시간 및 제안 수 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
                소요 시간
              </label>
              <div className="w-full bg-white border border-neutral-200 text-neutral-900 text-sm rounded-lg px-3 py-2.5 shadow-sm flex items-center justify-between">
                <span>{duration}</span>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-3">
                제안 수
              </label>
              <div className="w-full bg-white border border-neutral-200 text-neutral-900 text-sm rounded-lg px-3 py-2.5 shadow-sm flex items-center justify-between">
                <span>{numOptions}개 제안</span>
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 우측 AI 코파일럿 리뷰 패널 */}
      <div className="flex-1 flex flex-col bg-white relative">
        {/* 헤더 */}
        <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563eb]" />
            <span
              className="font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #6b21a8 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Gemini Copilot Review
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500',
              )}
            ></span>
            <span className="text-xs font-medium text-neutral-500">
              {isSyncing ? '캘린더 동기화 중...' : '캘린더 실시간 동기화 완료'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-neutral-50/30">
          {/* AI 경고/제안 카드 */}
          {aiAlerts.length > 0 && (
            <div className="mb-8 space-y-4">
              {aiAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-5 bg-white border border-indigo-100 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-blue-500"></div>
                  <div className="flex gap-4">
                    <div className="mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-neutral-900 mb-1">{alert.title}</h3>
                      <p className="text-sm text-neutral-600 leading-relaxed">{alert.message}</p>
                      {(alert.actionLabel || alert.dismissLabel) && (
                        <div className="mt-4 flex gap-2">
                          {alert.actionLabel && alert.onAction && (
                            <button
                              onClick={alert.onAction}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md hover:bg-indigo-100 transition-colors border border-indigo-100"
                            >
                              {alert.actionLabel}
                            </button>
                          )}
                          {alert.dismissLabel && alert.onDismiss && (
                            <button
                              onClick={alert.onDismiss}
                              className="px-3 py-1.5 bg-white text-neutral-500 text-xs font-medium rounded-md hover:bg-neutral-50 transition-colors border border-neutral-200"
                            >
                              {alert.dismissLabel}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 최적 슬롯 리스트 */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              후보자에게 제안될 최적 슬롯 ({visibleSlots.length}개)
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {visibleSlots.length === 0 ? (
                <p className="text-sm text-neutral-500">제안할 슬롯이 없습니다.</p>
              ) : (
                visibleSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={cn(
                      'flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl shadow-sm hover:border-neutral-300 transition-colors group',
                      slot.status === 'warning' && 'opacity-80',
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-neutral-50 rounded-lg border border-neutral-100">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">
                          {getDayName(slot.date)}
                        </span>
                        <span className="text-lg font-bold text-neutral-900 leading-none mt-0.5">
                          {slot.date.getDate()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">
                          {slot.startTime} - {slot.endTime}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                          <span className={getSlotStatusStyle(slot.status)}></span>
                          {slot.statusMessage || '참석자 전원 여유'}
                        </p>
                      </div>
                    </div>
                    {onExcludeSlot && (
                      <button
                        onClick={() => onExcludeSlot(slot.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs font-medium text-neutral-400 hover:text-red-500 transition-all"
                      >
                        제외
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 하단 액션 바 */}
        <div className="p-6 bg-white border-t border-neutral-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            발송 후 면접관이 거절 사유를 남기면 AI가 자동으로 재조율 옵션을 제안합니다.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={onSendOptions}
              className="px-6 py-2.5 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] transition-all active:scale-[0.98] flex items-center gap-2"
            >
              후보자에게 {visibleSlots.length}개 옵션 발송 <Send className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
