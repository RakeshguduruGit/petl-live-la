import { callOneSignal, methodGuard } from '../../../lib/onesignal';

export async function POST(request: Request) {
  const incoming = await request.json().catch(() => ({}));
  
  // Include only the fields your iOS client sends/needs
  const payload = {
    action: 'start',
    activityId: incoming.activityId ?? null,
    laPushTokenHex: incoming.laPushToken ?? null,
    state: incoming.contentState ?? null,
    name: "petl-session",
    event: "start",
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
