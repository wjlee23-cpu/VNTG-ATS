'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Users, Loader2, CheckCircle2, Mail, X } from 'lucide-react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerFooter,
  DrawerDescription 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { scheduleInterviewAutomated } from '@/api/actions/schedules';
import { getUsers } from '@/api/queries/users';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { cn } from '@/components/ui/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

interface ScheduleInterviewAutomatedModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleInterviewAutomatedModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: ScheduleInterviewAutomatedModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string }>>([]);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    duration_minutes: '60',
    stage_id: 'stage-6', // 기본값: 1st Interview
    interviewer_ids: [] as string[],
    num_options: '2', // 기본값: 2개
  });

  // 사용자 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers();
      if (result.data) {
        // 면접관 또는 관리자만 필터링
        setUsers(result.data.filter(u => u.role === 'interviewer' || u.role === 'admin'));
      }
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
      toast.error('면접관 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidateId);
      formDataToSend.append('stage_id', formData.stage_id);
      formDataToSend.append('start_date', formData.start_date);
      formDataToSend.append('end_date', formData.end_date);
      formDataToSend.append('duration_minutes', formData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(formData.interviewer_ids));
      formDataToSend.append('num_options', formData.num_options);

      const result = await scheduleInterviewAutomated(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || '면접 일정 자동화가 시작되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('면접 일정 자동화에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInterviewer = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      interviewer_ids: prev.interviewer_ids.includes(userId)
        ? prev.interviewer_ids.filter(id => id !== userId)
        : [...prev.interviewer_ids, userId],
    }));
  };

  // 폼 유효성 검사
  const isFormValid = 
    formData.start_date && 
    formData.end_date && 
    formData.interviewer_ids.length > 0 &&
    !isLoadingUsers;

  // 면접 시간 옵션
  const durationOptions = [
    { value: '30', label: '30분' },
    { value: '60', label: '60분' },
    { value: '90', label: '90분' },
    { value: '120', label: '120분' },
  ];

  // 일정 옵션 개수
  const numOptionsList = [1, 2, 3, 4, 5];

  return (
    <Drawer open={isOpen} onOpenChange={onClose} direction="right">
      <DrawerContent 
        className="h-full w-full sm:w-[600px] sm:max-w-[90vw] bg-white/80 backdrop-blur-md border-l border-white/20 shadow-2xl"
      >
        <DrawerHeader className="border-b border-slate-200/50 pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-2xl font-semibold text-foreground">
              인터뷰 스케줄링 자동화
            </DrawerTitle>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-slate-100 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <DrawerDescription className="text-sm text-slate-600 mt-2">
            면접관들의 구글 캘린더를 분석하여 최적의 면접 일정을 자동으로 찾아드립니다.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 후보자 정보 카드 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                후보자
              </label>
              <p className="text-base font-medium text-slate-900">{candidateName}</p>
            </div>

            {/* 날짜 선택 카드 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                <CalendarIcon className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                일정 검색 기간
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="block text-xs text-slate-600 mb-1.5">
                    시작 날짜
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        id="start_date"
                        className={cn(
                          "w-full justify-start text-left font-normal px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5287FF] focus:border-transparent bg-white text-slate-900 text-sm",
                          !formData.start_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {formData.start_date ? (
                          format(new Date(formData.start_date), 'yyyy년 MM월 dd일', { locale: ko })
                        ) : (
                          <span>날짜 선택</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date ? new Date(formData.start_date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            setFormData({ ...formData, start_date: dateStr });
                            // 종료 날짜가 시작 날짜보다 이전이면 종료 날짜도 업데이트
                            if (formData.end_date && new Date(formData.end_date) < date) {
                              setFormData(prev => ({ ...prev, start_date: dateStr, end_date: dateStr }));
                            }
                          }
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        locale={ko}
                        weekStartsOn={0}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label htmlFor="end_date" className="block text-xs text-slate-600 mb-1.5">
                    종료 날짜
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        id="end_date"
                        className={cn(
                          "w-full justify-start text-left font-normal px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5287FF] focus:border-transparent bg-white text-slate-900 text-sm",
                          !formData.end_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {formData.end_date ? (
                          format(new Date(formData.end_date), 'yyyy년 MM월 dd일', { locale: ko })
                        ) : (
                          <span>날짜 선택</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.end_date ? new Date(formData.end_date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setFormData({ ...formData, end_date: format(date, 'yyyy-MM-dd') });
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date(new Date().setHours(0, 0, 0, 0));
                          const minDate = formData.start_date 
                            ? new Date(formData.start_date) 
                            : today;
                          return date < minDate;
                        }}
                        initialFocus
                        locale={ko}
                        weekStartsOn={0}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* 면접 시간 선택 카드 - Segmented Control 스타일 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                <Clock className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                면접 시간
              </label>
              <div className="flex gap-2 flex-wrap">
                {durationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, duration_minutes: option.value })}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      formData.duration_minutes === option.value
                        ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white shadow-md"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 면접 단계 선택 카드 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50 space-y-3">
              <label htmlFor="stage_id" className="block text-sm font-medium text-slate-700">
                면접 단계
              </label>
              <select
                id="stage_id"
                required
                value={formData.stage_id}
                onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5287FF] focus:border-transparent bg-white text-slate-900 text-sm"
              >
                {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* 일정 옵션 개수 선택 카드 - Segmented Control 스타일 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                <CalendarIcon className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                일정 옵션 개수
              </label>
              <div className="flex gap-2 flex-wrap">
                {numOptionsList.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setFormData({ ...formData, num_options: num.toString() })}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      formData.num_options === num.toString()
                        ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white shadow-md"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400"
                    )}
                  >
                    {num}개
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                면접관들의 공통 가능 일정 중 선택할 옵션 개수입니다.
              </p>
            </div>

            {/* 면접관 선택 카드 - Avatar 토글 UI */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/50 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                <Users className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                면접관 선택
                <span className="text-xs font-normal text-slate-500 ml-2">
                  (최소 1명 이상)
                </span>
              </label>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#5287FF]" />
                  <span className="ml-2 text-sm text-slate-600">면접관 목록 로딩 중...</span>
                </div>
              ) : (
                <>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    {users.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4 w-full">
                        면접관이 없습니다. 먼저 면접관을 등록해주세요.
                      </p>
                    ) : (
                      users.map((user) => {
                        const isSelected = formData.interviewer_ids.includes(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleInterviewer(user.id)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px]",
                              isSelected
                                ? "bg-blue-50/50 ring-2 ring-[#5287FF] shadow-sm"
                                : "bg-white border border-slate-200 hover:bg-blue-50/30 hover:border-slate-300"
                            )}
                          >
                            <Avatar className={cn(
                              "w-12 h-12 border-2 transition-all",
                              isSelected ? "border-[#5287FF]" : "border-slate-200"
                            )}>
                              <AvatarFallback className={cn(
                                "text-sm font-medium",
                                isSelected 
                                  ? "bg-[#5287FF]/10 text-[#5287FF]" 
                                  : "bg-slate-100 text-slate-600"
                              )}>
                                {user.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                              <p className="text-xs font-medium text-slate-700 truncate max-w-[70px]">
                                {user.email.split('@')[0]}
                              </p>
                              {user.role === 'admin' && (
                                <Badge 
                                  variant="outline" 
                                  className="mt-1 text-[10px] px-1.5 py-0 border-slate-300 text-slate-600"
                                >
                                  관리자
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {formData.interviewer_ids.length === 0 && (
                    <p className="text-xs text-rose-600 mt-2">
                      최소 1명의 면접관을 선택해주세요.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* 자동화 프로세스 안내 - Step-by-step */}
            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/50 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5287FF]" />
                자동화 프로세스
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5287FF]/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-[#5287FF]">1</span>
                  </div>
                  <p className="text-sm text-slate-600 flex-1">
                    면접관들의 구글 캘린더에서 공통 가능 일정 <span className="font-medium">{formData.num_options}개</span>를 찾습니다
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5287FF]/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-[#5287FF]">2</span>
                  </div>
                  <p className="text-sm text-slate-600 flex-1">
                    구글 캘린더에 block 일정을 생성하고 면접관들에게 초대를 전송합니다
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5287FF]/10 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-[#5287FF]">3</span>
                  </div>
                  <p className="text-sm text-slate-600 flex-1">
                    모든 면접관이 수락하면 후보자에게 일정 옵션을 전송합니다
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>

        <DrawerFooter className="border-t border-slate-200/50 pt-4">
          <div className="flex gap-3 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
              className="px-6"
            >
              취소
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={!isFormValid || isLoading}
              className={cn(
                "px-6 transition-all",
                isFormValid
                  ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white hover:opacity-90 shadow-md"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                '자동화 시작'
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
