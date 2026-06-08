import { describe, it, expect } from "vitest"
import { generateICS, ICS_MIME_TYPE } from "../ics-generator"

/** Unfolde RFC 5545 folded lines: " \r\n " → "" */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "")
}

const baseInput = {
  uid: "book_001",
  summary: "30 Minute Meeting",
  descriptionHtml: "<p>Test meeting</p>",
  description: "Test meeting",
  startUtc: "2026-06-05T09:00:00Z",
  endUtc: "2026-06-05T09:30:00Z",
  organizerName: "Alice",
  organizerEmail: "alice@meetflow.dev",
  attendeeName: "Bob",
  attendeeEmail: "bob@example.com",
  timezone: "Asia/Shanghai",
}

describe("generateICS", () => {
  it("should produce valid VCALENDAR wrapper", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("END:VCALENDAR")
    expect(ics).toContain("VERSION:2.0")
    expect(ics).toContain("PRODID:-//MeetFlow//MeetFlow Calendar//EN")
  })

  it("should set METHOD:REQUEST for calendar invites", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("METHOD:REQUEST")
  })

  it("should include VEVENT with correct UID", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("END:VEVENT")
    expect(ics).toContain("UID:book_001@meetflow")
  })

  it("should format DTSTART and DTEND correctly", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("DTSTART:20260605T090000Z")
    expect(ics).toContain("DTEND:20260605T093000Z")
  })

  it("should include SUMMARY", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("SUMMARY:30 Minute Meeting")
  })

  it("should escape special characters in text fields", () => {
    const ics = generateICS({
      ...baseInput,
      summary: "Meeting; with, special\\chars",
    })
    // Semicolons, commas, and backslashes should be escaped
    expect(ics).toContain("SUMMARY:Meeting\\; with\\, special\\\\chars")
  })

  it("should include ORGANIZER with CN and mailto", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("ORGANIZER;CN=Alice:mailto:alice@meetflow.dev")
  })

  it("should include ATTENDEE with RSVP", () => {
    const ics = unfold(generateICS(baseInput))
    expect(ics).toContain("ATTENDEE")
    expect(ics).toContain("mailto:bob@example.com")
    expect(ics).toContain("RSVP=TRUE")
  })

  it("should include STATUS:CONFIRMED", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("STATUS:CONFIRMED")
  })

  it("should include DTSTAMP", () => {
    const ics = generateICS(baseInput)
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
  })

  it("should include VTIMEZONE when timezone is provided", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("BEGIN:VTIMEZONE")
    expect(ics).toContain("TZID:Asia/Shanghai")
    expect(ics).toContain("END:VTIMEZONE")
  })

  it("should include meeting URL in description when provided", () => {
    const ics = generateICS({
      ...baseInput,
      meetingUrl: "https://zoom.us/j/123456",
    })
    expect(ics).toContain("Meeting Link: https://zoom.us/j/123456")
    expect(ics).toContain("X-MEETING-URL:https://zoom.us/j/123456")
  })

  it("should include notes in description when provided", () => {
    const ics = generateICS({ ...baseInput, notes: "Bring slides" })
    expect(ics).toContain("Notes: Bring slides")
  })

  it("should include X-ALT-DESC with HTML description", () => {
    const ics = generateICS(baseInput)
    expect(ics).toContain("X-ALT-DESC")
    expect(ics).toContain("<p>Test meeting</p>")
  })

  it("should end with CRLF", () => {
    const ics = generateICS(baseInput)
    expect(ics.endsWith("\r\n")).toBe(true)
  })

  it("should fold lines longer than 75 characters", () => {
    // Use a very long description to trigger folding
    const ics = generateICS({
      ...baseInput,
      description: "A".repeat(200),
    })
    const lines = ics.split("\r\n")
    for (const line of lines) {
      // Skip empty lines at end
      if (line === "") continue
      // Continuation lines start with space, main lines should be ≤ 75
      if (!line.startsWith(" ")) {
        expect(line.length).toBeLessThanOrEqual(75)
      }
    }
  })
})

describe("ICS_MIME_TYPE", () => {
  it("should return the correct MIME type", () => {
    expect(ICS_MIME_TYPE).toBe("text/calendar; charset=utf-8; method=REQUEST")
  })
})
