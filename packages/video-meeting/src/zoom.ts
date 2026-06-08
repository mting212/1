/**
 * Zoom Meeting adapter — Server-to-Server OAuth app.
 *
 * REQUIRES (set in .env):
 *   ZOOM_ACCOUNT_ID     — from Zoom App Marketplace → Server-to-Server OAuth
 *   ZOOM_CLIENT_ID      — OAuth client ID
 *   ZOOM_CLIENT_SECRET  — OAuth client secret
 *
 * To set up:
 *   1. Go to https://marketplace.zoom.us/
 *   2. Create a "Server-to-Server OAuth" app
 *   3. Copy Account ID, Client ID, Client Secret
 *   4. Add to .env:
 *        ZOOM_ACCOUNT_ID=your_account_id
 *        ZOOM_CLIENT_ID=your_client_id
 *        ZOOM_CLIENT_SECRET=your_client_secret
 */

export interface ZoomMeetingInput {
  topic: string
  startTime: string // ISO 8601 UTC, e.g. "2026-06-05T09:00:00Z"
  durationMinutes: number
  timezone: string | undefined
}

export interface ZoomMeetingResult {
  joinUrl: string
  password: string | undefined
  meetingId: string
}

// ── Token management ──────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom credentials not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET in .env.",
    )
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Zoom OAuth failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return cachedToken.token
}

// ── Create Meeting ─────────────────────────────────────────

/**
 * Create a Zoom meeting via Server-to-Server OAuth.
 * Returns join URL and meeting ID.
 */
export async function createZoomMeeting(
  input: ZoomMeetingInput,
): Promise<ZoomMeetingResult> {
  const token = await getAccessToken()

  // Zoom expects start_time as "2026-06-05T09:00:00" (no trailing Z)
  const startTime = input.startTime.replace(/\.000Z$/, "").replace(/Z$/, "")

  const body = {
    topic: input.topic.slice(0, 200), // Zoom limits topic to 200 chars
    type: 2, // Scheduled meeting
    start_time: startTime,
    duration: input.durationMinutes,
    timezone: input.timezone || "UTC",
    settings: {
      join_before_host: true,
      participant_video: true,
      host_video: true,
      waiting_room: false,
    },
  }

  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Zoom API error (${response.status}): ${errBody}`)
  }

  const data = (await response.json()) as {
    id: number
    join_url: string
    password?: string
  }

  return {
    joinUrl: data.join_url,
    password: data.password,
    meetingId: String(data.id),
  }
}
