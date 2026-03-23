'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ProfileEditFormState {
  email: string;
  phone: string;
  current_salary: string;
  expected_salary: string;
}

export type ProfileEditDialogMode = 'basic' | 'compensation';

interface CandidateProfileEditDialogProps {
  open: boolean;
  mode: ProfileEditDialogMode | null;
  form: ProfileEditFormState;
  onFormChange: (patch: Partial<ProfileEditFormState>) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

/** 기본 정보 / 연봉 정보 구역별 수정 모달 */
export function CandidateProfileEditDialog({
  open,
  mode,
  form,
  onFormChange,
  onSave,
  onCancel,
  isSaving = false,
}: CandidateProfileEditDialogProps) {
  const isBasic = mode === 'basic';
  const isCompensation = mode === 'compensation';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md border-neutral-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-neutral-900">
            {isBasic ? '기본 정보 수정' : isCompensation ? '연봉 정보 수정' : '정보 수정'}
          </DialogTitle>
          <DialogDescription className="text-neutral-500">
            {isBasic
              ? '이메일과 연락처를 수정할 수 있습니다.'
              : isCompensation
                ? '현재 연봉과 희망 연봉을 수정할 수 있습니다.'
                : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {isBasic && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="profile-edit-email" className="text-neutral-700">
                  이메일
                </Label>
                <Input
                  id="profile-edit-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => onFormChange({ email: e.target.value })}
                  className="border-neutral-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-edit-phone" className="text-neutral-700">
                  연락처
                </Label>
                <Input
                  id="profile-edit-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => onFormChange({ phone: e.target.value })}
                  className="border-neutral-200"
                  placeholder="010-0000-0000"
                />
              </div>
            </>
          )}
          {isCompensation && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="profile-edit-current" className="text-neutral-700">
                  현재 연봉
                </Label>
                <Input
                  id="profile-edit-current"
                  value={form.current_salary}
                  onChange={(e) => onFormChange({ current_salary: e.target.value })}
                  className="border-neutral-200"
                  placeholder="예: 5,000만원"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-edit-expected" className="text-neutral-700">
                  희망 연봉
                </Label>
                <Input
                  id="profile-edit-expected"
                  value={form.expected_salary}
                  onChange={(e) => onFormChange({ expected_salary: e.target.value })}
                  className="border-neutral-200"
                  placeholder="예: 6,000만원"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="border-neutral-200">
            취소
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={isSaving} className="bg-neutral-900">
            {isSaving ? '저장 중…' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
