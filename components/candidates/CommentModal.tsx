'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createComment } from '@/api/actions/comments';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CommentModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: CommentModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 내용 검증
    if (!content.trim()) {
      toast.error('코멘트 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createComment(candidateId, content.trim());

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('코멘트가 저장되었습니다.');
        setContent('');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('코멘트 저장 중 오류가 발생했습니다.');
      console.error('Comment error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setContent('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            코멘트 작성
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">{candidateName}</span>님에 대한 코멘트
            </p>
          </div>

          <div>
            <label htmlFor="comment-content" className="block text-sm font-medium text-gray-700 mb-2">
              코멘트 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="comment-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="코멘트 내용을 입력하세요..."
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !content.trim()}
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
