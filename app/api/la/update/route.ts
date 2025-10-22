import { callOneSignal, methodGuard } from '../../../../lib/onesignal';
import { randomUUID } from 'crypto';

/**
 * POST /api/la/update
 * 
 * Updates an existing Live Activity with new content state.
 * The Live Activity must already be started on the iOS device.
 * 
 * Flow:
 * 1. iOS app has already started Live Activity via Activity.request()
 * 2. Server sends updated content state to OneSignal
 * 3. OneSignal delivers update to the Live Activity
 * 4. Session store is updated with latest state for cron-based updates
 * 
 * Security: Validates X-PETL-Secret header against PETL_SERVER_SECRET env var
 */
export async function POST(request: Request) {
  const requestId = randomUUID();
  const incoming = await request.json().catch(() => ({}));
  
  // Validate X-PETL-Secret header
  const secret = request.headers.get('x-petl-secret');
  const expectedSecret = process.env.PETL_SERVER_SECRET;
  
  if (expectedSecret && secret !== expectedSecret) {
    console.log(`[Update:${requestId}] Unauthorized`);
    return Response.json({
      ok: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }
  
  // Validate required fields
  if (!incoming.activityId) {
    console.log(`[Update:${requestId}] Missing activityId`);
    return Response.json({
      ok: false,
      status: 400,
      error: 'Missing required field: activityId',
      details: null
    }, { status: 400 });
  }
  
  console.log(`[Update:${requestId}] activityId=${incoming.activityId}`);
  
  // Prepare payload for OneSignal Live Activity update
  const state = incoming.contentState || {
    soc: 85,
    watts: 7.5,
    timeToFullMinutes: 18,
    isCharging: true,
  };
  
  const payload = {
    activityId: incoming.activityId,
    state: state,
  };

  const result = await callOneSignal('update', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  
  console.log(`[Update:${requestId}] result=${result.ok ? 'ok' : 'error'}`);
  
  return Response.json(result, { status });
}

export async function GET() {
  // Method not allowed
  return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { 'Allow': 'POST', 'Content-Type': 'application/json' },
  });
}
