import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArticleActionsClient } from "./ArticleActionsClient";
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
import { runMyOrgJobs } from "@/app/app/actions";
import {
  createPersona,
  createTopic,
  fetchArticlesForTopic,
} from "../server-actions";

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
    articles: {
      id: string;
      title: string;
      url: string;
      source: string | null;
      publishedAt: Date | null;
      summary: string | null;
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
      const [topicsData, personasData] = await Promise.all([
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
      ]);
      topics = topicsData;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Articles"
          subtitle="Get the summary and the next steps in one place."
        />
        {orgId && (
          <Card className="shrink-0 p-5 sm:p-6">
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Ingest
            </h3>
            <form action={createTopic} className="mb-3 flex flex-wrap gap-2">
              <input
                name="name"
                placeholder="Topic name"
                required
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                name="query"
                placeholder="Search query"
                required
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add topic
              </button>
            </form>
            {topics.length > 0 && (
              <ul className="space-y-1.5">
                {topics.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {t.name}
                    </span>
                    <form action={fetchArticlesForTopic}>
                      <input type="hidden" name="topicId" value={t.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Fetch
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <form action={createPersona} className="flex gap-2">
                <input
                  name="name"
                  placeholder="Persona"
                  required
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add
                </button>
              </form>
              {personas.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {personas.length} persona{personas.length === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <form action={runMyOrgJobs}>
                <button
                  type="submit"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  Run queued jobs
                </button>
              </form>
            </div>
          </Card>
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
          <p className="text-base font-medium text-zinc-600 dark:text-zinc-400">
            No articles yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-500">
            Ingest articles for a Topic to get started.
          </p>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
            Add a topic in the Ingest card above, then click Fetch.
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
                    {a.publishedAt && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(a.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

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

                <div className="mt-4 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Quick summary
                  </p>
                  {a.summary ? (
                    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {a.summary}
                    </p>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No summary yet — click Summarize to make this quick to scan.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-zinc-100/80 pt-4 dark:border-zinc-700">
                  <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Next steps
                  </p>
                  {a.actionItems.length > 0 ? (
                    <>
                      <ul className="space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                        {a.actionItems.slice(0, 3).map((ai, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-zinc-400" aria-hidden>•</span>
                            <span>{ai.text.split(":")[0]?.trim() ?? ai.text}</span>
                          </li>
                        ))}
                      </ul>
                      {a.actionItems.length > 3 && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          +{a.actionItems.length - 3} more
                        </p>
                      )}
                      <a
                        href="/app/actions"
                        className="mt-2 inline-block text-sm font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
                      >
                        View all actions
                      </a>
                    </>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No action items yet — click Generate actions to get clear follow-ups.
                      </p>
                    </div>
                  )}
                </div>

                <ArticleActionsClient
                  articleId={a.id}
                  summarizeArticle={summarizeArticle}
                  generateActions={generateActions}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
