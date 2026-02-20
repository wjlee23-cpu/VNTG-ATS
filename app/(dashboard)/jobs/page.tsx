import { getJobs } from '@/api/queries/jobs';
import { JobsClient } from './JobsClient';

export default async function JobsPage() {
  const jobsResult = await getJobs();
  const jobs = jobsResult.data || [];
  const error = jobsResult.error;

  return (
    <JobsClient 
      initialJobs={jobs}
      error={error}
    />
  );
}
