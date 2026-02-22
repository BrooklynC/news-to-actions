import Link from "next/link";
import { ActionItemAudit } from "@/components/action-item-audit";
import { ActionItemRow } from "@/components/action-item-row";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncDbWithClerk } from "@/lib/sync-clerk";
import { updateActionItem } from "../server-actions";

type StatusFilter = "ALL" | "OPEN" | "DONE" | "DISMISSED";
type AssigneeFilter = "ALL" | "UNASSIGNED" | "ME";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    banner?: string;
    status?: string;
    assignee?: string;
  }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  await syncDbWithClerk(authContext);
  const { orgId } = await auth();
  const params = await searchParams;

  const statusFilter = (params.status as StatusFilter) || "ALL";
  const assigneeFilter = (params.assignee as AssigneeFilter) || "ALL";

  let org: { id: string } | null = null;
  let currentUserId: string | null = null;
  let personas: { id: string; name: string }[] = [];
  let members: { id: string; user: { id: string; email: string | null } }[] = [];
  let actionItems: {
    id: string;
    text: string;
    status: string;
    dueDate?: string | null;
    priority?: string | null;
    personaId?: string | null;
    assigneeUserId?: string | null;
    article: { id: string; title: string } | null;
    persona: { id: string; name: string } | null;
    assigneeUser: { id: string; email: string | null } | null;
  }[] = [];

  if (orgId) {
    org = await prisma.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: { id: true },
    });
    if (org) {
      const userRecord = await prisma.user.findUnique({
        where: { clerkUserId: authContext.clerkUserId },
        select: { id: true },
      });
      currentUserId = userRecord?.id ?? null;
      const [personasData, membersData, actionItemsData] = await Promise.all([
        prisma.persona.findMany({
          where: { organizationId: org.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.membership.findMany({
          where: { organizationId: org.id },
          include: { user: { select: { id: true, email: true } } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.actionItem.findMany({
          where: {
            organizationId: org.id,
            ...(statusFilter !== "ALL" && { status: statusFilter }),
            ...(assigneeFilter === "UNASSIGNED" && { assigneeUserId: null }),
            ...(assigneeFilter === "ME" &&
              currentUserId != null && { assigneeUserId: currentUserId }),
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            text: true,
            status: true,
            dueDate: true,
            priority: true,
            personaId: true,
            assigneeUserId: true,
            persona: { select: { id: true, name: true } },
            assigneeUser: { select: { id: true, email: true } },
            article: { select: { id: true, title: true } },
          },
        }),
      ]);
      personas = personasData;
      members = membersData;
      actionItems = actionItemsData;
    }
  }

  const banner = typeof params.banner === "string" ? params.banner : null;
  const clearBannerHref = filterUrl({});

  function filterUrl(updates: { status?: string; assignee?: string }) {
    const s = new URLSearchParams();
    const status = updates.status ?? statusFilter;
    const assignee = updates.assignee ?? assigneeFilter;
    if (status !== "ALL") s.set("status", status);
    if (assignee !== "ALL") s.set("assignee", assignee);
    const q = s.toString();
    return "/app/actions" + (q ? "?" + q : "");
  }

  return (
    <Card className="p-5 sm:p-6">
      <PageHeader
        title="Action items"
        subtitle="Clear follow-ups generated from news."
      />

      {banner && <Banner message={banner} clearHref={clearBannerHref} />}

      {params.error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {params.error}
        </div>
      )}

      {params.message && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-relaxed text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          {params.message}
        </div>
      )}

      {!orgId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            No organization selected. Use the organization switcher above.
          </p>
        </div>
      )}

      {orgId && org && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Status
            </span>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "OPEN", "DONE", "DISMISSED"] as const).map((s) => (
                <a
                  key={s}
                  href={filterUrl({ status: s })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    statusFilter === s
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  {s === "ALL" ? "All" : s}
                </a>
              ))}
            </div>
            <span className="ml-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Assignee
            </span>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "UNASSIGNED", "ME"] as const).map((a) => (
                <a
                  key={a}
                  href={filterUrl({ assignee: a })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    assigneeFilter === a
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  {a === "ALL" ? "All" : a === "UNASSIGNED" ? "Unassigned" : "Me"}
                </a>
              ))}
            </div>
          </div>

          {actionItems.length === 0 ? (
            <Card className="rounded-3xl py-16 text-center">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                No actions yet.
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                <Link
                  href="/app/articles"
                  className="font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-200"
                >
                  Generate from articles
                </Link>
              </p>
            </Card>
          ) : (
            <ul className="space-y-3 text-sm">
              {actionItems.map((ai) => {
                const parts = ai.text.split(":");
                const item = {
                  id: ai.id,
                  title: parts[0]?.trim() ?? ai.text,
                  description:
                    parts.length > 1 ? parts.slice(1).join(":").trim() : undefined,
                  dueDate: ai.dueDate,
                  priority: ai.priority,
                  status: ai.status,
                  personaId: ai.personaId ?? ai.persona?.id,
                  assigneeUserId: ai.assigneeUserId ?? ai.assigneeUser?.id,
                };
                return (
                  <ActionItemRow
                    key={item.id}
                    item={item}
                    personas={personas}
                    members={members}
                    updateActionItem={updateActionItem}
                    articleTitle={ai.article?.title}
                  >
                    <ActionItemAudit
                      actionItemId={item.id}
                      organizationId={org.id}
                    />
                  </ActionItemRow>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
