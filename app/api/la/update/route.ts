import { callOneSignal, methodGuard } from '../../../lib/onesignal';

export async function POST(request: Request) {
  const incoming = await request.json().catch(() => ({}));
  
  // Include only the fields your iOS client sends/needs
  const payload = {
    action: 'update',
    activityId: incoming.activityId ?? null,
    state: incoming.contentState ?? null,
    event: "update",
    dismissal_date: Math.floor(Date.now() / 1000) + 120, // Rolling 2-minute TTL
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
