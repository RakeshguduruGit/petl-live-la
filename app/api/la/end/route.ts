import { callOneSignal, methodGuard } from '../../../../lib/onesignal';
import { removeActivity } from '../../../../lib/session-store';
import { randomUUID } from 'crypto';

/**
 * POST /api/la/end
 * 
 * Ends an existing Live Activity.
 * The Live Activity must already be started on the iOS device.
 * 
 * Flow:
 * 1. iOS app has already started Live Activity via Activity.request()
 * 2. Server sends end event to OneSignal
 * 3. OneSignal terminates the Live Activity
 * 4. Session is removed from store (stops background silent pushes)
 * 
 * Security: Validates X-PETL-Secret header against PETL_SERVER_SECRET env var
 * 
 * Payload:
 * - activityId: string (required)
 * - immediate: boolean (optional, default true) - if true, ends immediately; if false, uses dismissalDate
 * - dismissalDate: number (optional) - Unix timestamp for scheduled dismissal
 */
export async function POST(request: Request) {
  const requestId = randomUUID();
  const incoming = await request.json().catch(() => ({}));
  
  // Validate X-PETL-Secret header
  const secret = request.headers.get('x-petl-secret');
  const expectedSecret = process.env.PETL_SERVER_SECRET;
  
  if (expectedSecret && secret !== expectedSecret) {
    console.log(`[End:${requestId}] Unauthorized`);
    return Response.json({
      ok: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }
  
  // Validate required fields
  if (!incoming.activityId) {
    console.log(`[End:${requestId}] Missing activityId`);
    return Response.json({
      ok: false,
      status: 400,
      error: 'Missing required field: activityId',
      details: null
    }, { status: 400 });
  }
  
  const immediate = incoming.immediate !== false; // Default to true
  console.log(`[End:${requestId}] activityId=${incoming.activityId} immediate=${immediate}`);
  
  // Get playerId from request metadata for tag removal
  const playerId = incoming.meta?.playerId;
  
  // 🔥 SERVER-SIDE TAG REMOVAL: Remove "charging" tag using OneSignal REST API
  if (playerId) {
    const appId = process.env.ONESIGNAL_APP_ID?.trim();
    const restKey = process.env.ONESIGNAL_REST_API_KEY?.trim();
    
    if (appId && restKey) {
      try {
        const tagResponse = await fetch(`https://api.onesignal.com/players/${playerId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${restKey}`,
          },
          body: JSON.stringify({
            app_id: appId,
            tags: { charging: '' }  // Empty string removes the tag
          }),
        });
        
        if (tagResponse.ok) {
          console.log(`[End:${requestId}] ✅ Server-side tag REMOVED: charging (player ${playerId.substring(0, 8)}...)`);
        } else {
          const tagError = await tagResponse.text();
          console.error(`[End:${requestId}] ❌ Server-side tag removal failed (${tagResponse.status}): ${tagError}`);
        }
      } catch (tagErr: any) {
        console.error(`[End:${requestId}] ❌ Server-side tag removal error: ${tagErr.message}`);
      }
    }
  } else {
    console.log(`[End:${requestId}] ⚠️ No playerId available - cannot remove OneSignal tag`);
  }
  
  // Prepare payload for OneSignal Live Activity end
  const payload: any = {
    activityId: incoming.activityId,
  };
  
  // Add dismissalDate if provided and not immediate
  if (!immediate && incoming.dismissalDate) {
    payload.dismissalDate = incoming.dismissalDate;
  } else if (immediate) {
    // For immediate dismissal, set to past timestamp
    payload.dismissalDate = Math.floor(Date.now() / 1000) - 10;
  }

  const result = await callOneSignal('end', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  
  // Remove activity from store (stops cron-based updates)
  if (result.ok) {
    removeActivity(incoming.activityId);
  }
  
  console.log(`[End:${requestId}] result=${result.ok ? 'ok' : 'error'}`);
  
  return Response.json(result, { status });
}

export async function GET() {
  // Method not allowed
  return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { 'Allow': 'POST', 'Content-Type': 'application/json' },
  });
}
