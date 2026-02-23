import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/time";
import { ClampText } from "@/components/ui/ClampText";
import { BulletedText } from "@/components/ui/BulletedText";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArticleSummarizeButton } from "./ArticleSummarizeButton";
import { ArticleGenerateButton } from "./ArticleGenerateButton";
import {
  generateActions,
  runJobsNow,
  runSchedulerNowDev,
  seedDevTopic,
  enqueueIngestForDevTopic,
  summarizeArticle,
} from "@/app/app/actions";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
import { getSystemHealthSummary } from "@/app/app/observability/actions";
import { IngestCardServer } from "./IngestCard.server";

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; banner?: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  await syncDbWithClerk(authContext);
  await currentUser();
  const { orgId } = await auth();
  const params = await searchParams;

  let org: { id: string } | null = null;
  let topics: {
    id: string;
    name: string;
    query: string;
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
      actionItems: { id: string; text: string; persona: { id: string; name: string } | null }[];
    }[];
  }[] = [];
  let personas: { id: string; name: string }[] = [];

  if (orgId) {
    org = await prisma.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: { id: true },
    });
    if (org) {
      const [topicsData, personasData, healthEnrichment, queueStateEnrichment] = await Promise.all([
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
                  where: { status: "OPEN" },
                  include: { persona: { select: { id: true, name: true } } },
                },
              },
            },
          },
        }),
        prisma.persona.findMany({
          where: { organizationId: org.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        getTopicHealthEnrichment(org.id),
        getTopicQueueStateEnrichment(org.id),
      ]);
      topics = enrichTopicsWithQueueState(
        enrichTopicsWithHealth(topicsData, healthEnrichment),
        queueStateEnrichment
      );
      personas = personasData;
    }
  }

  const banner = typeof params.banner === "string" ? params.banner : null;
  const clearBannerHref = (() => {
    const q = new URLSearchParams();
    if (params.error) q.set("error", params.error);
    if (params.message) q.set("message", params.message);
    const s = q.toString();
    return "/app/articles" + (s ? "?" + s : "");
  })();

  const allArticles = topics.flatMap((t) =>
    t.articles.map((a) => ({ ...a, topicName: t.name }))
  );
  const hasAnyArticles = allArticles.length > 0;

  const now = new Date();
  const systemHealth = await getSystemHealthSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageHeader
            title="Articles"
            subtitle="Get the summary and the next steps in one place."
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Updated · {formatRelativeTime(now)}</span>
            <span>
              Cron ·{" "}
              {systemHealth.lastCronRun
                ? `${formatRelativeTime(systemHealth.lastCronRun.startedAt)} · ${systemHealth.lastCronRun.status}`
                : "No runs yet"}
            </span>
            {systemHealth.cronFailedCount24h > 0 && (
              <a
                href="/app/observability"
                className="inline-flex rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
              >
                Cron failures (24h): {systemHealth.cronFailedCount24h}
              </a>
            )}
            {systemHealth.jobFailedCount24h > 0 && (
              <a
                href="/app/observability"
                className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
              >
                Job failures (24h): {systemHealth.jobFailedCount24h}
              </a>
            )}
          </div>
        </div>
        {orgId && (
          <IngestCardServer
            topics={topics.map((t) => ({
              id: t.id,
              name: t.name,
              query: t.query,
              lastIngestAt: t.lastIngestAt ?? null,
              cadence: t.cadence,
              nextRunAt: t.nextRunAt ?? null,
              recipeType: t.recipeType,
              health: t.health,
              lastIngestSuccessAt: t.lastIngestSuccessAt ?? null,
              lastIngestFailureAt: t.lastIngestFailureAt ?? null,
              articlesCount: t.articles.length,
              queuedAt: t.queuedAt ?? null,
              runningAt: t.runningAt ?? null,
            }))}
            personasCount={personas.length}
          />
        )}
      </div>

      {banner && <Banner message={banner} clearHref={clearBannerHref} />}

      {process.env.NODE_ENV !== "production" && orgId && (
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Dev Tools
          </h3>
          <div className="flex flex-wrap gap-2">
            <form action={seedDevTopic}>
              <button
                type="submit"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Create Dev Topic
              </button>
            </form>
            <form action={enqueueIngestForDevTopic}>
              <button
                type="submit"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Enqueue Ingest Job
              </button>
            </form>
            <form action={runJobsNow}>
              <button
                type="submit"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Run Jobs Now
              </button>
            </form>
            <form action={runSchedulerNowDev}>
              <button
                type="submit"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Run Scheduler Now (Dev)
              </button>
            </form>
          </div>
        </Card>
      )}

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

      {!orgId && (
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            No organization selected. Use the organization switcher above.
          </p>
        </Card>
      )}

      {orgId && !hasAnyArticles && (
        <Card className="rounded-3xl py-16 text-center">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            No articles yet
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Run a topic above to ingest the latest results.
          </p>
        </Card>
      )}

      {orgId && hasAnyArticles && (
        <ul className="space-y-4">
          {allArticles.map((a) => (
            <li key={a.id}>
              <Card className="overflow-hidden p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {a.title}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {a.topicName}
                    </span>
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  Added · {formatRelativeTime(a.createdAt)}
                  {a.publishedAt != null && (
                    <> · Published · {formatRelativeTime(a.publishedAt)}</>
                  )}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        a.summary ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                      aria-hidden
                    />
                    Summary
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        a._count.actionItems > 0
                          ? "bg-green-500"
                          : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                      aria-hidden
                    />
                    Actions {a._count.actionItems}
                  </span>
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Quick summary
                  </p>
                  {a.summary ? (
                    <div className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      <ClampText text={a.summary} lines={3} preserveNewlines />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No summary yet.
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                        Click Summarize to scan.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Next steps
                  </p>
                  {a.actionItems.length > 0 ? (
                    <>
                      <ul className="space-y-2 text-sm">
                        {a.actionItems.slice(0, 5).map((ai, i) => {
                          const [titlePart, ...rest] = ai.text.split(":");
                          const title = titlePart?.trim() ?? ai.text;
                          const description =
                            rest.length > 0 ? rest.join(":").trim() : null;
                          return (
                            <li
                              key={i}
                              className="rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-700"
                            >
                              <span
                                className="line-clamp-1 block font-medium text-zinc-900 dark:text-zinc-100"
                                title={title}
                              >
                                {title}
                              </span>
                              {description && (
                                <details className="mt-1 group">
                                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
                                    View details
                                  </summary>
                                  <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                    <BulletedText text={description} />
                                  </div>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {a.actionItems.length > 5 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          +{a.actionItems.length - 5} more
                        </p>
                      )}
                      <a
                        href="/app/actions"
                        className="inline-block text-sm font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
                      >
                        View all actions
                      </a>
                    </>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No actions yet.
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                        Run this topic to generate.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
                  <form action={summarizeArticle} className="inline-flex">
                    <input type="hidden" name="articleId" value={a.id} />
                    <ArticleSummarizeButton />
                  </form>
                  <form action={generateActions} className="inline-flex">
                    <input type="hidden" name="articleId" value={a.id} />
                    <ArticleGenerateButton />
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
