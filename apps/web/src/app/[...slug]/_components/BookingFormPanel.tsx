"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { GridCell } from "@meetflow/calendar-engine"

interface Props {
  selectedSlot: GridCell | null
  timezone: string
  durationMinutes?: number
  onClose: () => void
  onSubmit: (
    data: { name: string; email: string; notes: string },
  ) => Promise<unknown>
  submitting?: boolean
  success?: boolean
  error?: string
}

export function BookingFormPanel({
  selectedSlot,
  timezone,
  durationMinutes = 30,
  onClose,
  onSubmit,
  submitting,
  success,
  error,
}: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!selectedSlot) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Name is required"
    if (!email.trim()) newErrors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Invalid email"
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    try {
      await onSubmit({ name, email, notes })
    } catch {
      // Error handled by parent via error prop
    }
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    })

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    })

  const endTime = new Date(
    selectedSlot.time.getTime() + durationMinutes * 60 * 1000,
  )

  return (
    <>
      {/* Desktop: side panel (sticky) */}
      <div className="hidden lg:block">
        {success ? (
          <SuccessCard
            selectedSlot={selectedSlot}
            endTime={endTime}
            formatDate={formatDate}
            formatTime={formatTime}
            onClose={onClose}
          />
        ) : (
          <FormCard
            selectedSlot={selectedSlot}
            endTime={endTime}
            timezone={timezone}
            durationMinutes={durationMinutes}
            formatDate={formatDate}
            formatTime={formatTime}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            notes={notes}
            setNotes={setNotes}
            errors={errors}
            error={error || ""}
            submitting={submitting}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        )}
      </div>

      {/* Mobile/Tablet: bottom sheet overlay */}
      <div className="lg:hidden fixed inset-0 z-50 flex items-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30"
          onClick={onClose}
        />

        {/* Sheet */}
        <div className="relative w-full bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto p-4">
          {/* Handle */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {success ? (
            <SuccessCard
              selectedSlot={selectedSlot}
              endTime={endTime}
              formatDate={formatDate}
              formatTime={formatTime}
              onClose={onClose}
            />
          ) : (
            <FormCard
              selectedSlot={selectedSlot}
              endTime={endTime}
              timezone={timezone}
              durationMinutes={durationMinutes}
              formatDate={formatDate}
              formatTime={formatTime}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              notes={notes}
              setNotes={setNotes}
              errors={errors}
              error={error || ""}
              submitting={submitting}
              onSubmit={handleSubmit}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>
  )
}

/* ── Shared sub-components ── */

function SuccessCard({
  selectedSlot,
  endTime,
  formatDate,
  formatTime,
  onClose,
}: {
  selectedSlot: GridCell
  endTime: Date
  formatDate: (d: Date) => string
  formatTime: (d: Date) => string
  onClose: () => void
}) {
  return (
    <Card className="w-full max-w-sm mx-auto border-0 shadow-none">
      <CardContent className="pt-6 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <h3 className="text-lg font-semibold">Booking Confirmed!</h3>
        <p className="text-sm text-gray-600">
          {formatDate(selectedSlot.time)}
          <br />
          {formatTime(selectedSlot.time)} — {formatTime(endTime)}
        </p>
        <p className="text-xs text-gray-500">
          A confirmation email has been sent.
        </p>
        <Button onClick={onClose} variant="outline" className="w-full">
          Done
        </Button>
      </CardContent>
    </Card>
  )
}

function FormCard({
  selectedSlot,
  endTime,
  timezone,
  durationMinutes,
  formatDate,
  formatTime,
  name,
  setName,
  email,
  setEmail,
  notes,
  setNotes,
  errors,
  error,
  submitting,
  onSubmit,
  onClose,
}: {
  selectedSlot: GridCell
  endTime: Date
  timezone: string
  durationMinutes: number
  formatDate: (d: Date) => string
  formatTime: (d: Date) => string
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  errors: Record<string, string>
  error: string | undefined
  submitting: boolean | undefined
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <Card className="w-full max-w-sm mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Book Meeting</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-base"
            aria-label="Close"
          >
            ✕
          </button>
        </CardTitle>
        <p className="text-sm text-gray-600">
          {formatDate(selectedSlot.time)}
          <br />
          {formatTime(selectedSlot.time)} — {formatTime(endTime)}
          <br />
          <span className="text-xs text-gray-400">
            {timezone} · {durationMinutes} min
          </span>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(errors.name && "border-red-500")}
              placeholder="Your name"
              data-testid="input-name"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(errors.email && "border-red-500")}
              placeholder="you@example.com"
              data-testid="input-email"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests..."
              data-testid="input-notes"
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full min-h-[44px]"
            disabled={submitting}
            data-testid="btn-submit-booking"
          >
            {submitting ? "Booking..." : "Confirm Booking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
