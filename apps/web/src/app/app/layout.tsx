import Link from "next/link"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple nav bar */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/app/dashboard" className="font-bold text-lg text-gray-900">
            MeetFlow
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/app/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/app/bookings" className="text-gray-600 hover:text-gray-900">
              Bookings
            </Link>
            <Link href="/app/links" className="text-gray-600 hover:text-gray-900">
              Links
            </Link>
          </nav>
          <div className="ml-auto" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
