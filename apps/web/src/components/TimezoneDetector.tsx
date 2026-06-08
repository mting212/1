"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTimezoneStore, detectTimezone } from "@/stores/timezone"

const COMMON_TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "UTC",
  "Pacific/Auckland",
]

export function TimezoneDetector() {
  const { timezone, setTimezone, manual, reset } = useTimezoneStore()
  const [browserTz, setBrowserTz] = useState("")
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    setBrowserTz(detectTimezone())
  }, [])

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPicker(!showPicker)}
        className="text-xs"
      >
        {timezone}
        {manual && " *"}
      </Button>
      {showPicker && (
        <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto w-56">
          <div className="p-2 border-b text-xs text-gray-500">
            Detected: {browserTz || "Unknown"}
            {manual && (
              <button
                type="button"
                onClick={() => {
                  reset()
                  setShowPicker(false)
                }}
                className="ml-2 text-blue-600 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          {COMMON_TIMEZONES.map((tz) => (
            <button
              key={tz}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100",
                timezone === tz && "bg-blue-50 text-blue-700 font-medium",
              )}
              onClick={() => {
                setTimezone(tz)
                setShowPicker(false)
              }}
            >
              {tz}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
