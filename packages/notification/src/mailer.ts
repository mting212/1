import nodemailer from "nodemailer"
import { generateICS, ICS_MIME_TYPE } from "@meetflow/calendar-engine"
import type { ICSInput } from "@meetflow/calendar-engine"

// ── Types ──────────────────────────────────────────────────

export interface BookingEmailData {
  bookingId: string
  attendeeName: string
  attendeeEmail: string
  attendeeTimezone: string
  organizerName: string
  organizerEmail: string
  scheduleLinkName: string
  durationMinutes: number
  startUtc: string
  endUtc: string
  notes: string | null
  meetingUrl: string | null
}

export interface SendResult {
  organizerSent: boolean
  attendeeSent: boolean
  /** Ethereal test URL for preview (only in test mode) */
  previewUrl?: string
  error?: string
}

// ── SMTP Transport ────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  if (!host || host === "ethereal") {
    // Ethereal fake SMTP for development/testing
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
    console.log("[mailer] Using Ethereal test account:", testAccount.user)
  } else {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    })
  }

  return transporter
}

// ── Email Templates ───────────────────────────────────────

function formatTimeInZone(isoUtc: string, tz: string): string {
  return new Date(isoUtc).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
}

function formatDateInZone(isoUtc: string, tz: string): string {
  return new Date(isoUtc).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  })
}

function organizerEmailHtml(data: BookingEmailData): string {
  const time = `${formatDateInZone(data.startUtc, data.organizerEmail.includes("test") ? "UTC" : "UTC")}, ${formatTimeInZone(data.startUtc, "UTC")} — ${formatTimeInZone(data.endUtc, "UTC")}`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">New Booking: ${escapeHtml(data.attendeeName)}</h2>
  <p style="color: #555;">A new meeting has been booked via <strong>${escapeHtml(data.scheduleLinkName)}</strong>.</p>

  <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Attendee</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${escapeHtml(data.attendeeName)} (${escapeHtml(data.attendeeEmail)})</td></tr>
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Time</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${time} (UTC)</td></tr>
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Duration</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${data.durationMinutes} minutes</td></tr>
    ${data.notes ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Notes</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${escapeHtml(data.notes)}</td></tr>` : ""}
    ${data.meetingUrl ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Meeting Link</td><td style="padding:8px 12px; border-bottom:1px solid #eee;"><a href="${escapeHtml(data.meetingUrl)}">${escapeHtml(data.meetingUrl)}</a></td></tr>` : ""}
  </table>

  <p style="color: #888; font-size: 12px; margin-top: 24px;">
    This booking was created via MeetFlow. The .ics file is attached for your calendar.
  </p>
</body>
</html>`
}

function attendeeEmailHtml(data: BookingEmailData): string {
  const time = `${formatDateInZone(data.startUtc, data.attendeeTimezone)}, ${formatTimeInZone(data.startUtc, data.attendeeTimezone)} — ${formatTimeInZone(data.endUtc, data.attendeeTimezone)}`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Booking Confirmed!</h2>
  <p style="color: #555;">Your meeting with <strong>${escapeHtml(data.organizerName)}</strong> has been confirmed.</p>

  <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Meeting</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${escapeHtml(data.scheduleLinkName)}</td></tr>
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Time</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${time} (${escapeHtml(data.attendeeTimezone)})</td></tr>
    <tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Duration</td><td style="padding:8px 12px; border-bottom:1px solid #eee;">${data.durationMinutes} minutes</td></tr>
    ${data.meetingUrl ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #eee; color:#888;">Meeting Link</td><td style="padding:8px 12px; border-bottom:1px solid #eee;"><a href="${escapeHtml(data.meetingUrl)}">${escapeHtml(data.meetingUrl)}</a></td></tr>` : ""}
  </table>

  ${data.notes ? `<p style="color: #555; font-style: italic;">"${escapeHtml(data.notes)}"</p>` : ""}

  <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
    <p style="margin:0; font-size: 13px; color: #888;">
      📅 A calendar invitation (.ics) is attached — add it to your calendar.
    </p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── ICS Generation ────────────────────────────────────────

function buildICSInput(data: BookingEmailData): ICSInput {
  return {
    uid: data.bookingId,
    summary: `${data.scheduleLinkName} — ${data.organizerName} & ${data.attendeeName}`,
    descriptionHtml: attendeeEmailHtml(data),
    description: `Meeting: ${data.scheduleLinkName}\nOrganizer: ${data.organizerName}\nAttendee: ${data.attendeeName}`,
    startUtc: data.startUtc,
    endUtc: data.endUtc,
    organizerName: data.organizerName,
    organizerEmail: data.organizerEmail,
    attendeeName: data.attendeeName,
    attendeeEmail: data.attendeeEmail,
    timezone: data.attendeeTimezone,
    meetingUrl: data.meetingUrl,
    notes: data.notes,
  }
}

// ── Main Send Function ────────────────────────────────────

/**
 * Send confirmation emails to both organizer and attendee.
 * Never throws — booking should succeed even if email fails.
 */
export async function sendConfirmationEmails(
  data: BookingEmailData,
): Promise<SendResult> {
  const result: SendResult = { organizerSent: false, attendeeSent: false }

  try {
    const transport = await getTransporter()
    const fromEmail = process.env.SMTP_FROM || "bookings@meetflow.dev"
    const icsContent = generateICS(buildICSInput(data))

    // Send to organizer
    try {
      const orgMsg = await transport.sendMail({
        from: fromEmail,
        to: data.organizerEmail,
        subject: `New Booking: ${data.attendeeName} — ${data.scheduleLinkName}`,
        html: organizerEmailHtml(data),
        attachments: [
          {
            filename: "invite.ics",
            content: icsContent,
            contentType: ICS_MIME_TYPE,
          },
        ],
      })
      result.organizerSent = true

      // Ethereal preview URL
      const previewUrl = nodemailer.getTestMessageUrl(orgMsg)
      if (previewUrl) result.previewUrl = previewUrl as string

      console.log("[mailer] Organizer email sent:", orgMsg.messageId)
    } catch (err) {
      console.error("[mailer] Failed to send organizer email:", err)
    }

    // Send to attendee
    try {
      const attMsg = await transport.sendMail({
        from: fromEmail,
        to: data.attendeeEmail,
        subject: `Confirmed: ${data.scheduleLinkName} with ${data.organizerName}`,
        html: attendeeEmailHtml(data),
        attachments: [
          {
            filename: "invite.ics",
            content: icsContent,
            contentType: ICS_MIME_TYPE,
          },
        ],
      })
      result.attendeeSent = true

      const attPreview = nodemailer.getTestMessageUrl(attMsg)
      if (attPreview && !result.previewUrl) result.previewUrl = attPreview as string

      console.log("[mailer] Attendee email sent:", attMsg.messageId)
    } catch (err) {
      console.error("[mailer] Failed to send attendee email:", err)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    result.error = message
    console.error("[mailer] Email transport error:", message)
  }

  return result
}
