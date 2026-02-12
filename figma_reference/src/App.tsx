import { useState } from 'react';
import { CandidateDashboard } from './components/dashboard/CandidateDashboard';
import { CandidateDetail } from './components/dashboard/CandidateDetail';
import { SchedulingPage } from './components/candidate/SchedulingPage';
import { JobApplicationPage } from './components/candidate/JobApplicationPage';
import { WorkflowBuilder } from './components/admin/WorkflowBuilder';
import { JobPostingBuilder } from './components/admin/JobPostingBuilder';

type View = 'dashboard' | 'detail' | 'scheduling' | 'application' | 'workflow' | 'jobposting';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleCandidateSelect = (id: string) => {
    setSelectedCandidateId(id);
    setCurrentView('detail');
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Roboto, Noto Sans KR, sans-serif' }}>
      {/* Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-center gap-4 p-4">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'dashboard'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            1. Dashboard
          </button>
          <button
            onClick={() => setCurrentView('detail')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'detail'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            2. Candidate Detail
          </button>
          <button
            onClick={() => setCurrentView('scheduling')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'scheduling'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            3. Scheduling
          </button>
          <button
            onClick={() => setCurrentView('application')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'application'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            4. Job Application
          </button>
          <button
            onClick={() => setCurrentView('workflow')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'workflow'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            5. Workflow Builder
          </button>
          <button
            onClick={() => setCurrentView('jobposting')}
            className={`px-4 py-2 rounded transition-colors ${
              currentView === 'jobposting'
                ? 'bg-[#0248FF] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            6. Job Posting Builder
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-[72px]">
        {currentView === 'dashboard' && (
          <CandidateDashboard onCandidateSelect={handleCandidateSelect} />
        )}
        {currentView === 'detail' && (
          <CandidateDetail
            candidateId={selectedCandidateId || '1'}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
        {currentView === 'scheduling' && <SchedulingPage />}
        {currentView === 'application' && <JobApplicationPage />}
        {currentView === 'workflow' && <WorkflowBuilder />}
        {currentView === 'jobposting' && <JobPostingBuilder />}
      </div>
    </div>
  );
}