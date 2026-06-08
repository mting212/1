"use client"

import { useState } from "react"
import { api } from "@/trpc/react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = ["all", "confirmed", "cancelled"] as const

export default function BookingsPage() {
  const [statusFilter, setStatusFilter] = useState<
    (typeof STATUS_OPTIONS)[number]
  >("all")

  const utils = api.useUtils()
  const { data: bookings, isLoading } = api.booking.list.useQuery()

  const cancelMutation = api.booking.cancel.useMutation({
    onSuccess: () => utils.booking.list.invalidate(),
  })

  const filtered =
    statusFilter === "all"
      ? bookings
      : bookings?.filter((b) => b.status === statusFilter)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500">
            Manage your scheduled meetings
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border transition-colors capitalize",
              statusFilter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {booking.attendeeName}
                    </span>
                    <Badge
                      variant={
                        booking.status === "confirmed" ? "default" : "secondary"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(booking.startTime)} ·{" "}
                    {formatTime(booking.startTime)} —{" "}
                    {formatTime(booking.endTime)}
                  </div>
                  {booking.attendeeEmail && (
                    <div className="text-xs text-gray-400">
                      {booking.attendeeEmail}
                      {booking.attendeeTimezone &&
                        ` · ${booking.attendeeTimezone}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {booking.meetingUrl && (
                    <a
                      href={booking.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
                    >
                      Join
                    </a>
                  )}
                  {booking.status === "confirmed" && (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md disabled:opacity-50"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        const token = prompt(
                          "Enter the cancel token (from the confirmation email):",
                        )
                        if (token) {
                          cancelMutation.mutate({
                            bookingId: booking.id,
                            cancelToken: token,
                          })
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-lg font-medium">No bookings yet</p>
          <p className="text-sm">
            Share your scheduling link to start receiving bookings.
          </p>
        </div>
      )}
    </div>
  )
}
