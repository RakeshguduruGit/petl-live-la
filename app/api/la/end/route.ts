import { callOneSignal, methodGuard } from '@/lib/onesignal';

export async function POST(request: Request) {
  const incoming = await request.json().catch(() => ({}));
  
  // Include only the fields your iOS client sends/needs
  const payload = {
    action: 'end',
    activityId: incoming.activityId ?? null,
    event: "end",
  };

  const result = await callOneSignal('end', payload);
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
