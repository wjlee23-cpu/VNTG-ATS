import { cn } from '@/components/ui/utils';
import { ReactNode } from 'react';

/**
 * DS 2.0 Split View Form Row 컴포넌트
 * 
 * 기존의 '카드(Box) 안에 폼 넣기' 방식을 대체하는 레이아웃입니다.
 * 좌측에는 레이블과 설명(200px), 우측에는 입력 폼(1fr)을 배치합니다.
 * 항목 사이는 닫힌 네모 박스가 아니라, 하단 구분선과 넉넉한 상하 여백으로만 나눕니다.
 * 
 * @example
 * ```tsx
 * <FormRow label="이름" description="후보자의 전체 이름을 입력하세요">
 *   <Input placeholder="홍길동" />
 * </FormRow>
 * ```
 */
interface FormRowProps {
  /** 좌측 레이블 텍스트 */
  label: string;
  /** 좌측 설명 텍스트 (선택) */
  description?: string;
  /** 우측 컨트롤 영역 */
  children: ReactNode;
  /** 추가 클래스명 */
  className?: string;
  /** 마지막 행 여부 (구분선 제거) */
  isLast?: boolean;
}

export function FormRow({
  label,
  description,
  children,
  className,
  isLast = false,
}: FormRowProps) {
  return (
    <div
      className={cn(
        // DS 2.0: grid-cols-[200px_1fr] 레이아웃
        'grid grid-cols-[200px_1fr] gap-6 py-6',
        // DS 2.0: 하단 구분선 (border-b border-neutral-100)
        !isLast && 'border-b border-neutral-100',
        className,
      )}
    >
      {/* 좌측: 레이블 + 설명 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-neutral-900 tracking-tight">
          {label}
        </label>
        {description && (
          <p className="text-xs text-neutral-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* 우측: 컨트롤 */}
      <div className="flex items-center">
        {children}
      </div>
    </div>
  );
}
