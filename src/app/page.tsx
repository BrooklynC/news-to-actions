import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/app/articles");

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/90 backdrop-blur-md dark:border-stone-800/60 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100"
          >
            News to Actions
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.98] dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24 sm:px-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl">
              Turn news into actions
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-lg text-stone-600 dark:text-stone-400">
              Define topics. Get articles. AI summarizes and generates role-based next steps—Marketing, Sales, or your own personas. One dashboard, no clutter.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="rounded-full bg-stone-900 px-7 py-3.5 text-base font-medium text-white shadow-sm transition-all hover:bg-stone-800 active:scale-[0.98] dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Get started
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-stone-200 bg-white px-7 py-3.5 text-base font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-t border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-2xl font-semibold text-stone-900 dark:text-stone-50 sm:text-3xl">
              Why News to Actions
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  One dashboard
                </h3>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  Topics, articles, AI summaries, and action items in one place. Filter by persona and update status without switching tools.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Set it and run it
                </h3>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  Schedule ingest by topic or hit Execute when you need a refresh. Background jobs keep the feed current so you don’t have to.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900/40 sm:col-span-2 lg:col-span-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Built for teams
                </h3>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  Orgs, personas, assignees, and optional Slack or email alerts. Admins get run history, queue control, and a full action list.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="rounded-3xl bg-stone-100 px-6 py-12 text-center dark:bg-stone-800/50 sm:px-12 sm:py-16">
              <h2 className="text-2xl font-semibold text-stone-900 dark:text-stone-50 sm:text-3xl">
                Ready to turn news into actions?
              </h2>
              <p className="mt-3 text-stone-600 dark:text-stone-400">
                Sign up and add your first topic in under a minute.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="rounded-full bg-teal-600 px-7 py-3.5 text-base font-medium text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.98] dark:bg-teal-500 dark:hover:bg-teal-600"
                >
                  Sign up free
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-full px-5 py-3.5 text-base font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-center text-sm text-stone-500 dark:text-stone-400">
            © {new Date().getFullYear()} News to Actions. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
