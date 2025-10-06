export const config = {
  runtime: "edge",
}

interface EndRequestBody {
  activityId: string
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
    const body: EndRequestBody = await req.json()
    const { activityId } = body

    if (!activityId) {
      return new Response(JSON.stringify({ error: "Missing activityId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const payload = {
      event: "end",
    }

    const response = await fetch(
      `https://api.onesignal.com/apps/${appId}/live_activities/${activityId}/notifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify(payload),
      },
    )

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
