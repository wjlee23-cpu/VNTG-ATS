import { getJobs, getJobsPageStats } from '@/api/queries/jobs';
import { JobsClient } from './JobsClient';

export default async function JobsPage() {
  const jobsResult = await getJobs();
  const statsResult = await getJobsPageStats();
  
  const jobs = jobsResult.data || [];
  const error = jobsResult.error;
  const stats = statsResult.data || {
    activeJobs: 0,
    totalApplicants: 0,
    avgMatchRate: 0,
    totalViews: 0,
  };

  return (
    <JobsClient 
      initialJobs={jobs}
      stats={stats}
      error={error}
    />
  );
}
