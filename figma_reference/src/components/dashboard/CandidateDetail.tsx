import { ArrowLeft, Mail, Phone, Award, Briefcase, Star, MessageSquare, Plus, CheckCircle2, Archive, Users, Clock, AlertTriangle, ChevronDown, ChevronUp, Eye, Download, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VNTGSymbol } from '../vntg/VNTGSymbol';
import { useState } from 'react';

interface TimelineItem {
  id: string;
  type: 'email' | 'scorecard' | 'comment' | 'approval';
  timestamp: string;
  author?: string;
  content: string;
  rating?: number;
}

const mockTimeline: TimelineItem[] = [
  {
    id: '0',
    type: 'approval',
    timestamp: '2026-02-05T09:15:00',
    author: 'System',
    content: 'HM Review Passed by @JohnDoe, assigned to Technical Interview stage.',
  },
  {
    id: '1',
    type: 'scorecard',
    timestamp: '2026-02-04T14:30:00',
    author: 'Jane Smith, Lead Designer',
    content: 'Great portfolio showcasing strong design systems work. Excellent understanding of user research methodologies.',
    rating: 4.5,
  },
  {
    id: '2',
    type: 'email',
    timestamp: '2026-02-04T10:15:00',
    author: 'Sarah Kim',
    content: 'Thank you for the opportunity! I\'m excited to discuss how my experience in design systems can contribute to VNTG.',
  },
  {
    id: '3',
    type: 'comment',
    timestamp: '2026-02-03T16:45:00',
    author: 'Mike Johnson',
    content: '@team Let\'s fast-track this candidate to the final round. The AI analysis shows strong match with our requirements.',
  },
  {
    id: '4',
    type: 'email',
    timestamp: '2026-02-03T09:00:00',
    author: 'VNTG Recruiting Team',
    content: 'Hi Sarah, We\'ve reviewed your application and would like to schedule an interview. Please use our scheduling tool.',
  },
  {
    id: '5',
    type: 'scorecard',
    timestamp: '2026-02-02T16:20:00',
    author: 'David Lee, Tech Lead',
    content: 'Impressive technical background with strong knowledge of modern design tools. Portfolio shows clear problem-solving approach.',
    rating: 4.0,
  },
  {
    id: '6',
    type: 'comment',
    timestamp: '2026-02-02T11:30:00',
    author: 'HR Team',
    content: 'Candidate has 8 years of experience at top tech companies. Strong cultural fit based on initial screening.',
  },
  {
    id: '7',
    type: 'email',
    timestamp: '2026-02-01T14:00:00',
    author: 'Sarah Kim',
    content: 'I submitted my application for the Senior Product Designer position. Looking forward to hearing from you!',
  },
];

export interface CandidateDetailProps {
  candidateId: string;
  onBack: () => void;
}

