/**
 * RFC 5545 iCalendar (.ics) generator.
 * Produces calendar invitations that can be imported into
 * Google Calendar, Outlook, Apple Calendar, etc.
 */

export interface ICSInput {
  /** Booking unique ID — becomes the iCalendar UID */
  uid: string
  /** Meeting title */
  summary: string
  /** HTML description (goes into X-ALT-DESC) */
  descriptionHtml: string
  /** Plain-text description */
  description: string
  /** Start time as UTC ISO 8601 (e.g. "2026-06-05T09:00:00Z") */
  startUtc: string
  /** End time as UTC ISO 8601 */
  endUtc: string
  /** Organizer display name */
  organizerName: string
  /** Organizer email */
  organizerEmail: string
  /** Attendee display name */
  attendeeName: string
  /** Attendee email */
  attendeeEmail: string
  /** IANA timezone of the meeting (e.g. "Asia/Shanghai") */
  timezone?: string
  /** Meeting URL (Zoom/Meet link) */
  meetingUrl?: string | null
  /** Booking notes */
  notes?: string | null
}

// RFC 5545 line length limit
const MAX_LINE = 75

/** Fold long lines per RFC 5545 §3.1 */
function foldLine(line: string): string {
  if (line.length <= MAX_LINE) return line
  const out: string[] = []
  out.push(line.slice(0, MAX_LINE))
  let rest = line.slice(MAX_LINE)
  while (rest.length > 0) {
    // Continuation lines start with a space
    out.push(" " + rest.slice(0, MAX_LINE - 1))
    rest = rest.slice(MAX_LINE - 1)
  }
  return out.join("\r\n")
}

/** Escape iCalendar text: \n → \\n, ; → \\;, , → \\, */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

/** Format a UTC Date for iCalendar (YYYYMMDDTHHMMSSZ) */
function formatUtc(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** Generate VTIMEZONE lines (returned as array to avoid folding) */
function vTimezoneLines(tz: string): string[] {
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    `X-LIC-LOCATION:${tz}`,
    "END:VTIMEZONE",
  ]
}

/**
 * Generate a complete iCalendar (.ics) string
 * compliant with RFC 5545, suitable for email attachment.
 */
export function generateICS(input: ICSInput): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetFlow//MeetFlow Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
  ]

  // Timezone (individual lines to avoid incorrect folding)
  if (input.timezone) {
    lines.push(...vTimezoneLines(input.timezone))
  }

  // Build description
  let description = input.description
  if (input.meetingUrl) {
    description += `\n\nMeeting Link: ${input.meetingUrl}`
  }
  if (input.notes) {
    description += `\n\nNotes: ${input.notes}`
  }

  lines.push(
    "BEGIN:VEVENT",
    `DTSTAMP:${dtstamp}`,
    `UID:${input.uid}@meetflow`,
    `DTSTART:${formatUtc(input.startUtc)}`,
    `DTEND:${formatUtc(input.endUtc)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `ORGANIZER;CN=${escapeText(input.organizerName)}:mailto:${input.organizerEmail}`,
    `ATTENDEE;CN=${escapeText(input.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
  )

  // Optional meeting URL as a custom property
  if (input.meetingUrl) {
    lines.push(`X-MEETING-URL:${input.meetingUrl}`)
  }

  // HTML description as X-ALT-DESC
  if (input.descriptionHtml) {
    lines.push(
      `X-ALT-DESC;FMTTYPE=text/html:${escapeText(input.descriptionHtml)}`,
    )
  }

  lines.push("END:VEVENT", "END:VCALENDAR")

  // Fold long lines
  return lines.map(foldLine).join("\r\n") + "\r\n"
}

/** Return the correct MIME type for .ics attachments */
export const ICS_MIME_TYPE = "text/calendar; charset=utf-8; method=REQUEST"
