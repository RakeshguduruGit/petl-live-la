const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const lastErrorAt = new Map<string, number>();

export async function callOneSignal(
  routeName: 'update' | 'end',
  body: Record<string, unknown>
) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  // Log environment diagnostics (safe prefixes only)
  console.log(`[OneSignal ${routeName}] App ID prefix: ${appId?.substring(0, 8)}...`);
  console.log(`[OneSignal ${routeName}] Has REST key: ${!!restKey}`);

  if (!appId || !restKey) {
    return {
      ok: false,
      status: 500,
      error: 'Missing OneSignal env vars (ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)',
      details: null,
    };
  }

  // OneSignal Live Activities API endpoints
  let url = '';
  let payload: any = {};

  if (routeName === 'update') {
    // Update Live Activity
    const activityId = body.activityId;
    if (!activityId) {
      return {
        ok: false,
        status: 400,
        error: 'Missing activityId for update operation',
        details: null,
      };
    }
    url = `https://api.onesignal.com/apps/${appId}/live_activities/${activityId}/notifications`;
    payload = {
      event: 'update',
      name: 'petl-la-update',
      event_updates: body.state || {
        soc: 85,
        watts: 7.5,
        timeToFullMinutes: 18,
        isCharging: true,
      },
    };
    
    // CRITICAL: Include push_token if provided - required for OneSignal to deliver update
    if (body.pushToken) {
      payload.push_token = body.pushToken;
      console.log(`[OneSignal ${routeName}] ✅ Including push_token in payload (length: ${body.pushToken.length})`);
    } else {
      console.log(`[OneSignal ${routeName}] ⚠️ WARNING: No push_token in payload - OneSignal will return "No Recipients"`);
    }
    
    // Include player_id if provided - may help OneSignal with routing
    if (body.playerId && Array.isArray(body.playerId) ? body.playerId.length > 0 : body.playerId) {
      payload.include_player_ids = Array.isArray(body.playerId) ? body.playerId : [body.playerId];
      console.log(`[OneSignal ${routeName}] ✅ Including include_player_ids for targeting`);
    }
  } else {
    // End Live Activity
    const activityId = body.activityId;
    if (!activityId) {
      return {
        ok: false,
        status: 400,
        error: 'Missing activityId for end operation',
        details: null,
      };
    }
    url = `https://api.onesignal.com/apps/${appId}/live_activities/${activityId}/notifications`;
    
    // OneSignal requires event_updates with content state even for end
    // Use provided state or minimal valid state
    const endState = body.state || {
      soc: 0,
      watts: 0,
      timeToFullMinutes: 0,
      isCharging: false,
    };
    
    payload = {
      event: 'end',
      name: 'petl-la-end',
      event_updates: endState,
    };
    
    // Add dismissalDate if provided
    if (body.dismissalDate) {
      payload.dismissal_date = body.dismissalDate;
    }
  }

  // Log the outbound request (without secrets)
  console.log(`[OneSignal ${routeName}] URL: ${url}`);
  console.log(`[OneSignal ${routeName}] Payload keys: ${Object.keys(payload).join(', ')}`);
  console.log(`[OneSignal ${routeName}] Payload: ${JSON.stringify(payload)}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${restKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Always log the response for debugging
    const responseText = await res.text().catch(() => '');
    console.log(`[OneSignal ${routeName}] Response: ${res.status} ${res.statusText}`);
    console.log(`[OneSignal ${routeName}] Response body: ${responseText.slice(0, 500)}`);

    if (!res.ok) {
      // Throttle repeated error logs per route
      const now = Date.now();
      const key = `err:${routeName}`;
      const last = lastErrorAt.get(key) ?? 0;
      if (now - last > ERROR_BACKOFF_MS) {
        lastErrorAt.set(key, now);
        console.error(`[OneSignal ${routeName}] ${res.status}: ${responseText.slice(0, 500)}`);
      }
      
      let errorDetails = null;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }
      
      return { 
        ok: false, 
        status: res.status, 
        error: 'ONESIGNAL_ERROR', 
        details: errorDetails 
      };
    }

           const data = responseText ? JSON.parse(responseText) : {};
           
           // Log OneSignal response ID for production monitoring
           if (data.id) {
             console.log(`[OneSignal ${routeName}] Success - Response ID: ${data.id}`);
           }
           
           return { ok: true, status: res.status, data };
  } catch (error) {
    // Throttle repeated error logs per route
    const now = Date.now();
    const key = `err:${routeName}`;
    const last = lastErrorAt.get(key) ?? 0;
    if (now - last > ERROR_BACKOFF_MS) {
      lastErrorAt.set(key, now);
      console.error(`[OneSignal ${routeName}] Network error:`, error);
    }
    return { ok: false, status: 500, error: 'NETWORK_ERROR', details: null };
  }
}

// Utility: uniform method guard
export function methodGuard(reqMethod: string, allowed: string[] = ['POST']) {
  const isAllowed = allowed.includes(reqMethod.toUpperCase());
  return { isAllowed, allowHeader: allowed.join(', ') };
}
