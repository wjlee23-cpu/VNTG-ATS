import { useState } from 'react';
import { Search, Filter, MoreVertical, CheckSquare, Square, Sparkles } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VNTGSymbol } from '../vntg/VNTGSymbol';

interface Candidate {
  id: string;
  name: string;
  stage: string;
  schedulingStatus: 'Internal Sync' | 'Sent to Candidate' | 'Reschedule Req' | 'Confirmed';
  appliedDate: string;
  position: string;
  email: string;
  archiveReason?: string;
}

const mockCandidates: Candidate[] = [
  { id: '1', name: 'Sarah Kim', stage: 'Interview', schedulingStatus: 'Confirmed', appliedDate: '2026-02-03', position: 'Senior Product Designer', email: 'sarah@email.com' },
  { id: '2', name: 'James Lee', stage: 'Lead', schedulingStatus: 'Sent to Candidate', appliedDate: '2026-02-04', position: 'Product Manager', email: 'james@email.com' },
  { id: '3', name: 'Emma Park', stage: 'Interview', schedulingStatus: 'Internal Sync', appliedDate: '2026-02-02', position: 'UX Researcher', email: 'emma@email.com' },
  { id: '4', name: 'Michael Choi', stage: 'Applicant', schedulingStatus: 'Internal Sync', appliedDate: '2026-02-05', position: 'Frontend Developer', email: 'michael@email.com' },
  { id: '5', name: 'Lisa Jung', stage: 'Interview', schedulingStatus: 'Reschedule Req', appliedDate: '2026-02-01', position: 'Senior Product Designer', email: 'lisa@email.com' },
  { id: '6', name: 'David Han', stage: 'Lead', schedulingStatus: 'Confirmed', appliedDate: '2026-02-04', position: 'Backend Developer', email: 'david@email.com' },
];

const mockArchivedCandidates: Candidate[] = [
  { id: 'a1', name: 'John Smith', stage: 'Archive', schedulingStatus: 'Confirmed', appliedDate: '2026-01-15', position: 'Senior Product Designer', email: 'john@email.com', archiveReason: 'Position Filled' },
  { id: 'a2', name: 'Amy Chen', stage: 'Archive', schedulingStatus: 'Waiting', appliedDate: '2026-01-20', position: 'Product Manager', email: 'amy@email.com', archiveReason: 'Position Filled' },
  { id: 'a3', name: 'Robert Lee', stage: 'Archive', schedulingStatus: 'Confirmed', appliedDate: '2026-01-22', position: 'UX Designer', email: 'robert@email.com', archiveReason: 'Better for another role' },
  { id: 'a4', name: 'Maria Garcia', stage: 'Archive', schedulingStatus: 'Waiting', appliedDate: '2026-01-25', position: 'Frontend Developer', email: 'maria@email.com', archiveReason: 'Under-qualified' },
  { id: 'a5', name: 'Kevin Park', stage: 'Archive', schedulingStatus: 'Confirmed', appliedDate: '2026-01-28', position: 'Backend Developer', email: 'kevin@email.com', archiveReason: 'Timing' },
  { id: 'a6', name: 'Sophie Kim', stage: 'Archive', schedulingStatus: 'Waiting', appliedDate: '2026-01-30', position: 'Product Designer', email: 'sophie@email.com', archiveReason: 'Withdrew' },
];

const stages = [
  { name: 'Applicant', count: 24 },
  { name: 'Interview', count: 8 },
  { name: 'Archive', count: 156 },
];

const applicantSubStages = [
  { id: 'new-applicant', label: 'New Applicant', count: 8 },
  { id: 'screening', label: 'Screening', count: 6 },
  { id: 'hm-review', label: 'HM Review', count: 10 },
];

const archiveReasons = [
  { id: 'position-filled', label: 'Position Filled', count: 68 },
  { id: 'under-qualified', label: 'Under-qualified', count: 31 },
  { id: 'timing', label: 'Timing', count: 15 },
  { id: 'withdrew', label: 'Withdrew', count: 12 },
];

// Job-specific interview stages
const interviewStagesByJob: Record<string, Array<{ id: string; label: string; count: number }>> = {
  'senior-designer': [
    { id: 'competency-test', label: 'Competency Test', count: 12 },
    { id: '1st-interview', label: '1st Interview', count: 8 },
    { id: 'assignment', label: 'Assignment', count: 5 },
    { id: '2nd-interview', label: '2nd Interview', count: 3 },
    { id: 'offer', label: 'Offer', count: 2 },
  ],
  'product-manager': [
    { id: 'screening', label: 'Screening', count: 6 },
    { id: 'case-study', label: 'Case Study', count: 4 },
    { id: 'team-interview', label: 'Team Interview', count: 3 },
    { id: 'final-round', label: 'Final Round', count: 2 },
    { id: 'offer', label: 'Offer', count: 1 },
  ],
  'frontend-developer': [
    { id: 'tech-test', label: 'Tech Test', count: 8 },
    { id: 'code-review', label: 'Code Review', count: 6 },
    { id: 'tech-interview', label: 'Tech Interview', count: 4 },
    { id: 'culture-fit', label: 'Culture Fit', count: 2 },
    { id: 'offer', label: 'Offer', count: 1 },
  ],
};

const jobsList = [
  { id: 'senior-designer', name: 'Senior Product Designer', count: 8 },
  { id: 'product-manager', name: 'Product Manager', count: 4 },
  { id: 'frontend-developer', name: 'Frontend Developer', count: 6 },
];

