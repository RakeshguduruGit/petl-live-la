import { callOneSignal, methodGuard } from '../../../../lib/onesignal';
import { randomUUID } from 'crypto';
import { sessionStore } from '../../../../lib/session-store';

/**
 * POST /api/la/start
 * 
 * IMPORTANT: This is a convenience endpoint that sends an initial update to an already-started Live Activity.
 * iOS Live Activities MUST be started on the device using Activity.request() - the server cannot create them.
 * 
 * Flow:
 * 1. iOS app calls Activity.request() to start Live Activity
 * 2. iOS app sends activityId + OneSignal playerId to this endpoint
 * 3. This endpoint stores the session and sends an initial update to the already-started activity
 * 4. Vercel Cron will send silent pushes every 5 minutes to wake the app for background updates
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
    console.log(`[Start:${requestId}] Unauthorized`);
    return Response.json({
      ok: false,
      error: 'Unauthorized'
    }, { status: 401 });
  }
  
  // Validate required fields
  if (!incoming.activityId) {
    console.log(`[Start:${requestId}] Missing activityId`);
    return Response.json({
      ok: false,
      status: 400,
      error: 'Missing required field: activityId',
      details: 'Live Activities must be started on the device using Activity.request(). This endpoint sends an initial update to an already-started activity.'
    }, { status: 400 });
  }

  // Extract playerId from meta (OneSignal Player ID)
  const playerId = incoming.meta?.playerId || incoming.playerId;
  
  if (!playerId) {
    console.log(`[Start:${requestId}] Missing playerId - silent push updates will not work`);
  }
  
  console.log(`[Start:${requestId}] activityId=${incoming.activityId} playerId=${playerId ? playerId.substring(0, 8) + '...' : 'none'}`);
  
  // Store session for background updates (if playerId provided)
  if (playerId) {
    const state = incoming.contentState || {
      soc: 90,
      watts: 7.8,
      timeToFullMinutes: 14,
      isCharging: true,
    };
    
    sessionStore.set({
      activityId: incoming.activityId,
      playerId: playerId,
      startedAt: Date.now(),
      lastUpdate: Date.now(),
      soc: state.soc,
      watts: state.watts,
      timeToFullMinutes: state.timeToFullMinutes,
    });
    
    console.log(`[Start:${requestId}] Session stored - total active sessions: ${sessionStore.count()}`);
    
    // 🔥 SERVER-SIDE TAG: Immediately tag device as charging using OneSignal REST API
    // This guarantees the tag is available for cron filtering without waiting for SDK sync
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
            tags: { charging: 'true' }
          }),
        });
        
        if (tagResponse.ok) {
          console.log(`[Start:${requestId}] ✅ Server-side tag SET: charging=true for player ${playerId.substring(0, 8)}...`);
        } else {
          const tagError = await tagResponse.text();
          console.error(`[Start:${requestId}] ❌ Server-side tagging failed (${tagResponse.status}): ${tagError}`);
        }
      } catch (tagErr: any) {
        console.error(`[Start:${requestId}] ❌ Server-side tagging error: ${tagErr.message}`);
      }
    }
  }
  
  // This is a convenience endpoint that sends an initial update to an already-started Live Activity
  const payload = {
    activityId: incoming.activityId,
    name: "petl-la-initial-update",
    state: incoming.contentState || {
      soc: 90,
      watts: 7.8,
      timeToFullMinutes: 14,
      isCharging: true,
    },
  };

  // Use the update logic since we're just sending an initial update
  const result = await callOneSignal('update', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  
  console.log(`[Start:${requestId}] result=${result.ok ? 'ok' : 'error'}`);
  
  return Response.json(result, { status });
}

export async function GET() {
  // Method not allowed
  return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { 'Allow': 'POST', 'Content-Type': 'application/json' },
  });
}
