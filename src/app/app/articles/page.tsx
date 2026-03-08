import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/time";
import { ClampText } from "@/components/ui/ClampText";
import { setActionItemStatus } from "./actions";
import { FeedPersonaSwitcher } from "./FeedPersonaSwitcher";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncDbWithClerk } from "@/lib/sync-clerk";
import {
  getTopicHealthEnrichment,
  getTopicQueueStateEnrichment,
  enrichTopicsWithHealth,
  enrichTopicsWithQueueState,
} from "@/lib/topics/health";
import type { TopicHealth } from "@/lib/types/topicHealth";
import { IngestCardServer } from "./IngestCard.server";
import { ExecuteDashboardButton } from "./ExecuteDashboardButton";

type ArticleActionItem = {
  id: string;
  text: string;
  status: string;
  persona: { id: string; name: string } | null;
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; banner?: string; persona?: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  await syncDbWithClerk(authContext);
  await currentUser();
  const { orgId } = await auth();
  const params = await searchParams;

  let org: { id: string; ingestCadence: string } | null = null;
  let topics: {
    id: string;
    name: string;
    query: string;
    displayName: string | null;
    searchPhrase: string | null;
    focusFilter: string;
    lastIngestAt: Date | null;
    cadence: string;
    nextRunAt: Date | null;
    recipeType: string;
    health: TopicHealth;
    lastIngestSuccessAt: Date | null;
    lastIngestFailureAt: Date | null;
    queuedAt: Date | null;
    runningAt: Date | null;
    articles: {
      id: string;
      title: string;
      url: string;
      source: string | null;
      publishedAt: Date | null;
      summary: string | null;
      createdAt: Date;
      _count: { actionItems: number };
      actionItems: ArticleActionItem[];
    }[];
  }[] = [];
  let personas: { id: string; name: string; recipeType: string | null }[] = [];
  let selectedPersonaIds: string[] = [];
  let jobStatus = { queued: 0, processing: 0 };

  if (orgId) {
    org = await prisma.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: { id: true, ingestCadence: true },
    });
    if (org) {
      const [topicsData, personasData, orgSelectedData, healthEnrichment, queueStateEnrichment, jobCounts] =
        await Promise.all([
          prisma.topic.findMany({
            where: { organizationId: org.id },
            orderBy: { updatedAt: "desc" },
            include: {
              articles: {
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  title: true,
                  url: true,
                  source: true,
                  publishedAt: true,
                  summary: true,
                  createdAt: true,
                  _count: { select: { actionItems: true } },
                  actionItems: {
                    select: {
                      id: true,
                      text: true,
                      status: true,
                      persona: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          }),
          prisma.persona.findMany({
            where: { organizationId: org.id },
            orderBy: { name: "asc" },
            select: { id: true, name: true, recipeType: true },
          }),
          prisma.orgSelectedPersona.findMany({
            where: { organizationId: org.id },
            select: { personaId: true },
          }),
          getTopicHealthEnrichment(org.id),
          getTopicQueueStateEnrichment(org.id),
          Promise.all([
            prisma.backgroundJob.count({ where: { organizationId: org.id, status: "QUEUED" } }),
            prisma.backgroundJob.count({ where: { organizationId: org.id, status: "PROCESSING" } }),
          ]).then(([queued, processing]) => ({ queued, processing })),
        ]);
      jobStatus = jobCounts;
      topics = enrichTopicsWithQueueState(
        enrichTopicsWithHealth(topicsData, healthEnrichment, org.ingestCadence),
        queueStateEnrichment
      );
      personas = personasData;
      selectedPersonaIds = orgSelectedData.map((o) => o.personaId);
    }
  }

  const personaParam = typeof params.persona === "string" ? params.persona.trim() : undefined;
  const viewPersona: "all" | string =
    personaParam === "all"
      ? "all"
      : personaParam && selectedPersonaIds.includes(personaParam)
        ? personaParam
        : selectedPersonaIds[0] ?? "all";
  const viewPersonaLabel =
    viewPersona === "all" ? "All personas" : personas.find((p) => p.id === viewPersona)?.name ?? "All personas";

  const banner = typeof params.banner === "string" ? params.banner : null;
  const clearBannerHref = (() => {
    const q = new URLSearchParams();
    if (params.error) q.set("error", params.error);
    if (params.message) q.set("message", params.message);
    if (personaParam) q.set("persona", personaParam);
    const s = q.toString();
    return "/app/articles" + (s ? "?" + s : "");
  })();

  const allArticles = topics.flatMap((t) =>
    t.articles.map((a) => ({ ...a, topicName: t.name }))
  );
  const hasAnyArticles = allArticles.length > 0;

  const ingestCard = orgId && org ? (
    <IngestCardServer
      organizationId={org.id}
      topics={topics.map((t) => ({
        id: t.id,
        name: t.name,
        query: t.query,
        displayName: t.displayName ?? null,
        searchPhrase: t.searchPhrase ?? null,
        focusFilter: t.focusFilter ?? "ANY",
        lastIngestAt: t.lastIngestAt ?? null,
        nextRunAt: t.nextRunAt ?? null,
        health: t.health,
        lastIngestSuccessAt: t.lastIngestSuccessAt ?? null,
        lastIngestFailureAt: t.lastIngestFailureAt ?? null,
        articlesCount: t.articles.length,
        queuedAt: t.queuedAt ?? null,
        runningAt: t.runningAt ?? null,
      }))}
      personas={personas}
      selectedPersonaIds={selectedPersonaIds}
      orgCadence={org.ingestCadence}
    />
  ) : null;

  return (
    <div className="space-y-6">
      {orgId && org && (
        <div className="flex flex-wrap items-center gap-2">
          <ExecuteDashboardButton initialStatus={jobStatus} />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Pull new articles, summarize, and generate actions in one go.
          </span>
        </div>
      )}
      {ingestCard && (
        <details className="group rounded-2xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
            <span>Setup: Topics & personas</span>
            <span className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180 dark:text-zinc-500" aria-hidden>
              ▼
            </span>
          </summary>
          <div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-700">
            {ingestCard}
          </div>
        </details>
      )}

      {banner && <Banner message={banner} clearHref={clearBannerHref} />}

      {params.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {params.error}
        </div>
      )}

      {!orgId && (
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Select an organization above to see articles.
          </p>
        </Card>
      )}

      {orgId && !hasAnyArticles && (
        <Card className="rounded-3xl py-16 text-center">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            No articles yet
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Add topics and run ingest to pull in articles. Open <strong>Setup</strong> below to get started.
          </p>
        </Card>
      )}

      {orgId && hasAnyArticles && (
        <>
          {personas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <FeedPersonaSwitcher
                personas={personas}
                selectedPersonaIds={selectedPersonaIds}
                currentView={viewPersona}
                searchParams={{
                  ...(params.error && { error: params.error }),
                  ...(params.message && { message: params.message }),
                  ...(params.banner && { banner: params.banner }),
                }}
              />
            </div>
          )}

          <ul className="space-y-4">
            {allArticles.map((a) => {
              const filteredActions =
                viewPersona === "all"
                  ? a.actionItems
                  : a.actionItems.filter(
                      (ai) => ai.persona?.id === viewPersona
                    );
              return (
                <li key={a.id}>
                  <Card className="overflow-hidden p-5 sm:p-6">
                    {/* Article header */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 font-semibold text-zinc-900 hover:underline dark:text-zinc-100 line-clamp-2"
                        title={a.title}
                      >
                        {a.title}
                      </a>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="max-w-[140px] truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          title={a.topicName}
                        >
                          {a.topicName}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      Added {formatRelativeTime(a.createdAt)}
                      {a.publishedAt != null && (
                        <> / Published {formatRelativeTime(a.publishedAt)}</>
                      )}
                    </p>

                    {/* Summary and Actions side by side */}
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
                      {/* Summary box */}
                      <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Summary
                        </p>
                        {a.summary ? (
                          <div className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            <ClampText text={a.summary} lines={4} preserveNewlines />
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            No summary yet. Use Execute at the top to generate.
                          </p>
                        )}
                      </div>

                      {/* Actions box (filtered by view persona) */}
                      <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Actions {viewPersona === "all" ? "(all personas)" : `for ${viewPersonaLabel}`}
                      </p>
                      {filteredActions.length > 0 ? (
                        <>
                          <ul className="space-y-2 text-sm">
                            {filteredActions.map((ai) => {
                              const [titlePart, ...rest] = ai.text.split(":");
                              const title = titlePart?.trim() ?? ai.text;
                              const description =
                                rest.length > 0 ? rest.join(":").trim() : null;
                              const isOpen = ai.status === "OPEN";
                              return (
                                <li
                                  key={ai.id}
                                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-700"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className="block truncate font-medium text-zinc-900 dark:text-zinc-100"
                                      title={title}
                                    >
                                      {title}
                                    </span>
                                    {description && (
                                      <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                        <ClampText
                                          text={description}
                                          lines={2}
                                          moreLabel="Read more"
                                          lessLabel="Show less"
                                        />
                                      </div>
                                    )}
                                    {viewPersona === "all" && ai.persona?.name && (
                                      <span className="mt-1 inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                                        {ai.persona.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        ai.status === "OPEN"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                          : ai.status === "DONE"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                      }`}
                                    >
                                      {ai.status === "OPEN"
                                        ? "Open"
                                        : ai.status === "DONE"
                                          ? "Done"
                                          : "Dismissed"}
                                    </span>
                                    {isOpen && (
                                      <form action={setActionItemStatus} className="inline-flex">
                                        <input type="hidden" name="id" value={ai.id} />
                                        <input type="hidden" name="status" value="DONE" />
                                        {viewPersona && (
                                          <input type="hidden" name="persona" value={viewPersona} />
                                        )}
                                        <button
                                          type="submit"
                                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                        >
                                          Mark done
                                        </button>
                                      </form>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          <a
                            href="/app/admin/actions"
                            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
                          >
                            View all actions
                          </a>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          No action items yet for this view. Use Execute at the top to generate.
                        </p>
                      )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
