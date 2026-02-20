'use client';

import { Users, Mail, Shield, User, Briefcase } from 'lucide-react';

interface TeamUser {
  id: string;
  email: string;
  role: 'admin' | 'recruiter' | 'interviewer';
  organization_id: string;
  created_at: string;
}

interface TeamClientProps {
  users: TeamUser[];
  error?: string;
  isAdmin: boolean;
}

export function TeamClient({ users, error, isAdmin }: TeamClientProps) {
  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: '관리자',
      recruiter: '채용담당자',
      interviewer: '면접관',
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      recruiter: 'bg-blue-100 text-blue-800',
      interviewer: 'bg-green-100 text-green-800',
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield size={18} />;
    if (role === 'recruiter') return <Briefcase size={18} />;
    return <User size={18} />;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team</h1>
          <p className="text-gray-600">팀 멤버를 확인하고 관리하세요.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Team List */}
        {users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="text-gray-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">팀 멤버가 없습니다</h2>
            <p className="text-gray-600">아직 등록된 팀 멤버가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center text-white font-semibold">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getRoleColor(user.role)}`}>
                    {getRoleIcon(user.role)}
                    {getRoleText(user.role)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {user.email.split('@')[0]}
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail size={14} />
                    {user.email}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    가입일: {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {users.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            총 {users.length}명의 팀 멤버
          </div>
        )}
      </div>
    </div>
  );
}