export function CandidateDetail({ candidateId, onBack }: CandidateDetailProps) {
  const [isSchedulingExpanded, setIsSchedulingExpanded] = useState(false);

  const candidateData = {
    id: candidateId,
    name: 'Sarah Kim',
    position: 'Senior Product Designer',
    email: 'sarah.kim@example.com',
    phone: '+82 10-1234-5678',
    experience: '8년 (Naver, Kakao)',
    certifications: 'UX Professional Certification',
    appliedDate: '2026-02-03',
    stage: 'Interview',
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sticky Dimmed Sidebar */}
      <div className="w-64 bg-[#2D2D2D] text-white p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-8">
          <VNTGSymbol className="text-[#0248FF]" size={32} />
          <span className="font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>VNTG</span>
        </div>
        <div className="text-sm text-gray-400">Dashboard</div>
      </div>

      {/* Main Content - Full Height, Natural Scroll */}
      <div className="flex-1">
        {/* Top Nav - Sticky */}
        <div className="bg-[#08102B] text-white px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={onBack}
            className="hover:bg-[#0f1a3d] p-2 rounded transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <VNTGSymbol className="text-[#0248FF]" size={24} />
          <span className="text-lg" style={{ fontFamily: 'Roboto, sans-serif' }}>Candidate Details</span>
        </div>

        {/* Candidate Header */}
        <div className="bg-white border-b px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {candidateData.name}
              </h1>
              <p className="text-gray-600 mb-3 text-lg" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {candidateData.position}
              </p>
              <Badge className="bg-[#5287FF] text-white hover:bg-[#5287FF]">
                {candidateData.stage}
              </Badge>
            </div>
            <div className="flex gap-3">
              <Button 
                className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2 px-6 py-3" 
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                <CheckCircle2 size={20} />
                Advance to Interview
              </Button>
              <Button 
                variant="outline" 
                className="border-2 flex items-center gap-2 px-6 py-3"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                <Archive size={20} />
                Archive
              </Button>
            </div>
          </div>
        </div>

        {/* AI Parsed Data Section */}
        <div className="px-8 py-6 bg-gray-50 border-b">
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
                  {candidateData.email}
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
                  {candidateData.phone}
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
                  {candidateData.experience}
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
                  {candidateData.certifications}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Attached Documents Section - Original Resume Preview */}
        <div className="px-8 py-6 bg-white border-b">
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
                  Sarah_Kim_Portfolio.pdf
                </h4>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span style={{ fontFamily: 'Roboto, sans-serif' }}>2.4 MB</span>
                  <span style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    업로드: 2026-02-03
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button 
                  className="bg-[#0248FF] hover:bg-[#0236cc] text-white flex items-center gap-2 px-4 py-2"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  <Eye size={18} />
                  전체 화면 보기
                </Button>
                <Button 
                  variant="outline"
                  className="border-2 border-[#0248FF] text-[#0248FF] hover:bg-[#0248FF] hover:text-white flex items-center gap-2 px-4 py-2"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  <Download size={18} />
                  다운로드
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Scheduling Progress Module - Collapsible */}
        <div className="px-8 py-4 bg-white border-b">
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
                  Step 1: Internal Sync - 2/3 Accepted
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
                      2/3 Accepted
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#0248FF] h-2 rounded-full" style={{ width: '66%' }}></div>
                  </div>
                </div>

                {/* Interviewer List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-[#0248FF]" />
                      <span className="text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>Jane Smith (Lead Designer)</span>
                    </div>
                    <Badge className="bg-[#0248FF] text-white text-xs">Accepted</Badge>
                  </div>
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-[#0248FF]" />
                      <span className="text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>Mike Johnson (Product Manager)</span>
                    </div>
                    <Badge className="bg-[#0248FF] text-white text-xs">Accepted</Badge>
                  </div>
                  <div className="flex items-center justify-between bg-white p-3 rounded border">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>David Lee (Tech Lead)</span>
                    </div>
                    <Badge className="bg-gray-300 text-gray-700 text-xs">Pending</Badge>
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  className="w-full bg-gray-300 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2 mb-3" 
                  disabled
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  <Mail size={16} />
                  Send Options to Candidate
                  <span className="text-xs">(Available when all accept)</span>
                </Button>

                {/* Info Alert */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-yellow-800" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    1명의 면접관이 아직 시간을 확정하지 않았습니다. 자동 리마인더가 24시간마다 발송됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Thread - Natural Scroll (No Container Constraints) */}
        <div className="px-8 py-6 pb-12">
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
            {mockTimeline.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'scorecard' ? 'bg-[#5287FF]' :
                    item.type === 'email' ? 'bg-[#0248FF]' :
                    item.type === 'approval' ? 'bg-[#0248FF]' :
                    'bg-gray-400'
                  }`}>
                    {item.type === 'scorecard' && <Star className="text-white" size={20} />}
                    {item.type === 'email' && <Mail className="text-white" size={20} />}
                    {item.type === 'comment' && <MessageSquare className="text-white" size={20} />}
                    {item.type === 'approval' && <CheckCircle2 className="text-white" size={20} />}
                  </div>
                  {item.id !== mockTimeline[mockTimeline.length - 1].id && (
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
                              className={i < Math.floor(item.rating!) ? 'fill-[#0248FF] text-[#0248FF]' : 'text-gray-300'}
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
                        minute: '2-digit'
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
    </div>
  );
}