import { Card } from "@/components/ui/Card";
import { DataGovernanceActions } from "@/app/app/settings/data/DataGovernanceActions";
import { getAuthContext } from "@/lib/auth";
import { inviteUserToOrg } from "@/app/app/actions";

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const auth = await getAuthContext();
  if (!auth?.clerkOrgId) {
    return (
      <Card className="p-5">
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Select an organization above to access data options.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {params.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {params.error}
        </div>
      )}
      {params.message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-relaxed text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          {params.message}
        </div>
      )}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Invite user
        </h2>
        <Card className="p-5 sm:p-6">
          <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
            Add a user to this organization by email. They&apos;ll receive an invitation to sign in or sign up and join. Their actions and data will appear under this org.
          </p>
          <form action={inviteUserToOrg} className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Email address
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="w-64 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
              <button
                type="submit"
                className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-teal-700 active:scale-[0.98] dark:bg-teal-500 dark:hover:bg-teal-600"
              >
                Send invitation
              </button>
            </form>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Data governance
        </h2>
        <DataGovernanceActions />
      </div>
    </div>
  );
}
