'use client';

// 공통 뒤로 가기 버튼 컴포넌트
// - 아이콘 + 텍스트가 일관되게 정렬되도록 정의
// - 페이지 상단 네비게이션 영역에서 재사용 가능

import { ArrowRight } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface BackButtonProps {
  // 클릭 시 실행할 콜백
  onClick: () => void;
  // 버튼에 표시할 텍스트 (기본: "뒤로 가기")
  label?: string;
  // 추가로 Tailwind 클래스를 전달해 스타일 확장
  className?: string;
}

export function BackButton({ onClick, label = '뒤로 가기', className }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // 아이콘 + 텍스트 정렬 규칙
        'inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm font-medium text-blue-700',
        'hover:bg-blue-50 hover:border-blue-200 transition-colors',
        className,
      )}
    >
      {/* 항상 왼쪽을 가리키도록 아이콘 회전 */}
      <ArrowRight className="w-4 h-4 rotate-180 flex-shrink-0" />
      <span className="leading-none">{label}</span>
    </button>
  );
}

