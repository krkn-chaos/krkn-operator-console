import { useEffect } from 'react';
import { operatorApi } from '../services/operatorApi';
import { useAppContext } from '../context/AppContext';
import type { JobStatusResponse } from '../types/api';

/**
 * Hook to poll status for all non-terminal jobs
 * Automatically starts/stops polling based on job states
 */
export function useJobsPoller() {
  const { state, dispatch } = useAppContext();
  const { jobs } = state;

  useEffect(() => {
    // Filter non-terminal jobs (jobs that are still active)
    const activeJobs = jobs.filter(
      (job) => !['Succeeded', 'Failed', 'Stopped'].includes(job.status)
    );

    // No active jobs, no need to poll
    if (activeJobs.length === 0) {
      return;
    }

    console.log(`Polling ${activeJobs.length} active jobs...`);

    // Poll each job every 2 seconds
    const intervalId = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const updated = await operatorApi.getJobStatus(job.jobId);

          // Only dispatch if status actually changed (reduce unnecessary updates)
          if (updated.status !== job.status || updated.message !== job.message) {
            dispatch({
              type: 'UPDATE_JOB',
              payload: { job: updated },
            });
          }
        } catch (error) {
          console.error(`Failed to poll job ${job.jobId}:`, error);
          // Don't crash the app on poll errors, just log them
        }
      }
    }, 2000); // 2 seconds

    // Cleanup on unmount or when jobs change
    return () => {
      console.log('Stopping job polling');
      clearInterval(intervalId);
    };
  }, [jobs, dispatch]);
}
