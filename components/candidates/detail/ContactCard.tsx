'use client';

import { Mail, Phone, MapPin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Candidate } from '@/types/candidates';

interface ContactCardProps {
  candidate: Candidate;
  canManageCandidate: boolean;
  canViewCompensation: boolean;
  isEditMode: boolean;
  editFormData: {
    email: string;
    phone: string;
    current_salary: string;
    expected_salary: string;
  };
  onEditFormChange: (data: Partial<ContactCardProps['editFormData']>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSetEditMode: (value: boolean) => void;
}

/** Contact + 수정 모드 카드 */
export function ContactCard({
  candidate,
  canManageCandidate,
  canViewCompensation,
  isEditMode,
  editFormData,
  onEditFormChange,
  onSaveEdit,
  onCancelEdit,
  onSetEditMode,
}: ContactCardProps) {
  const location = candidate.parsed_data?.location || '';

  return (
    <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Contact</h3>
        {canManageCandidate && (
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button onClick={onSaveEdit} size="sm" className="bg-primary hover:bg-primary/90 text-white">
                  저장
                </Button>
                <Button onClick={onCancelEdit} size="sm" variant="outline">
                  취소
                </Button>
              </>
            ) : (
              <Button
                onClick={() => onSetEditMode(true)}
                size="sm"
                variant="outline"
                className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <Settings className="w-4 h-4 mr-2" />
                수정
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {isEditMode ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="edit-email">이메일</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => onEditFormChange({ email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">전화번호</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => onEditFormChange({ phone: e.target.value })}
              />
            </div>
            {canViewCompensation && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-current-salary">현재 연봉</Label>
                  <Input
                    id="edit-current-salary"
                    type="text"
                    value={editFormData.current_salary}
                    onChange={(e) => onEditFormChange({ current_salary: e.target.value })}
                    placeholder="예: 5000만원"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expected-salary">희망 연봉</Label>
                  <Input
                    id="edit-expected-salary"
                    type="text"
                    value={editFormData.expected_salary}
                    onChange={(e) => onEditFormChange({ expected_salary: e.target.value })}
                    placeholder="예: 6000만원"
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
              <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground break-all">{candidate.email}</span>
            </div>
            {candidate.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground break-all">{candidate.phone}</span>
              </div>
            )}
          </>
        )}
        {location && (
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
            <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">{location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
