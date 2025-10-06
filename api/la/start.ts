export const config = {
  runtime: "edge",
}

interface StartRequestBody {
  activityId: string
  laPushToken: string
  contentState?: {
    soc?: number
    watts?: number
    timeToFullMinutes?: number
    isCharging?: boolean
  }
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY

  if (!appId || !apiKey) {
    return new Response(JSON.stringify({ error: "Missing OneSignal credentials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const body: StartRequestBody = await req.json()
    const { activityId, laPushToken, contentState } = body

    if (!activityId || !laPushToken) {
      return new Response(JSON.stringify({ error: "Missing activityId or laPushToken" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const payload = {
      name: "petl-session",
      activity_id: activityId,
      device_push_token: laPushToken,
      event: "start",
      event_updates: {
        "content-state": contentState || {
          soc: 90,
          watts: 7.8,
          timeToFullMinutes: 14,
          isCharging: true,
        },
      },
    }

    const response = await fetch(`https://api.onesignal.com/apps/${appId}/live_activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "OneSignal API error", details: data }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
