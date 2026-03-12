'use client';

import { useState } from 'react';
import { ArrowRight, SkipForward, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { skipStage, forceApproveStage, rejectCandidate, approveStageEvaluation } from '@/api/actions/evaluations';
import { confirmHire } from '@/api/actions/offers';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface StageActionButtonsProps {
  candidateId: string;
  currentStageId: string;
  currentStageName: string;
  userRole: 'admin' | 'recruiter' | 'interviewer';
  hasPassedEvaluations: boolean;
}

export function StageActionButtons({
  candidateId,
  currentStageId,
  currentStageName,
  userRole,
  hasPassedEvaluations,
}: StageActionButtonsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleSkip = async () => {
    if (!confirm('이 전형을 스킵하고 다음 전형으로 이동하시겠습니까?')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await skipStage(candidateId, currentStageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('전형이 스킵되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('전형 스킵 중 오류가 발생했습니다.');
      console.error('Skip stage error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceApprove = async () => {
    if (!confirm('이 전형을 강제로 합격 처리하고 다음 전형으로 이동하시겠습니까?')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await forceApproveStage(candidateId, currentStageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('강제 합격 처리되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('강제 합격 처리 중 오류가 발생했습니다.');
      console.error('Force approve error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!hasPassedEvaluations) {
      toast.error('모든 평가가 합격 상태가 아닙니다.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await approveStageEvaluation(candidateId, currentStageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('다음 전형으로 이동했습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('전형 이동 중 오류가 발생했습니다.');
      console.error('Approve error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('불합격 사유를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await rejectCandidate(candidateId, currentStageId, rejectReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('불합격 처리되었습니다.');
        setRejectModalOpen(false);
        setRejectReason('');
        router.refresh();
      }
    } catch (error) {
      toast.error('불합격 처리 중 오류가 발생했습니다.');
      console.error('Reject error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmHire = async () => {
    if (!confirm('입사 확정 처리하시겠습니까? 입사 확정된 후보자는 입사확정 필터에서 조회할 수 있습니다.')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await confirmHire(candidateId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('입사 확정 처리되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('입사 확정 처리 중 오류가 발생했습니다.');
      console.error('Confirm hire error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = userRole === 'admin';
  const isOfferStage = currentStageName === 'Offer';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isAdmin && (
          <>
            <Button
              onClick={handleSkip}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              스킵
            </Button>
            <Button
              onClick={handleForceApprove}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              강제 합격
            </Button>
          </>
        )}
        {hasPassedEvaluations && !isOfferStage && (
          <Button
            onClick={handleApprove}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            다음 전형으로
          </Button>
        )}
        {isOfferStage && (
          <Button
            onClick={handleConfirmHire}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            입사 확정
          </Button>
        )}
        <Button
          onClick={() => setRejectModalOpen(true)}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <XCircle className="w-4 h-4 mr-2" />
          불합격
        </Button>
      </div>

      {/* 불합격 모달 */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>불합격 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {currentStageName} 전형에서 불합격 처리하시겠습니까?
            </p>
            <div>
              <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-2">
                불합격 사유
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="불합격 사유를 입력하세요..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading || !rejectReason.trim()}
            >
              {isLoading ? '처리 중...' : '불합격 처리'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
