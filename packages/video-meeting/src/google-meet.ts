/**
 * Google Meet adapter — creates a Google Calendar event with Meet link.
 *
 * REQUIRES:
 *   GOOGLE_CLIENT_ID     — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET — OAuth client secret
 *   User's Google OAuth access_token (from calendar_accounts table)
 *
 * To set up Google Meet auto-generation:
 *   The organizer must have connected their Google Calendar via OAuth
 *   (Phase 4, Steps 29/31). The access_token from calendar_accounts
 *   is passed to createGoogleMeetEvent().
 */

export interface GoogleMeetInput {
  summary: string
  startTime: string // ISO 8601 UTC
  endTime: string // ISO 8601 UTC
  timezone: string | undefined
  description: string | undefined
  attendees: { email: string }[] | undefined
}

export interface GoogleMeetResult {
  meetUrl: string
  eventId: string
}

/**
 * Create a Google Calendar event with Google Meet conference.
 * Requires a valid Google OAuth access_token with calendar.events scope.
 */
export async function createGoogleMeetEvent(
  accessToken: string,
  input: GoogleMeetInput,
): Promise<GoogleMeetResult> {
  const event = {
    summary: input.summary,
    description: input.description || "",
    start: {
      dateTime: input.startTime,
      timeZone: input.timezone || "UTC",
    },
    end: {
      dateTime: input.endTime,
      timeZone: input.timezone || "UTC",
    },
    attendees: input.attendees || [],
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  }

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  )

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(
      `Google Calendar API error (${response.status}): ${errBody}`,
    )
  }

  const data = (await response.json()) as {
    id: string
    hangoutLink?: string
    conferenceData?: {
      entryPoints?: { entryPointType: string; uri: string }[]
    }
  }

  let meetUrl = data.hangoutLink || ""

  // Fallback: extract from conferenceData.entryPoints
  if (!meetUrl && data.conferenceData?.entryPoints) {
    const video = data.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === "video",
    )
    if (video) meetUrl = video.uri
  }

  return {
    meetUrl,
    eventId: data.id,
  }
}
