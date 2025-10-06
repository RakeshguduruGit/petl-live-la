const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const lastErrorAt = new Map<string, number>();

export async function callOneSignal(
  routeName: 'start' | 'update' | 'end',
  body: Record<string, unknown>
) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restKey) {
    return {
      ok: false,
      status: 500,
      error: 'Missing OneSignal env vars (ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)',
      details: null,
    };
  }

  // Minimal body shape; merge app_id
  const payload = { app_id: appId, ...body };

  // OneSignal Live Activities API endpoint
  let url = '';
  if (routeName === 'start') {
    url = `https://api.onesignal.com/apps/${appId}/live_activities`;
  } else {
    // For update and end, we need the activityId in the URL
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
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${restKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Throttle repeated error logs per route
      const now = Date.now();
      const key = `err:${routeName}`;
      const last = lastErrorAt.get(key) ?? 0;
      if (now - last > ERROR_BACKOFF_MS) {
        lastErrorAt.set(key, now);
        const text = await res.text().catch(() => '');
        console.error(`[OneSignal ${routeName}] ${res.status}: ${text.slice(0, 500)}`);
      }
      return { ok: false, status: res.status, error: 'ONESIGNAL_ERROR', details: null };
    }

    const data = await res.json().catch(() => ({}));
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
