export const config = {
  runtime: "edge",
}

export default async function handler(req: Request) {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY

  return new Response(JSON.stringify({
    hasAppId: !!appId,
    hasApiKey: !!apiKey,
    appIdLength: appId?.length || 0,
    apiKeyLength: apiKey?.length || 0,
    appIdPrefix: appId?.substring(0, 8) || 'N/A',
    apiKeyPrefix: apiKey?.substring(0, 8) || 'N/A'
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
