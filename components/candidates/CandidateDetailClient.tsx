'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Mail,
  Phone,
  Award,
  Briefcase,
  Star,
  MessageSquare,
  Plus,
  CheckCircle2,
  Archive,
  Users,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { updateCandidateStatus } from '@/actions/candidates'

interface CandidateDetailClientProps {
  candidate: any
  jobPost: any
  schedules: any[]
  timelineEvents: any[]
  scheduleWithInterviewers: any
}

export function CandidateDetailClient({
  candidate,
  jobPost,
  schedules,
  timelineEvents,
  scheduleWithInterviewers,
}: CandidateDetailClientProps) {
  const [isSchedulingExpanded, setIsSchedulingExpanded] = useState(false)

  // Convert timeline events to figma format
  const timelineItems = timelineEvents.map((event) => {
    let type: 'email' | 'scorecard' | 'comment' | 'approval' = 'comment'
    if (event.type === 'email') type = 'email'
    else if (event.type === 'scorecard') type = 'scorecard'
    else if (event.type === 'approval') type = 'approval'

    // Handle content - it might be an object or string
    let content = ''
    if (event.content) {
      if (typeof event.content === 'string') {
        content = event.content
      } else if (typeof event.content === 'object') {
        // If content is an object, try to extract message or stringify it
        content = event.content.message || event.content.content || JSON.stringify(event.content)
      }
    } else if (event.description) {
      content = typeof event.description === 'string' ? event.description : JSON.stringify(event.description)
    }

    return {
      id: event.id,
      type,
      timestamp: event.created_at,
      author: event.users?.email || event.created_by || 'System',
      content,
      rating: event.rating,
    }
  })

  // If no timeline events, add a default one
  if (timelineItems.length === 0) {
    timelineItems.push({
      id: 'default',
      type: 'email' as const,
      timestamp: candidate.created_at,
      author: candidate.name,
      content: `${candidate.name}님이 지원하셨습니다.`,
    })
  }

  const handleAdvance = async () => {
    await updateCandidateStatus(candidate.id, 'in_progress')
    window.location.reload()
  }

  const handleArchive = async () => {
    await updateCandidateStatus(candidate.id, 'rejected')
    window.location.reload()
  }

  return (
    <div className="bg-white">
      {/* Top Nav */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/"
          className="hover:bg-gray-100 p-2 rounded transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
          Candidate Details
        </h2>
      </div>

      {/* Candidate Header */}
      <div className="bg-white border-b px-0 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {candidate.name}
              </h1>
              <p className="text-gray-600 mb-3 text-lg" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {jobPost?.title || 'N/A'}
              </p>
              <Badge className="bg-[#5287FF] text-white hover:bg-[#5287FF]">
                {candidate.status === 'pending'
                  ? 'Applicant'
                  : candidate.status === 'in_progress'
                    ? 'Interview'
                    : candidate.status === 'confirmed'
                      ? 'Confirmed'
                      : 'Archive'}
              </Badge>
            </div>
            <div className="flex gap-3">
              {candidate.status === 'pending' && (
                <form action={handleAdvance}>
                  <Button
                    type="submit"
                    className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2 px-6 py-3"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    <CheckCircle2 size={20} />
                    Advance to Interview
                  </Button>
                </form>
              )}
              <form action={handleArchive}>
                <Button
                  type="submit"
                  variant="outline"
                  className="border-2 flex items-center gap-2 px-6 py-3"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  <Archive size={20} />
                  Archive
                </Button>
              </form>
            </div>
          </div>
        </div>

      {/* AI Parsed Data Section */}
      <div className="px-0 py-6 bg-gray-50 border-b">
          <h3 className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            AI 분석 데이터
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border flex items-start gap-3">
              <Mail className="text-[#0248FF] mt-1" size={20} />
              <div>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  이메일
                </div>
                <div className="text-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  {candidate.email}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border flex items-start gap-3">
              <Phone className="text-[#0248FF] mt-1" size={20} />
              <div>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  연락처
                </div>
                <div className="text-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  {candidate.phone || 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border flex items-start gap-3">
              <Briefcase className="text-[#0248FF] mt-1" size={20} />
              <div>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  경력
                </div>
                <div className="text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {candidate.experience || 'N/A'}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border flex items-start gap-3">
              <Award className="text-[#0248FF] mt-1" size={20} />
              <div>
                <div className="text-xs text-gray-500 mb-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  자격증
                </div>
                <div className="text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {candidate.certifications || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Attached Documents Section */}
      <div className="px-0 py-6 bg-white border-b">
          <h3 className="text-sm text-gray-500 mb-4" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            첨부 문서
          </h3>

          {/* Document Card */}
          <div className="border border-gray-300 rounded-lg p-4 flex items-center gap-4 bg-white hover:bg-gray-50 transition-colors">
            {/* Left Side - Thumbnail Preview */}
            <div className="flex-shrink-0 w-24 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded border border-gray-300 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex flex-col p-2">
                <div className="w-full h-1.5 bg-gray-400 rounded mb-1"></div>
                <div className="w-3/4 h-1 bg-gray-300 rounded mb-1"></div>
                <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
                <div className="w-2/3 h-1 bg-gray-300 rounded mb-2"></div>
                <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
                <div className="w-5/6 h-1 bg-gray-300 rounded mb-1"></div>
                <div className="w-full h-1 bg-gray-300 rounded"></div>
              </div>
              <FileText className="absolute bottom-2 right-2 text-gray-400" size={20} />
            </div>

            {/* Right Side - File Info */}
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-base mb-1" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  {candidate.resume_file_name || `${candidate.name}_Resume.pdf`}
                </h4>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {candidate.resume_file_size || '2.4 MB'}
                  </span>
                  <span style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    업로드: {new Date(candidate.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {candidate.resume_file_url && (
                  <>
                    <Button
                      className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2 px-4 py-2"
                      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                      onClick={() => window.open(candidate.resume_file_url, '_blank')}
                    >
                      <Eye size={18} />
                      전체 화면 보기
                    </Button>
                    <Button
                      variant="outline"
                      className="border-2 border-[#0248FF] text-[#0248FF] hover:bg-[#0248FF] hover:text-white flex items-center gap-2 px-4 py-2"
                      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = candidate.resume_file_url
                        link.download = candidate.resume_file_name || 'resume.pdf'
                        link.click()
                      }}
                    >
                      <Download size={18} />
                      다운로드
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* AI Scheduling Progress Module - Collapsible */}
      {scheduleWithInterviewers && (
        <div className="px-0 py-4 bg-white border-b">
            <div className="bg-blue-50 border border-[#5287FF] rounded-lg overflow-hidden">
              {/* Collapsible Header - Always Visible */}
              <button
                onClick={() => setIsSchedulingExpanded(!isSchedulingExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="text-[#0248FF]" size={20} />
                  <span className="font-medium" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    AI Scheduling Progress
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className="bg-[#5287FF] text-white text-xs">
                    Step {scheduleWithInterviewers.progress.step}: Internal Sync -{' '}
                    {scheduleWithInterviewers.progress.accepted}/{scheduleWithInterviewers.progress.total} Accepted
                  </Badge>
                  {isSchedulingExpanded ? (
                    <ChevronUp className="text-[#0248FF]" size={20} />
                  ) : (
                    <ChevronDown className="text-[#0248FF]" size={20} />
                  )}
                </div>
              </button>

              {/* Collapsible Body - Conditional */}
              {isSchedulingExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-[#5287FF]">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        면접관 시간 수락 현황
                      </span>
                      <span className="text-sm font-medium text-[#0248FF]" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        {scheduleWithInterviewers.progress.accepted}/{scheduleWithInterviewers.progress.total} Accepted
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#0248FF] h-2 rounded-full"
                        style={{
                          width: `${
                            (scheduleWithInterviewers.progress.accepted /
                              scheduleWithInterviewers.progress.total) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Interviewer List */}
                  <div className="space-y-2 mb-4">
                    {scheduleWithInterviewers.interviewers.map((interviewer: any, index: number) => (
                      <div key={interviewer.id || index} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div className="flex items-center gap-2">
                          <Users size={16} className={interviewer.status === 'accepted' ? 'text-[#0248FF]' : 'text-gray-400'} />
                          <span className="text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                            {interviewer.name || interviewer.email}
                          </span>
                        </div>
                        <Badge
                          className={
                            interviewer.status === 'accepted'
                              ? 'bg-[#0248FF] text-white text-xs'
                              : 'bg-gray-300 text-gray-700 text-xs'
                          }
                        >
                          {interviewer.status === 'accepted' ? 'Accepted' : 'Pending'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <Button
                    className={`w-full flex items-center justify-center gap-2 mb-3 ${
                      scheduleWithInterviewers.progress.accepted === scheduleWithInterviewers.progress.total
                        ? 'bg-[#0248FF] hover:bg-[#0236cc] text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={scheduleWithInterviewers.progress.accepted !== scheduleWithInterviewers.progress.total}
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    <Mail size={16} />
                    Send Options to Candidate
                    {scheduleWithInterviewers.progress.accepted !== scheduleWithInterviewers.progress.total && (
                      <span className="text-xs">(Available when all accept)</span>
                    )}
                  </Button>

                  {/* Info Alert */}
                  {scheduleWithInterviewers.progress.accepted < scheduleWithInterviewers.progress.total && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-yellow-800" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {scheduleWithInterviewers.progress.total - scheduleWithInterviewers.progress.accepted}명의 면접관이 아직 시간을 확정하지 않았습니다. 자동 리마인더가 24시간마다 발송됩니다.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Timeline Thread */}
      <div className="px-0 py-6 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              타임라인
            </h3>
            <Button className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2">
              <Plus size={18} />
              <span style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>노트 추가</span>
            </Button>
          </div>

          <div className="space-y-6">
            {timelineItems.map((item, index) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'scorecard'
                        ? 'bg-[#5287FF]'
                        : item.type === 'email'
                          ? 'bg-[#0248FF]'
                          : item.type === 'approval'
                            ? 'bg-[#0248FF]'
                            : 'bg-gray-400'
                    }`}
                  >
                    {item.type === 'scorecard' && <Star className="text-white" size={20} />}
                    {item.type === 'email' && <Mail className="text-white" size={20} />}
                    {item.type === 'comment' && <MessageSquare className="text-white" size={20} />}
                    {item.type === 'approval' && <CheckCircle2 className="text-white" size={20} />}
                  </div>
                  {index < timelineItems.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 my-2 min-h-[40px]"></div>
                  )}
                </div>

                <div className="flex-1 bg-white border rounded-lg p-4 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        {item.author || 'System'}
                      </span>
                      {item.type === 'scorecard' && item.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={
                                i < Math.floor(item.rating!) ? 'fill-[#0248FF] text-[#0248FF]' : 'text-gray-300'
                              }
                            />
                          ))}
                          <span className="text-sm text-gray-600 ml-1">{item.rating}/5</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {item.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  )
}