export function CandidateDashboard({ onCandidateSelect }: { onCandidateSelect: (id: string) => void }) {
  const [activeStage, setActiveStage] = useState('Interview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeApplicantSubStage, setActiveApplicantSubStage] = useState('new-applicant');
  const [activeArchiveReason, setActiveArchiveReason] = useState('position-filled');
  const [selectedJob, setSelectedJob] = useState('senior-designer');
  const [activeInterviewStage, setActiveInterviewStage] = useState('competency-test');

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === mockCandidates.length ? [] : mockCandidates.map(c => c.id));
  };

  const displayedCandidates = activeStage === 'Archive' ? mockArchivedCandidates : mockCandidates;

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#08102B] text-white p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <VNTGSymbol className="text-[#0248FF]" size={32} />
          <span className="font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>VNTG</span>
        </div>

        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>내 채용 공고</h3>
          <div className="space-y-2">
            {jobsList.map(job => (
              <div
                key={job.id}
                onClick={() => {
                  setSelectedJob(job.id);
                  setActiveInterviewStage(interviewStagesByJob[job.id][0].id);
                }}
                className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                  selectedJob === job.id
                    ? 'bg-[#0248FF] text-white'
                    : 'hover:bg-[#0f1a3d]'
                }`}
              >
                {job.name} <span className={selectedJob === job.id ? 'text-blue-200' : 'text-gray-400'}>({job.count})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>필터</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>지원 날짜</span>
            </div>
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>평가 점수</span>
            </div>
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>AI 분석 상태</span>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <div className="text-xs text-gray-400 mb-2">Powered by VNTG AI</div>
          <VNTGSymbol className="text-[#0248FF] opacity-20" size={48} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="bg-[#08102B] text-white px-6 py-3">
          <div className="flex items-center gap-6">
            {stages.map(stage => (
              <button
                key={stage.name}
                onClick={() => setActiveStage(stage.name)}
                className={`px-4 py-2 rounded-t transition-colors ${
                  activeStage === stage.name
                    ? 'bg-white text-[#08102B]'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <span style={{ fontFamily: 'Roboto, sans-serif' }}>{stage.name}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                  {stage.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="후보자 검색..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              />
            </div>
            <Button
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              {activeStage === 'Applicant' ? 'Add Candidate' : activeStage === 'Interview' ? 'Schedule Interview' : 'Smart Action'}
            </Button>
          </div>
        </div>

        {/* Applicant Sub-Stage Filter Bar - Only visible when Applicant tab is active */}
        {activeStage === 'Applicant' && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4">
              {applicantSubStages.map(subStage => (
                <button
                  key={subStage.id}
                  onClick={() => setActiveApplicantSubStage(subStage.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeApplicantSubStage === subStage.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {subStage.count}
                  </div>
                  <div 
                    className="text-sm text-gray-700"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    {subStage.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Archive Reason Filter Bar - Only visible when Archive tab is active */}
        {activeStage === 'Archive' && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4">
              {archiveReasons.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => setActiveArchiveReason(reason.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeArchiveReason === reason.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {reason.count}
                  </div>
                  <div 
                    className="text-sm text-gray-700"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    {reason.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interview Stage Filter Bar - Only visible when Interview tab is active */}
        {activeStage === 'Interview' && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4 overflow-x-auto">
              {interviewStagesByJob[selectedJob]?.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setActiveInterviewStage(stage.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeInterviewStage === stage.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {stage.count}
                  </div>
                  <div 
                    className="text-sm text-gray-700"
                    style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                  >
                    {stage.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Candidate List */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 p-4">
                  <button onClick={toggleAll}>
                    {selectedIds.length === mockCandidates.length ? (
                      <CheckSquare className="text-[#0248FF]" size={20} />
                    ) : (
                      <Square className="text-gray-400" size={20} />
                    )}
                  </button>
                </th>
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  이름
                </th>
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  포지션
                </th>
                {activeStage === 'Interview' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    AI 스케줄링 상태
                  </th>
                )}
                {activeStage === 'Applicant' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    현재 리뷰 상태
                  </th>
                )}
                {activeStage === 'Archive' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    보관 사유
                  </th>
                )}
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  지원일
                </th>
                <th className="w-12 p-4"></th>
              </tr>
            </thead>
            <tbody>
              {displayedCandidates.map(candidate => (
                <tr
                  key={candidate.id}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onCandidateSelect(candidate.id)}
                >
                  <td className="p-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(candidate.id);
                      }}
                    >
                      {selectedIds.includes(candidate.id) ? (
                        <CheckSquare className="text-[#0248FF]" size={20} />
                      ) : (
                        <Square className="text-gray-400" size={20} />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div style={{ fontFamily: 'Roboto, sans-serif' }}>{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.email}</div>
                  </td>
                  <td className="p-4 text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {candidate.position}
                  </td>
                  {activeStage === 'Interview' && (
                    <td className="p-4">
                      <Badge
                        className={
                          candidate.schedulingStatus === 'Confirmed'
                            ? 'bg-[#0248FF] text-white hover:bg-[#0248FF]'
                            : candidate.schedulingStatus === 'Sent to Candidate'
                            ? 'bg-[#5287FF] text-white hover:bg-[#5287FF]'
                            : candidate.schedulingStatus === 'Reschedule Req'
                            ? 'bg-orange-500 text-white hover:bg-orange-500'
                            : 'bg-gray-400 text-white hover:bg-gray-400'
                        }
                      >
                        {candidate.schedulingStatus}
                      </Badge>
                    </td>
                  )}
                  {activeStage === 'Applicant' && (
                    <td className="p-4">
                      <Badge className="bg-gray-100 text-gray-700">
                        Pending
                      </Badge>
                    </td>
                  )}
                  {activeStage === 'Archive' && (
                    <td className="p-4">
                      <Badge className="bg-gray-200 text-gray-700">
                        {candidate.archiveReason}
                      </Badge>
                    </td>
                  )}
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(candidate.appliedDate).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}