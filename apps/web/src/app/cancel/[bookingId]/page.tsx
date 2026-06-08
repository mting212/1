import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getServerCaller } from "@/server/caller"
import { CancelForm } from "./CancelForm"

interface Props {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookingId } = await params
  return { title: `Cancel Booking — MeetFlow` }
}

export default async function CancelPage({ params, searchParams }: Props) {
  const { bookingId } = await params
  const { token } = await searchParams

  const caller = await getServerCaller()
  let booking
  try {
    booking = await caller.booking.get({ bookingId })
  } catch {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <CancelForm
        bookingId={bookingId}
        cancelToken={token ?? ""}
        booking={booking}
      />
    </div>
  )
}
