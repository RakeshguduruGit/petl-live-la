import { callOneSignal, methodGuard } from '@/lib/onesignal';
import { storeActivity, updateActivityState, getActivity } from '@/lib/session-store';
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
  
  // Update activity state in session store for cron-based direct updates
  if (result.ok) {
    // Try to update existing activity state
    const existing = getActivity(incoming.activityId);
    if (existing) {
      // Activity exists - just update the state
      updateActivityState(incoming.activityId, state);
      console.log(`[Update:${requestId}] ✅ Updated session store with latest state`);
    } else {
      // Activity doesn't exist in store - try to retrieve pushToken from OneSignal player tags
      const playerId = incoming.meta?.playerId;
      if (playerId && process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        try {
          console.log(`[Update:${requestId}] 🔍 Activity not in store - retrieving pushToken from OneSignal player ${playerId.substring(0, 8)}...`);
          const playerUrl = `https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/players/${playerId}`;
          console.log(`[Update:${requestId}] OneSignal Player API URL: ${playerUrl}`);
          
          const playerResponse = await fetch(playerUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`
            }
          });

          if (playerResponse.ok) {
            const playerData = await playerResponse.json();
            console.log(`[Update:${requestId}] Player API response - tags: ${JSON.stringify(playerData.tags || {})}`);
            const pushToken = playerData.tags?.['la_push_token'] as string | undefined;
            
            if (pushToken) {
              // Found pushToken - create session store entry
              storeActivity(incoming.activityId, playerId, pushToken, state);
              console.log(`[Update:${requestId}] ✅ Retrieved pushToken from OneSignal and created session store entry for cron job`);
            } else {
              console.log(`[Update:${requestId}] ⚠️ Player found but no 'la_push_token' tag. Activity was likely started before START endpoint was fixed. To enable cron updates, end and restart the Live Activity.`);
            }
          } else {
            const errorText = await playerResponse.text().catch(() => '');
            console.log(`[Update:${requestId}] ⚠️ OneSignal Player API returned ${playerResponse.status}: ${errorText}`);
            if (playerResponse.status === 404) {
              console.log(`[Update:${requestId}] 💡 Player ID ${playerId.substring(0, 8)}... not found in OneSignal. This activity may have been started before START endpoint was properly configured. Manual updates will work, but cron job cannot update this activity.`);
            } else {
              console.log(`[Update:${requestId}] ⚠️ Could not retrieve player from OneSignal (status: ${playerResponse.status}) - activity not stored for cron`);
            }
          }
        } catch (error) {
          console.log(`[Update:${requestId}] ⚠️ Error retrieving pushToken from OneSignal: ${error} - activity not stored for cron`);
        }
      } else {
        if (!playerId) {
          console.log(`[Update:${requestId}] ⚠️ Activity ${incoming.activityId.substring(0, 8)}... not in session store and no playerId provided in meta. This should have been created by START endpoint. Manual updates work, but cron job cannot update this activity.`);
        } else {
          console.log(`[Update:${requestId}] ⚠️ Missing OneSignal credentials - cannot retrieve pushToken from player tags`);
        }
      }
    }
  }
  
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
