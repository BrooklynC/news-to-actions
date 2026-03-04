"use client";

/* DEV-ONLY: Temporary UI for verifying org export and org delete flows. Remove after verification. */
import { useState } from "react";
import { requestOrgExport, getOrgDeletePlan, confirmOrgDelete } from "@/app/app/actions";
import { Card } from "@/components/ui/Card";

type DeletePlan = {
  organizationId: string;
  organizationName: string;
  rowCounts: Record<string, number>;
  integrityOk: boolean;
  generatedAtIso: string;
};

export function DataGovernanceActions() {
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetDeletePlan() {
    setPlanLoading(true);
    setDeletePlan(null);
    setConfirmationToken(null);
    setError(null);
    try {
      const result = await getOrgDeletePlan();
      if (result?.plan && result?.confirmationToken) {
        setDeletePlan(result.plan);
        setConfirmationToken(result.confirmationToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmationToken) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await confirmOrgDelete(confirmationToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}
      <Card className="p-5">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Org Export
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enqueue EXPORT_ORG_DATA job. Run cron to process. Artifact written to{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            .export-artifacts/
          </code>{" "}
          or S3.
        </p>
        <form action={requestOrgExport} className="mt-3">
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Request Org Export
          </button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Org Delete (irreversible)
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Step 1: Get delete plan. Step 2: Confirm to execute. All org data will
          be permanently deleted.
        </p>
        <div className="mt-3 space-y-3">
          <button
            type="button"
            onClick={handleGetDeletePlan}
            disabled={planLoading}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {planLoading ? "Loading..." : "Get Delete Plan"}
          </button>

          {deletePlan && confirmationToken && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-sm font-medium">
                {deletePlan.organizationName} — {deletePlan.organizationId}
              </p>
              <pre className="mt-2 overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
                {JSON.stringify(deletePlan.rowCounts, null, 2)}
              </pre>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
