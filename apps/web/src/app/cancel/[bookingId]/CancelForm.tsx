"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/trpc/react"

interface BookingSummary {
  id: string
  scheduleLinkId: string
  startTime: string
  endTime: string
  status: "confirmed" | "cancelled"
  attendeeName: string
  attendeeEmail: string
  attendeeTimezone: string | null
  notes: string | null
  meetingUrl: string | null
  createdAt: Date
}

interface Props {
  bookingId: string
  cancelToken: string
  booking: BookingSummary
}

export function CancelForm({ bookingId, cancelToken, booking }: Props) {
  const router = useRouter()
  const [error, setError] = useState("")

  const cancelMutation = api.booking.cancel.useMutation({
    onSuccess: () => {
      // Will trigger re-render showing success
    },
    onError: (err) => {
      setError(err.message || "Failed to cancel booking")
    },
  })

  const handleCancel = () => {
    setError("")
    cancelMutation.mutate({ bookingId, cancelToken })
  }

  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  const tz = booking.attendeeTimezone || "UTC"
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    })
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })

  // If already cancelled
  if (booking.status === "cancelled" || cancelMutation.isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-semibold text-gray-900">
            Booking Cancelled
          </h2>
          <p className="text-sm text-gray-600">
            Your meeting on {formatDate(start)} at {formatTime(start)} has been
            cancelled.
          </p>
          <p className="text-xs text-gray-400">
            The organizer has been notified. The time slot is now available for
            others.
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to Home
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Cancel Booking</CardTitle>
        <p className="text-sm text-gray-500">
          Are you sure you want to cancel this meeting?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking details */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Attendee</span>
            <span className="font-medium">{booking.attendeeName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-medium">{formatDate(start)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="font-medium">
              {formatTime(start)} — {formatTime(end)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Timezone</span>
            <span className="font-medium">{tz}</span>
          </div>
          {booking.notes && (
            <div className="flex justify-between">
              <span className="text-gray-500">Notes</span>
              <span className="font-medium truncate max-w-[200px]">
                {booking.notes}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
            disabled={cancelMutation.isPending}
          >
            Go Back
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          The organizer will be notified. This action cannot be undone.
        </p>
      </CardContent>
    </Card>
  )
}
