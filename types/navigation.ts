// 네비게이션 타입 정의
export type AppView = 
  | 'overview' 
  | 'candidates' 
  | 'jobs' 
  | 'calendar' 
  | 'analytics'
  | 'settings'
  | 'team'
  | 'templates'
  | 'offers'
  | 'jd-requests'
  // Detail views
  | 'candidate-detail'
  | 'job-create'
  | 'job-edit'
  | 'schedule-interview'
  | 'invite-member'
  | 'jd-create'
  | 'jd-review'
  // Public views
  | 'career-page'
  | 'apply';

// AppView를 경로로 변환하는 함수
export function viewToPath(view: AppView, params?: Record<string, string>): string {
  const pathMap: Record<AppView, string> = {
    'overview': '/',
    'candidates': '/candidates',
    'jobs': '/jobs',
    'calendar': '/calendar',
    'analytics': '/analytics',
    'settings': '/settings',
    'team': '/team',
    'templates': '/templates',
    'offers': '/offers',
    'jd-requests': '/jd-requests',
    'candidate-detail': params?.id ? `/candidates/${params.id}` : '/candidates',
    'job-create': '/jobs/create',
    'job-edit': params?.id ? `/jobs/${params.id}/edit` : '/jobs',
    'schedule-interview': params?.candidateId ? `/candidates/${params.candidateId}/schedule` : '/candidates',
    'invite-member': '/team/invite',
    'jd-create': '/jd/create',
    'jd-review': params?.jdId ? `/jd/${params.jdId}/review` : '/jd-requests',
    'career-page': '/career',
    'apply': params?.jobId ? `/apply/${params.jobId}` : '/apply',
  };
  
  return pathMap[view] || '/';
}

// 경로를 AppView로 변환하는 함수
export function pathToView(pathname: string): AppView {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/candidates/') && pathname.includes('/schedule')) return 'schedule-interview';
  if (pathname.startsWith('/candidates/')) return 'candidate-detail';
  if (pathname === '/candidates') return 'candidates';
  if (pathname === '/jobs/create') return 'job-create';
  if (pathname.match(/^\/jobs\/[^/]+\/edit$/)) return 'job-edit';
  if (pathname.startsWith('/jobs')) return 'jobs';
  if (pathname === '/calendar') return 'calendar';
  if (pathname === '/analytics') return 'analytics';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/team/invite') return 'invite-member';
  if (pathname.startsWith('/team')) return 'team';
  if (pathname === '/templates') return 'templates';
  if (pathname === '/offers') return 'offers';
  if (pathname === '/jd/create') return 'jd-create';
  if (pathname.match(/^\/jd\/[^/]+\/review$/)) return 'jd-review';
  if (pathname.startsWith('/jd-requests')) return 'jd-requests';
  if (pathname.startsWith('/career')) return 'career-page';
  if (pathname.startsWith('/apply')) return 'apply';
  
  return 'overview';
}
