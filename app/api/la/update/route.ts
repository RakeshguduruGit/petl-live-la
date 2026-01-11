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
  
  // Get push_token from session store (required for OneSignal to deliver update)
  // Fallback: Check if iOS app sent push_token in request (for activities started before START fix)
  const existingActivity = await getActivity(incoming.activityId);
  let pushToken = existingActivity?.pushToken;
  
  // Fallback: If not in session store, check if iOS app sent it in the request
  if (!pushToken && incoming.laPushToken) {
    pushToken = incoming.laPushToken;
    console.log(`[Update:${requestId}] ✅ Using push_token from iOS app request (length: ${pushToken.length})`);
    // Store it in session store for future updates
    const playerId = incoming.meta?.playerId;
    if (playerId) {
      await storeActivity(incoming.activityId, playerId, pushToken, state);
      console.log(`[Update:${requestId}] ✅ Stored activity in session store from UPDATE request`);
    }
  }
  
  if (!pushToken) {
    console.log(`[Update:${requestId}] ⚠️ No push_token found in session store or request for activity ${incoming.activityId.substring(0, 8)}... - OneSignal will return "No Recipients"`);
    console.log(`[Update:${requestId}] 💡 To fix: Restart the Live Activity so START endpoint can store push_token in session store`);
  } else if (existingActivity) {
    console.log(`[Update:${requestId}] ✅ Found push_token in session store (length: ${pushToken.length})`);
  }
  
  // Get playerId from session store or request meta
  const playerId = existingActivity?.playerId || incoming.meta?.playerId;
  
  // Check if player exists in OneSignal before including include_player_ids
  // For Live Activities, push_token is sufficient - include_player_ids is optional
  let playerExists = false;
  if (playerId && process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
    try {
      const playerCheckUrl = `https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/players/${playerId}`;
      const playerCheckResponse = await fetch(playerCheckUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${process.env.ONESIGNAL_REST_API_KEY}`
        }
      });
      playerExists = playerCheckResponse.ok;
      if (playerExists) {
        console.log(`[Update:${requestId}] ✅ Player ${playerId.substring(0, 8)}... exists - will include in targeting`);
      } else {
        console.log(`[Update:${requestId}] ⚠️ Player ${playerId.substring(0, 8)}... not found (${playerCheckResponse.status}) - will use push_token only`);
      }
    } catch (checkError) {
      console.warn(`[Update:${requestId}] ⚠️ Could not verify player existence: ${checkError} - will use push_token only`);
      playerExists = false;
    }
  }
  
  const payload = {
    activityId: incoming.activityId,
    state: state,
    pushToken: pushToken || undefined,  // Include push_token if available
    playerId: playerId || undefined,    // Include playerId for targeting (only if exists)
    includePlayerIds: playerExists,     // Flag to include include_player_ids only if player exists
  };

  const result = await callOneSignal('update', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  
  // Update activity state in session store for cron-based direct updates
  if (result.ok) {
    // Try to update existing activity state
    const existing = await getActivity(incoming.activityId);
    if (existing) {
      // Activity exists - just update the state
      await updateActivityState(incoming.activityId, state);
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
              await storeActivity(incoming.activityId, playerId, pushToken, state);
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
