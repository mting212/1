"use client"

import { api } from "@/trpc/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default function DashboardPage() {
  const { data: stats, isLoading } = api.booking.stats.useQuery()

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of your scheduling activity</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Confirmed Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold text-gray-900">
                {stats?.totalBookings ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold text-gray-900">
                {stats?.thisWeekBookings ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold text-gray-900">
                {stats?.cancelledBookings ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/app/bookings"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800"
        >
          View All Bookings
        </Link>
        <Link
          href="/app/links"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Manage Links
        </Link>
      </div>

      {/* Recent bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentBookings && stats.recentBookings.length > 0 ? (
            <div className="space-y-2">
              {stats.recentBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <span className="font-medium text-gray-900 text-sm">
                      {b.attendeeName}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      {formatDate(b.createdAt)}
                    </span>
                  </div>
                  <Badge
                    variant={
                      b.status === "confirmed" ? "default" : "secondary"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>No bookings yet.</p>
              <p className="mt-1">
                Share your scheduling link to start receiving bookings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
