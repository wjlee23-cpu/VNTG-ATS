'use client'

interface Stage {
  id: string
  name: string
}

interface StageCardsProps {
  stages: Stage[]
  candidates: Array<{ current_stage_id: string | null }>
  activeStage: string | null
  onStageSelect: (stageId: string) => void
}

export function StageCards({ stages, candidates, activeStage, onStageSelect }: StageCardsProps) {
  const getStageCount = (stageId: string) => {
    return candidates.filter((c) => c.current_stage_id === stageId).length
  }

  return (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex items-center gap-4 overflow-x-auto">
        {stages.map((stage) => {
          const count = getStageCount(stage.id)
          const isActive = activeStage === stage.id

          return (
            <button
              key={stage.id}
              onClick={() => onStageSelect(stage.id)}
              className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] flex-shrink-0 ${
                isActive
                  ? 'border-[#0248FF] border-b-4 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {count}
              </div>
              <div className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {stage.name}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
