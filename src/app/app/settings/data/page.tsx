/* DEV-ONLY: Temporary page for verifying org export and org delete flows. Remove after verification. */
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataGovernanceActions } from "./DataGovernanceActions";
import { getAuthContext } from "@/lib/auth";

export default async function DataGovernancePage() {
  const auth = await getAuthContext();
  if (!auth?.clerkOrgId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Data Governance"
          subtitle="Org export and delete verification"
        />
        <Card className="p-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization selected. Use the switcher above.
          </p>
          <Link
            href="/app/settings/notifications"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            ← Back to Settings
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Governance"
        subtitle="Org export and delete verification (dev only)"
      />
      <DataGovernanceActions />
      <Link
        href="/app/settings/notifications"
        className="inline-block text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to Settings
      </Link>
    </div>
  );
}
