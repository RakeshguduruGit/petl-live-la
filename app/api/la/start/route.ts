import { callOneSignal, methodGuard } from '../../../../lib/onesignal';

export async function POST(request: Request) {
  const incoming = await request.json().catch(() => ({}));
  
  // Log incoming request for debugging
  console.log(`[Start] Incoming request keys: ${Object.keys(incoming).join(', ')}`);
  console.log(`[Start] Activity ID: ${incoming.activityId}`);
  console.log(`[Start] LA Push Token length: ${incoming.laPushToken?.length || 0}`);
  
  // Validate required fields
  if (!incoming.activityId || !incoming.laPushToken) {
    return Response.json({
      ok: false,
      status: 400,
      error: 'Missing required fields: activityId and laPushToken',
      details: null
    }, { status: 400 });
  }
  
  // Prepare payload for OneSignal Live Activity start
  const payload = {
    activityId: incoming.activityId,
    laPushToken: incoming.laPushToken,
    name: "petl-session",
    state: incoming.contentState || {
      soc: 90,
      watts: 7.8,
      timeToFullMinutes: 14,
      isCharging: true,
    },
    event_updates: {
      "content-state": incoming.contentState || {
        soc: 90,
        watts: 7.8,
        timeToFullMinutes: 14,
        isCharging: true,
      },
    },
  };

  const result = await callOneSignal('start', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  return Response.json(result, { status });
}

export async function GET() {
  // Method not allowed
  return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { 'Allow': 'POST', 'Content-Type': 'application/json' },
  });
}
