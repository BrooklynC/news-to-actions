import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-6 dark:bg-zinc-950">
      <main className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          News to Actions
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Get started by signing in and visiting the app dashboard.
        </p>
        <Link
          href="/app"
          prefetch={false}
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to App
        </Link>
      </main>
    </div>
  );
}
