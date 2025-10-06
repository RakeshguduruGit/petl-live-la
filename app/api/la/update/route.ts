import { callOneSignal, methodGuard } from '../../../../lib/onesignal';

export async function POST(request: Request) {
  const incoming = await request.json().catch(() => ({}));
  
  // Log incoming request for debugging
  console.log(`[Update] Incoming request keys: ${Object.keys(incoming).join(', ')}`);
  console.log(`[Update] Activity ID: ${incoming.activityId}`);
  
  // Validate required fields
  if (!incoming.activityId) {
    return Response.json({
      ok: false,
      status: 400,
      error: 'Missing required field: activityId',
      details: null
    }, { status: 400 });
  }
  
  // Prepare payload for OneSignal Live Activity update
  const payload = {
    activityId: incoming.activityId,
    state: incoming.contentState || {
      soc: 85,
      watts: 7.5,
      timeToFullMinutes: 18,
      isCharging: true,
    },
    event_updates: {
      "content-state": incoming.contentState || {
        soc: 85,
        watts: 7.5,
        timeToFullMinutes: 18,
        isCharging: true,
      },
    },
  };

  const result = await callOneSignal('update', payload);
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
