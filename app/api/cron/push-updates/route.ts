import { sessionStore } from '../../../../lib/session-store';

/**
 * Vercel Cron: Send Silent Push Notifications for Background LA Updates
 * 
 * Runs every 5 minutes via Vercel Cron
 * Sends silent push notifications to all active charging sessions
 * iOS devices wake up, calculate fresh analytics, and update their Live Activities
 * 
 * Security: Protected by Vercel Cron secret header
 */
export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  // Verify Vercel Cron secret
  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    console.log('[Cron] Unauthorized - invalid secret');
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const sessions = sessionStore.getAll();
  
  console.log(`[Cron] Starting silent push job - ${sessions.length} active sessions`);

  if (sessions.length === 0) {
    return Response.json({
      ok: true,
      pushed: 0,
      duration: Date.now() - startTime,
      message: 'No active sessions',
    });
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restKey) {
    console.error('[Cron] Missing OneSignal credentials');
    return Response.json({
      ok: false,
      error: 'Missing OneSignal credentials',
    }, { status: 500 });
  }

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send Live Activity update to each active session
  // Using OneSignal Live Activities API (same as our /update endpoint)
  for (const session of sessions) {
    try {
      // Use the same OneSignal Live Activities API that our /update endpoint uses
      const url = `https://api.onesignal.com/apps/${appId}/live_activities/${session.activityId}/notifications`;
      
      const payload = {
        event: 'update',
        name: 'petl-cron-update',
        event_updates: {
          soc: session.soc,
          watts: session.watts,
          timeToFullMinutes: session.timeToFullMinutes,
          isCharging: true,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${restKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.text();

      if (response.ok) {
        pushed++;
        console.log(`[Cron] ✅ Updated LA ${session.activityId.substring(0, 8)}... (${session.soc}%, ${session.watts}W)`);
        
        // Update session's lastUpdate timestamp
        session.lastUpdate = Date.now();
        sessionStore.set(session);
      } else {
        failed++;
        const preview = data.substring(0, 200);
        console.error(`[Cron] ❌ Failed to update ${session.activityId.substring(0, 8)}...: ${response.status} ${preview}`);
        errors.push(`${session.activityId.substring(0, 8)}: ${response.status}`);
      }
    } catch (error: any) {
      failed++;
      console.error(`[Cron] ❌ Error updating ${session.activityId.substring(0, 8)}...:`, error.message);
      errors.push(`${session.activityId.substring(0, 8)}: ${error.message}`);
    }
  }

  const duration = Date.now() - startTime;
  const stats = sessionStore.stats();

  console.log(`[Cron] Completed - pushed=${pushed} failed=${failed} duration=${duration}ms`);

  return Response.json({
    ok: true,
    pushed,
    failed,
    errors: errors.length > 0 ? errors : undefined,
    duration,
    stats,
    timestamp: new Date().toISOString(),
  });
}

