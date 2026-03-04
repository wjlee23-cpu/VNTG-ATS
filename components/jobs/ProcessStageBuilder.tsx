'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X, User } from 'lucide-react';
import { CustomStage, BaseStage } from '@/types/job';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';

// 7개의 기본 단계 정의 (HR Screening 제거됨)
const BASE_STAGES: BaseStage[] = [
  { id: 'stage-1', name: 'New Application' },
  { id: 'stage-3', name: 'Application Review' },
  { id: 'stage-4', name: 'Competency Assessment' },
  { id: 'stage-5', name: 'Technical Test' },
  { id: 'stage-6', name: '1st Interview' },
  { id: 'stage-7', name: 'Reference Check' },
  { id: 'stage-8', name: '2nd Interview' },
];

interface User {
  id: string;
  email: string;
  role: string;
}

interface ProcessStageBuilderProps {
  initialStages?: CustomStage[];
  users: User[];
  onChange: (stages: CustomStage[]) => void;
}

// 드래그 가능한 단계 아이템
function SortableStageItem({
  stage,
  users,
  onRemove,
  onAssigneesChange,
}: {
  stage: CustomStage;
  users: User[];
  onRemove: () => void;
  onAssigneesChange: (assignees: string[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const availableUsers = users.filter(u => !stage.assignees.includes(u.id));
  const selectedUsers = users.filter(u => stage.assignees.includes(u.id));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-lg border bg-background ${
        isDragging ? 'border-primary shadow-lg' : 'border-border'
      } transition-all`}
    >
      <div className="flex items-start gap-3">
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
        >
          <GripVertical size={20} />
        </button>

        {/* 단계 정보 */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-main text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {stage.order}
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{stage.name}</h4>
                <p className="text-xs text-muted-foreground">ID: {stage.id}</p>
              </div>
            </div>
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          {/* 담당자 선택 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User size={14} />
              담당자
            </label>
            <div className="flex flex-wrap gap-2">
              {/* 선택된 담당자 */}
              {selectedUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm"
                >
                  <span>{user.email.split('@')[0]}</span>
                  <button
                    onClick={() => {
                      onAssigneesChange(stage.assignees.filter(id => id !== user.id));
                    }}
                    className="hover:text-destructive transition-colors"
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {/* 담당자 추가 드롭다운 */}
              {availableUsers.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onAssigneesChange([...stage.assignees, e.target.value]);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm hover:bg-muted transition-colors"
                >
                  <option value="">담당자 추가...</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email.split('@')[0]} ({user.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedUsers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                담당자를 선택하지 않으면 모든 사용자가 접근 가능합니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 사용 가능한 단계 아이템
function AvailableStageItem({
  stage,
  onAdd,
  isSelected,
}: {
  stage: BaseStage;
  onAdd: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onAdd}
      disabled={isSelected}
      className={`w-full p-3 rounded-lg border text-left transition-all ${
        isSelected
          ? 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
          : 'border-border bg-background hover:border-primary hover:bg-primary/5 cursor-pointer'
      }`}
      type="button"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{stage.name}</span>
        {!isSelected && (
          <Plus size={16} className="text-primary" />
        )}
      </div>
    </button>
  );
}

export function ProcessStageBuilder({
  initialStages = [],
  users,
  onChange,
}: ProcessStageBuilderProps) {
  const [selectedStages, setSelectedStages] = useState<CustomStage[]>(() => {
    // 초기값이 있으면 사용, 없으면 빈 배열
    if (initialStages.length > 0) {
      return initialStages.map((stage, index) => ({
        ...stage,
        order: stage.order || index + 1,
      }));
    }
    return [];
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 선택된 단계 ID 목록
  const selectedStageIds = selectedStages.map(s => s.id);

  // 사용 가능한 단계 (선택되지 않은 것들)
  const availableStages = BASE_STAGES.filter(
    stage => !selectedStageIds.includes(stage.id)
  );

  // 단계 추가
  const handleAddStage = (stageId: string) => {
    const stage = BASE_STAGES.find(s => s.id === stageId);
    if (!stage) return;

    const newStage: CustomStage = {
      id: stage.id,
      name: stage.name,
      order: selectedStages.length + 1,
      assignees: [],
    };

    const updated = [...selectedStages, newStage];
    setSelectedStages(updated);
    onChange(updated);
  };

  // 단계 제거
  const handleRemoveStage = (stageId: string) => {
    const updated = selectedStages
      .filter(s => s.id !== stageId)
      .map((s, index) => ({ ...s, order: index + 1 }));
    setSelectedStages(updated);
    onChange(updated);
  };

  // 드래그 종료
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedStages.findIndex(s => s.id === active.id);
      const newIndex = selectedStages.findIndex(s => s.id === over.id);

      const updated = arrayMove(selectedStages, oldIndex, newIndex).map(
        (stage, index) => ({ ...stage, order: index + 1 })
      );

      setSelectedStages(updated);
      onChange(updated);
    }
  };

  // 담당자 변경
  const handleAssigneesChange = (stageId: string, assignees: string[]) => {
    const updated = selectedStages.map(s =>
      s.id === stageId ? { ...s, assignees } : s
    );
    setSelectedStages(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-2">프로세스 단계 설정</h3>
        <p className="text-sm text-muted-foreground">
          이 포지션에서 사용할 프로세스 단계를 선택하고 순서를 조정하세요. 드래그하여 순서를 변경할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 사용 가능한 단계 */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">사용 가능한 단계</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
            {availableStages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                모든 단계가 선택되었습니다.
              </p>
            ) : (
              availableStages.map(stage => (
                <AvailableStageItem
                  key={stage.id}
                  stage={stage}
                  onAdd={() => handleAddStage(stage.id)}
                  isSelected={false}
                />
              ))
            )}
          </div>
        </div>

        {/* 선택된 단계 (드래그 가능) */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            선택된 단계 ({selectedStages.length})
          </h4>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedStages.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 max-h-[400px] overflow-y-auto p-2 border border-border rounded-lg bg-muted/20">
                {selectedStages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    단계를 선택하세요. 왼쪽에서 단계를 클릭하여 추가할 수 있습니다.
                  </p>
                ) : (
                  selectedStages.map(stage => (
                    <SortableStageItem
                      key={stage.id}
                      stage={stage}
                      users={users}
                      onRemove={() => handleRemoveStage(stage.id)}
                      onAssigneesChange={(assignees) =>
                        handleAssigneesChange(stage.id, assignees)
                      }
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {selectedStages.length === 0 && (
        <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm text-accent">
            최소 1개 이상의 단계를 선택해야 합니다.
          </p>
        </div>
      )}
    </div>
  );
}
