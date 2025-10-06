const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const lastErrorAt = new Map<string, number>();

export async function callOneSignal(
  routeName: 'start' | 'update' | 'end',
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

  if (routeName === 'start') {
    // Start Live Activity - use notifications API with Live Activity targeting
    url = `https://api.onesignal.com/apps/${appId}/notifications`;
    payload = {
      app_id: appId,
      name: body.name || "petl-session",
      activity_id: body.activityId,
      device_push_token: body.laPushToken,
      event: "start",
      event_updates: body.event_updates || {
        "content-state": body.state || {
          soc: 90,
          watts: 7.8,
          timeToFullMinutes: 14,
          isCharging: true,
        },
      },
    };
  } else {
    // Update/End Live Activity
    const activityId = body.activityId;
    if (!activityId) {
      return {
        ok: false,
        status: 400,
        error: 'Missing activityId for update/end operations',
        details: null,
      };
    }
    url = `https://api.onesignal.com/apps/${appId}/live_activities/${activityId}/notifications`;
    payload = {
      app_id: appId,
      event: routeName,
      event_updates: body.event_updates || {
        "content-state": body.state || {
          soc: 85,
          watts: 7.5,
          timeToFullMinutes: 18,
          isCharging: true,
        },
      },
    };
  }

  // Log the outbound request (without secrets)
  console.log(`[OneSignal ${routeName}] URL: ${url}`);
  console.log(`[OneSignal ${routeName}] Payload keys: ${Object.keys(payload).join(', ')}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${restKey}`,
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
