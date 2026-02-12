import { useState } from 'react';
import { Plus, Trash2, GripVertical, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { VNTGSymbol } from '../vntg/VNTGSymbol';

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
}

const stageLibrary: WorkflowStage[] = [
  { id: 'screening', name: 'Screening', description: 'Initial resume review' },
  { id: 'phone-screen', name: 'Phone Screen', description: 'Quick phone interview' },
  { id: 'competency-test', name: 'Competency Test', description: 'Skills assessment' },
  { id: 'tech-interview', name: 'Tech Interview', description: 'Technical evaluation' },
  { id: '1st-interview', name: '1st Interview', description: 'First round interview' },
  { id: 'assignment', name: 'Assignment', description: 'Take-home project' },
  { id: 'code-review', name: 'Code Review', description: 'Review submitted code' },
  { id: 'culture-fit', name: 'Culture Fit', description: 'Team culture assessment' },
  { id: '2nd-interview', name: '2nd Interview', description: 'Second round interview' },
  { id: 'final-round', name: 'Final Round', description: 'Final interview with leadership' },
  { id: 'reference-check', name: 'Reference Check', description: 'Verify references' },
  { id: 'offer', name: 'Offer', description: 'Extend job offer' },
];

const jobPositions = [
  { id: 'senior-designer', name: 'Senior Product Designer' },
  { id: 'product-manager', name: 'Product Manager' },
  { id: 'frontend-developer', name: 'Frontend Developer' },
  { id: 'backend-developer', name: 'Backend Developer' },
];

export function WorkflowBuilder() {
  const [selectedPosition, setSelectedPosition] = useState('senior-designer');
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([
    { id: 'competency-test', name: 'Competency Test', description: 'Skills assessment' },
    { id: '1st-interview', name: '1st Interview', description: 'First round interview' },
    { id: 'assignment', name: 'Assignment', description: 'Take-home project' },
    { id: '2nd-interview', name: '2nd Interview', description: 'Second round interview' },
    { id: 'offer', name: 'Offer', description: 'Extend job offer' },
  ]);
  const [draggedStage, setDraggedStage] = useState<WorkflowStage | null>(null);

  const handleDragStart = (stage: WorkflowStage) => {
    setDraggedStage(stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    if (!draggedStage) return;

    // Check if stage already exists in workflow
    const stageExists = workflowStages.find(s => s.id === draggedStage.id);
    if (stageExists) {
      setDraggedStage(null);
      return;
    }

    if (index !== undefined) {
      const newStages = [...workflowStages];
      newStages.splice(index, 0, draggedStage);
      setWorkflowStages(newStages);
    } else {
      setWorkflowStages([...workflowStages, draggedStage]);
    }
    setDraggedStage(null);
  };

  const removeStage = (id: string) => {
    setWorkflowStages(workflowStages.filter(s => s.id !== id));
  };

  const handleSave = () => {
    alert(`워크플로우가 저장되었습니다!\n포지션: ${jobPositions.find(p => p.id === selectedPosition)?.name}\n단계 수: ${workflowStages.length}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-[#08102B] text-white px-8 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <VNTGSymbol className="text-[#0248FF]" size={36} />
            <div>
              <h1 className="text-xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Workflow Builder
              </h1>
              <p className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                채용 프로세스 관리자
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="bg-transparent border-white text-white hover:bg-[#0f1a3d]"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              미리보기
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              저장하기
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 pt-[88px]">
        {/* Stage Library - Left Sidebar */}
        <div className="w-80 bg-white border-r p-6 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-lg mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              스테이지 라이브러리
            </h3>
            <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              드래그하여 워크플로우에 추가하세요
            </p>
          </div>

          <div className="space-y-3">
            {stageLibrary.map(stage => (
              <div
                key={stage.id}
                draggable
                onDragStart={() => handleDragStart(stage)}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-move hover:border-[#0248FF] hover:bg-blue-50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <GripVertical size={20} className="text-gray-400 mt-1" />
                  <div className="flex-1">
                    <div className="font-medium mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {stage.name}
                    </div>
                    <div className="text-xs text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {stage.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-[#0248FF] rounded-lg">
            <div className="flex items-start gap-2">
              <Settings className="text-[#0248FF] mt-0.5" size={18} />
              <div>
                <div className="text-sm font-medium mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  커스텀 스테이지 추가
                </div>
                <button className="text-xs text-[#0248FF] underline" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  새 스테이지 만들기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Canvas - Center */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Position Selector */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <label className="block mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                포지션 선택
              </label>
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                {jobPositions.map(position => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Workflow Title */}
            <div className="mb-6">
              <h2 className="text-2xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Recruitment Funnel
              </h2>
              <p className="text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {jobPositions.find(p => p.id === selectedPosition)?.name}의 채용 프로세스
              </p>
            </div>

            {/* Workflow Stages */}
            <div
              className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 min-h-[400px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e)}
            >
              {workflowStages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center">
                  <VNTGSymbol className="text-gray-300 mb-4" size={60} />
                  <p className="text-gray-500 mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    왼쪽에서 스테이지를 드래그하여 시작하세요
                  </p>
                  <p className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    채용 단계를 순서대로 배치할 수 있습니다
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflowStages.map((stage, index) => (
                    <div key={`${stage.id}-${index}`} className="relative">
                      {/* Stage Card */}
                      <div className="bg-white border-2 border-[#0248FF] rounded-lg p-5 flex items-center justify-between group hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#0248FF] text-white flex items-center justify-center">
                            <span className="text-lg" style={{ fontFamily: 'Roboto, sans-serif' }}>
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-lg mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                              {stage.name}
                            </div>
                            <div className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                              {stage.description}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeStage(stage.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="text-red-500" size={20} />
                        </button>
                      </div>

                      {/* Connector Arrow */}
                      {index < workflowStages.length - 1 && (
                        <div className="flex justify-center py-2">
                          <div className="w-0.5 h-6 bg-[#0248FF]"></div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Stage Zone */}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0248FF] hover:bg-blue-50 transition-all cursor-pointer"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e)}
                  >
                    <Plus className="mx-auto mb-2 text-gray-400" size={24} />
                    <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      스테이지를 여기에 드롭하세요
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <Button
                className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                <Plus size={18} />
                새 스테이지 추가
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                <Settings size={18} />
                고급 설정
              </Button>
            </div>
          </div>
        </div>

        {/* Info Panel - Right Sidebar */}
        <div className="w-80 bg-white border-l p-6 overflow-y-auto">
          <h3 className="text-lg mb-4" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            워크플로우 정보
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                총 단계 수
              </div>
              <div className="text-2xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {workflowStages.length}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                예상 소요 시간
              </div>
              <div className="text-2xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {workflowStages.length * 3-5} days
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-[#0248FF] rounded-lg">
              <div className="text-sm font-medium mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                💡 추천 사항
              </div>
              <ul className="text-xs text-gray-700 space-y-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                <li>• 5-7단계가 가장 효율적입니다</li>
                <li>• 초기 스크리닝을 포함하세요</li>
                <li>• 최종 단계 전 레퍼런스 체크 권장</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                최근 변경 사항
              </h4>
              <div className="text-xs text-gray-500 space-y-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                <div>• 2026-02-06: Assignment 추가</div>
                <div>• 2026-02-05: 포지션 변경</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
