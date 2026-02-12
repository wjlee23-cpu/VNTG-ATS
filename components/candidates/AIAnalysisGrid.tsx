import { Mail, Phone, Briefcase, Award } from 'lucide-react'

interface AIAnalysisGridProps {
  candidate: {
    email: string
    phone?: string
    // TODO: Add career and certification fields when available in DB
  }
}

export function AIAnalysisGrid({ candidate }: AIAnalysisGridProps) {
  const items = [
    {
      icon: Mail,
      label: '이메일',
      value: candidate.email,
      fontFamily: 'Roboto, sans-serif',
    },
    {
      icon: Phone,
      label: '연락처',
      value: candidate.phone || 'N/A',
      fontFamily: 'Roboto, sans-serif',
    },
    {
      icon: Briefcase,
      label: '경력',
      value: '5년 (예시)', // TODO: Get from actual data
      fontFamily: 'Noto Sans KR, sans-serif',
    },
    {
      icon: Award,
      label: '자격증',
      value: 'AWS Certified (예시)', // TODO: Get from actual data
      fontFamily: 'Noto Sans KR, sans-serif',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <div
            key={index}
            className="rounded-lg border border-gray-200 bg-white p-4 hover:border-[#5287FF] transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0248FF]/10">
                <Icon className="h-5 w-5 text-[#0248FF]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900" style={{ fontFamily: item.fontFamily }}>
                  {item.value}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
