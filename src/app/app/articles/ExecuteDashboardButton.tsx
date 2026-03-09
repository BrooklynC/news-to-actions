"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { executeDashboard } from "@/app/app/actions";

const POLL_INTERVAL_MS = 4000;
const RUN_JOBS_INTERVAL_MS = 6000;

type JobStatus = { queued: number; processing: number };

type Props = {
  initialStatus: JobStatus;
};

export function ExecuteDashboardButton({ initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [hadWork, setHadWork] = useState(
    initialStatus.queued > 0 || initialStatus.processing > 0
  );
  const runJobsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isProcessing = status.queued > 0 || status.processing > 0;

  const updateStatus = (data: { queued?: number; processing?: number }) => {
    const next = { queued: data.queued ?? 0, processing: data.processing ?? 0 };
    setStatus(next);
    if (next.queued > 0 || next.processing > 0) setHadWork(true);
  };

  useEffect(() => {
    if (!isProcessing) {
      if (runJobsRef.current) {
        clearInterval(runJobsRef.current);
        runJobsRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/app/org-job-status");
        if (res.ok) {
          const data = await res.json();
          updateStatus(data);
        }
      } catch {
        // ignore
      }
    };

    const runJobs = async () => {
      try {
        const res = await fetch("/api/app/run-org-jobs", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          updateStatus(data);
        }
      } catch {
        // ignore
      }
    };

    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    runJobsRef.current = setInterval(runJobs, RUN_JOBS_INTERVAL_MS);
    runJobs(); // run once immediately

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (runJobsRef.current) clearInterval(runJobsRef.current);
    };
  }, [isProcessing]);

  const label = isProcessing ? "Processing..." : hadWork ? "Ready" : "Execute";

  const buttonClass =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 active:scale-[0.98]";

  if (isProcessing) {
    return (
      <button
        type="button"
        disabled
        className={`${buttonClass} border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`}
      >
        {label}
      </button>
    );
  }

  if (hadWork) {
    return (
      <button
        type="button"
        onClick={() => {
          setHadWork(false);
          router.refresh();
        }}
        className={`${buttonClass} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200`}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={executeDashboard}>
      <button
        type="submit"
        className={`${buttonClass} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200`}
      >
        {label}
      </button>
    </form>
  );
}
