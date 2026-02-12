'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import { createJobPost, updateJobPost } from '@/actions/jobs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface WorkflowStage {
  id: string
  name: string
  assignedTo: string
}

interface JobPostingBuilderProps {
  processes?: Array<{ id: string; name: string }>
  jobId?: string
  initialJob?: {
    title: string
    description?: string | null
    department?: string
    processes?: {
      stages?: any
    } | null
  }
}

export function JobPostingBuilder({ processes = [], jobId, initialJob }: JobPostingBuilderProps) {
  const router = useRouter()
  const isEditMode = !!jobId && !!initialJob
  
  const [jobTitle, setJobTitle] = useState(initialJob?.title || '')
  const [department, setDepartment] = useState(initialJob?.department || 'Product')
  const [jobDescription, setJobDescription] = useState(initialJob?.description || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Load stages from initial job if in edit mode
  useEffect(() => {
    if (isEditMode && initialJob?.processes?.stages) {
      const stages = Array.isArray(initialJob.processes.stages) 
        ? initialJob.processes.stages 
        : typeof initialJob.processes.stages === 'string'
          ? JSON.parse(initialJob.processes.stages)
          : []
      
      if (stages.length > 0) {
        setStages(stages.map((stage: any, index: number) => ({
          id: stage.id || `stage-${index}`,
          name: stage.name || '',
          assignedTo: stage.assignedTo || '',
        })))
      }
    }
  }, [isEditMode, initialJob])

  const [stages, setStages] = useState<WorkflowStage[]>([
    { id: '1', name: 'Document Review', assignedTo: 'HR Team' },
    { id: '2', name: '1st Interview', assignedTo: 'Hiring Manager' },
  ])

  const addStage = () => {
    const newStage: WorkflowStage = {
      id: Date.now().toString(),
      name: 'New Stage',
      assignedTo: '',
    }
    setStages([...stages, newStage])
  }

  const removeStage = (id: string) => {
    setStages(stages.filter((s) => s.id !== id))
  }

  const updateStage = (id: string, field: 'name' | 'assignedTo', value: string) => {
    setStages(stages.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const handleSave = async () => {
    if (!jobTitle || !jobDescription) {
      alert('제목과 설명을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && jobId) {
        // Update existing job
        await updateJobPost(jobId, {
          title: jobTitle,
          description: jobDescription,
        })
        alert('채용 공고가 수정되었습니다!')
      } else {
        // Create new job
        // TODO: 실제 프로세스 생성 및 연결 로직 구현
        await createJobPost({
          title: jobTitle,
          description: jobDescription,
          processId: '', // TODO: 실제 process ID 사용
        })
        alert('채용 공고가 생성되었습니다!')
      }
      router.push('/jobs')
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} job post:`, error)
      alert(`채용 공고 ${isEditMode ? '수정' : '생성'}에 실패했습니다.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (confirm('작성 중인 내용이 저장되지 않습니다. 정말 취소하시겠습니까?')) {
      router.push('/jobs')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-[#08102B] text-white px-8 py-5 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <VNTGSymbol className="text-[#0248FF]" size={36} />
            <div>
              <h1 className="text-2xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {isEditMode ? 'Edit Job Posting' : 'Create New Job Posting'}
              </h1>
              <p className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                채용 공고 및 프로세스 설정
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="bg-transparent border-white text-white hover:bg-[#0f1a3d]"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              <Save size={18} />
              {isSubmitting ? '저장 중...' : (isEditMode ? 'Update Job' : 'Publish Job')}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F7FA] px-8 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Section 1: Job Basic Info */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-xl mb-1" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Job Basic Information
              </h2>
              <p className="text-sm text-gray-500 mb-6" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                기본 채용 공고 정보를 입력하세요
              </p>

              <div className="space-y-6">
                {/* Job Title */}
                <div>
                  <label className="block text-sm mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g., Senior Product Designer"
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    Department <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF] appearance-none"
                      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                    >
                      <option value="Product">Product</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      size={20}
                    />
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-sm mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    Job Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={8}
                    placeholder="Describe the role, responsibilities, requirements, and benefits..."
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF] resize-none"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  />
                  <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    💡 Tip: Include role overview, key responsibilities, required qualifications, and benefits
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Recruitment Pipeline */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-xl mb-1" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Define Hiring Process & Assign Team
              </h2>
              <p className="text-sm text-gray-500 mb-6" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                각 단계별 담당자를 지정하세요
              </p>

              <div className="space-y-4">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="relative">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 hover:border-[#0248FF] transition-all">
                      <div className="flex items-start gap-4">
                        {/* Stage Number */}
                        <div className="w-10 h-10 rounded-full bg-[#0248FF] text-white flex items-center justify-center flex-shrink-0">
                          <span style={{ fontFamily: 'Roboto, sans-serif' }}>{index + 1}</span>
                        </div>

                        {/* Stage Content */}
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          {/* Stage Name */}
                          <div>
                            <label
                              className="block text-xs text-gray-500 mb-2"
                              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                            >
                              Stage Name
                            </label>
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                              placeholder="e.g., Document Review"
                              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                            />
                          </div>

                          {/* Assigned To */}
                          <div>
                            <label
                              className="block text-xs text-gray-500 mb-2"
                              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                            >
                              Reviewer / Interviewer
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={stage.assignedTo}
                                onChange={(e) => updateStage(stage.id, 'assignedTo', e.target.value)}
                                placeholder="e.g., HR Team, John Doe"
                                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => removeStage(stage.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Connector */}
                    {index < stages.length - 1 && (
                      <div className="flex justify-center py-2">
                        <div className="w-0.5 h-4 bg-[#0248FF]"></div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Stage Button */}
                <button
                  onClick={addStage}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#0248FF] hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center justify-center gap-2 text-gray-500 group-hover:text-[#0248FF]">
                    <Plus size={20} />
                    <span style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>Add Stage</span>
                  </div>
                </button>
              </div>

              {/* Workflow Summary */}
              <div className="mt-6 bg-blue-50 border border-[#0248FF] rounded-lg p-5">
                <h4 className="text-sm mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  📋 Workflow Summary
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <div>
                    <span className="text-gray-600">Total Stages:</span>
                    <span className="ml-2 font-medium text-[#0248FF]">{stages.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Assigned Reviewers:</span>
                    <span className="ml-2 font-medium text-[#0248FF]">
                      {stages.filter((s) => s.assignedTo).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Est. Duration:</span>
                    <span className="ml-2 font-medium text-[#0248FF]">
                      {stages.length * 3}-{stages.length * 5} days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Card */}
            <div className="bg-white rounded-lg shadow-sm p-8 border-2 border-[#0248FF]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#0248FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <h3 className="text-lg mb-1" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    Preview
                  </h3>
                  <p className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    공고가 게시되면 다음과 같이 표시됩니다
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-2xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  {jobTitle || 'Job Title'}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">📍 {department}</span>
                  <span className="flex items-center gap-1">⏱️ {stages.length} stage process</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {jobDescription || 'Job description will appear here...'}
                </p>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}
