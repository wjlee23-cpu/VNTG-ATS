'use client';

import { useState } from 'react';
import { Star, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createStageEvaluation, updateStageEvaluation } from '@/api/actions/evaluations';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface StageEvaluationModalProps {
  candidateId: string;
  candidateName: string;
  stageId: string;
  stageName: string;
  existingEvaluation?: {
    id: string;
    result: 'pass' | 'fail' | 'pending';
    notes?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function StageEvaluationModal({
  candidateId,
  candidateName,
  stageId,
  stageName,
  existingEvaluation,
  isOpen,
  onClose,
}: StageEvaluationModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<'pass' | 'fail' | 'pending'>(
    existingEvaluation?.result || 'pending'
  );
  const [notes, setNotes] = useState(existingEvaluation?.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let resultData;
      if (existingEvaluation) {
        resultData = await updateStageEvaluation(existingEvaluation.id, result, notes);
      } else {
        resultData = await createStageEvaluation(candidateId, stageId, result, notes);
      }

      if (resultData.error) {
        toast.error(resultData.error);
      } else {
        toast.success('평가가 저장되었습니다.');
        setResult('pending');
        setNotes('');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('평가 저장 중 오류가 발생했습니다.');
      console.error('Evaluation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-600" />
            전형 평가
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">{candidateName}</span>님
            </p>
            <p className="text-sm font-medium text-gray-900">{stageName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              평가 결과 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setResult('pass')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  result === 'pass'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                합격
              </button>
              <button
                type="button"
                onClick={() => setResult('fail')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  result === 'fail'
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                불합격
              </button>
              <button
                type="button"
                onClick={() => setResult('pending')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  result === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                대기중
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              평가 노트
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="평가 내용을 입력하세요..."
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
