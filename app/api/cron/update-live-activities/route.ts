/**
 * GET /api/cron/update-live-activities
 * 
 * Cron job that sends direct Live Activity updates using stored state.
 * This avoids the need for silent push notifications to wake the app.
 * 
 * Flow:
 * 1. Reads all active activities from session store
 * 2. Sends Live Activity updates directly via OneSignal API
 * 3. No dependency on silent push delivery
 * 
 * Security: Validates CRON_SECRET header
 */

import { getAllActiveActivities, cleanupStaleActivities, removeActivity } from '../../../../lib/session-store';
import { callOneSignal } from '../../../../lib/onesignal';

export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting direct Live Activity updates...');

  // Clean up stale activities first
  const cleaned = cleanupStaleActivities(10 * 60 * 1000); // 10 minutes
  if (cleaned > 0) {
    console.log(`[Cron] Cleaned up ${cleaned} stale activities`);
  }

  // Get all active activities
  const activeActivities = getAllActiveActivities(10 * 60 * 1000); // 10 minutes threshold

  if (activeActivities.length === 0) {
    console.log('[Cron] No active activities to update');
    return Response.json({
      ok: true,
      message: 'No active activities',
      updated: 0,
      total: 0
    });
  }

  console.log(`[Cron] Found ${activeActivities.length} active activities to update`);

  // Send updates to all active activities
  // If isCharging is false, send 'end' event to dismiss the Live Activity
  const results = await Promise.allSettled(
    activeActivities.map(async (session) => {
      try {
        // Check if device is unplugged - if so, end the Live Activity
        const shouldEnd = !session.state.isCharging;
        
        const result = await callOneSignal(shouldEnd ? 'end' : 'update', {
          activityId: session.activityId,
          state: session.state,
          dismissalDate: shouldEnd ? Math.floor(Date.now() / 1000) - 10 : undefined  // Past timestamp for immediate dismissal
        });

        if (result.ok) {
          if (shouldEnd) {
            console.log(`[Cron] ✅ Ended activityId=${session.activityId.substring(0, 8)}... (device unplugged)`);
            // Remove from session store after successful end
            removeActivity(session.activityId);
          } else {
            console.log(`[Cron] ✅ Updated activityId=${session.activityId.substring(0, 8)}... soc=${session.state.soc}%`);
          }
        } else {
          console.error(`[Cron] ❌ Failed to ${shouldEnd ? 'end' : 'update'} activityId=${session.activityId.substring(0, 8)}... error=${result.error}`);
        }

        return {
          activityId: session.activityId,
          action: shouldEnd ? 'end' : 'update',
          success: result.ok,
          error: result.ok ? null : result.error
        };
      } catch (error: any) {
        console.error(`[Cron] ❌ Exception processing activityId=${session.activityId.substring(0, 8)}... error=${error.message}`);
        return {
          activityId: session.activityId,
          action: 'error',
          success: false,
          error: error.message
        };
      }
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - succeeded;

  console.log(`[Cron] ✅ Completed: ${succeeded} succeeded, ${failed} failed out of ${activeActivities.length} total`);

  return Response.json({
    ok: true,
    updated: succeeded,
    failed: failed,
    total: activeActivities.length,
    timestamp: new Date().toISOString()
  });
}

