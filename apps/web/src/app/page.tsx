import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          MeetFlow
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-5xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-6xl">
          Scheduling that respects everyone&apos;s time
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-500 dark:text-zinc-400">
          MeetFlow balances organizer time-protection with invitee convenience.
          Share a link, let them pick a time — no back-and-forth.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-xl bg-zinc-900 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Start scheduling free
          </Link>
          <Link
            href="/test/30min"
            className="rounded-xl border border-zinc-300 px-8 py-3 text-base font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            View demo booking page
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-sm text-zinc-400">
        MeetFlow MVP &mdash; Docker deployment running
      </footer>
    </div>
  );
}
