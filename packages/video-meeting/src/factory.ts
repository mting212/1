import { createZoomMeeting } from "./zoom"
import type { ZoomMeetingInput, ZoomMeetingResult } from "./zoom"
import { createGoogleMeetEvent } from "./google-meet"
import type { GoogleMeetInput, GoogleMeetResult } from "./google-meet"

export type MeetingProvider = "zoom" | "google_meet" | "none"

export interface CreateMeetingInput {
  /** Which provider to use */
  provider: MeetingProvider
  /** Meeting title */
  topic: string
  /** Start time (ISO 8601 UTC) */
  startTime: string
  /** End time (ISO 8601 UTC) */
  endTime: string
  /** Duration in minutes */
  durationMinutes: number
  /** Timezone (IANA) */
  timezone?: string
  /** Attendee email (for Google Meet) */
  attendeeEmail?: string
  /** Attendee name */
  attendeeName?: string
  /** Google OAuth access_token (required for google_meet) */
  googleAccessToken?: string | null
}

export interface CreateMeetingResult {
  /** The join URL */
  url: string | null
  /** Provider that generated the URL */
  provider: MeetingProvider
  /** Provider-specific meeting ID */
  meetingId?: string
  /** Error message if generation failed */
  error?: string
}

/**
 * Create a video meeting link using the configured provider.
 * Never throws — returns null URL on failure so the booking
 * always succeeds even if meeting link generation fails.
 */
export async function createMeetingLink(
  input: CreateMeetingInput,
): Promise<CreateMeetingResult> {
  if (input.provider === "none" || !input.provider) {
    return { url: null, provider: "none" }
  }

  try {
    if (input.provider === "zoom") {
      const zoomInput: ZoomMeetingInput = {
        topic: input.topic,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        timezone: input.timezone,
      }
      const result = await createZoomMeeting(zoomInput)
      return {
        url: result.joinUrl,
        provider: "zoom",
        meetingId: result.meetingId,
      }
    }

    if (input.provider === "google_meet") {
      if (!input.googleAccessToken) {
        return {
          url: null,
          provider: "google_meet",
          error:
            "No Google access token available. Organizer must connect Google Calendar.",
        }
      }

      const meetInput: GoogleMeetInput = {
        summary: input.topic,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        description: undefined,
        attendees: input.attendeeEmail
          ? [{ email: input.attendeeEmail }]
          : [],
      }
      const result = await createGoogleMeetEvent(
        input.googleAccessToken,
        meetInput,
      )
      return {
        url: result.meetUrl,
        provider: "google_meet",
        meetingId: result.eventId,
      }
    }

    return { url: null, provider: "none", error: `Unknown provider: ${input.provider}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[video-meeting] Failed to create ${input.provider} meeting:`, message)
    return { url: null, provider: input.provider, error: message }
  }
}
