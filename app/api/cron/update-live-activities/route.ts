// Next.js App Router API Route: Update Live Activities directly via OneSignal
// This is called by Vercel Cron every 3 minutes
// Directly updates Live Activities via OneSignal API using stored push tokens
// Reference: https://documentation.onesignal.com/docs/en/live-activities-developer-setup

import { NextRequest, NextResponse } from 'next/server';
import { getAllActiveActivities } from '@/lib/session-store';

export async function GET(request: NextRequest) {
  // Security: Verify this is actually a cron job (not a random user request)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get OneSignal credentials from environment
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error('[CRON] Missing OneSignal credentials');
    return NextResponse.json(
      {
        error: 'Missing OneSignal credentials',
        hasAppId: !!ONESIGNAL_APP_ID,
        hasRestKey: !!ONESIGNAL_REST_API_KEY
      },
      { status: 500 }
    );
  }

  try {
    console.log('[Cron] Starting direct Live Activity updates...');

    // Get active activities from session store (stored when START/UPDATE endpoints are called)
    const activeActivities = getAllActiveActivities();
    
    console.log(`[SessionStore] Found ${activeActivities.length} active activities`);
    console.log(`[Cron] Found ${activeActivities.length} active activities to update`);

    if (activeActivities.length === 0) {
      console.log('[Cron] No active Live Activities to update');
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        updated: 0,
        message: 'No active Live Activities to update'
      });
    }

    console.log(`[OneSignal update] App ID prefix: ${ONESIGNAL_APP_ID.substring(0, 8)}...`);
    console.log(`[OneSignal update] Has REST key: ${!!ONESIGNAL_REST_API_KEY}`);

    const updateResults: Array<{ activityId: string; success: boolean; responseId?: string; error?: any }> = [];
    
    // Update each active Live Activity directly via OneSignal
    for (const session of activeActivities) {
      const activityId = session.activityId;
      const pushToken = session.pushToken;
      
      console.log(`[Cron] Processing activity ${activityId.substring(0, 8)}... pushToken: ${pushToken ? `${pushToken.substring(0, 8)}... (len: ${pushToken.length})` : 'MISSING'}`);
      
      // Validation
      if (!activityId || !activityId.trim() || !pushToken || !pushToken.trim()) {
        console.warn(`[Cron] ⚠️ Activity ${activityId?.substring(0, 8) || 'MISSING'}... missing activityId or push_token`);
        console.warn(`[Cron] activityId: "${activityId}" (length: ${activityId?.length || 0})`);
        console.warn(`[Cron] pushToken: "${pushToken?.substring(0, 20) || 'MISSING'}" (length: ${pushToken?.length || 0})`);
        updateResults.push({
          activityId: activityId || 'unknown',
          success: false,
          error: `Missing activityId or push_token (activityId: ${!!activityId}, pushToken: ${!!pushToken})`
        });
        continue;
      }

      // Get latest state from session store
      const state = session.state;
      const soc = state.soc;
      const watts = state.watts;
      const timeToFullMinutes = state.timeToFullMinutes;
      const isCharging = state.isCharging;

      try {
        const url = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/live_activities/${activityId}/notifications`;
        console.log(`[OneSignal update] URL: ${url}`);
        
        // Verify pushToken exists and is valid before creating payload
        if (!pushToken || typeof pushToken !== 'string' || pushToken.trim().length === 0) {
          console.error(`[Cron] ❌ CRITICAL: pushToken is invalid! Value: "${pushToken}", Type: ${typeof pushToken}`);
          throw new Error(`Invalid push_token: ${pushToken}`);
        }

        const payload: any = {
          push_token: pushToken.trim(),  // ✅ CRITICAL: Include push token!
          event: 'update',
          name: 'petl-la-update',
          event_updates: {
            soc: soc,
            watts: watts,
            timeToFullMinutes: Math.max(0, timeToFullMinutes),
            isCharging: isCharging
          },
          priority: 5
        };

        // Safety check: Ensure push_token is included and valid
        if (!payload.push_token || payload.push_token.length < 32) {
          console.error(`[Cron] ❌ CRITICAL: push_token is missing or invalid in payload!`);
          console.error(`[Cron] push_token value: "${payload.push_token}", length: ${payload.push_token?.length || 0}`);
          console.error(`[Cron] Original pushToken: "${pushToken}", length: ${pushToken?.length || 0}`);
          throw new Error('push_token is required but missing or invalid');
        }

        // Verify payload structure before sending
        const payloadKeys = Object.keys(payload);
        const hasPushToken = 'push_token' in payload && payload.push_token && payload.push_token.length > 0;
        
        console.log(`[OneSignal update] Payload keys: ${payloadKeys.join(', ')}`);
        console.log(`[OneSignal update] Payload has push_token key: ${'push_token' in payload}`);
        console.log(`[OneSignal update] Payload push_token present: ${hasPushToken}`);
        console.log(`[OneSignal update] Payload push_token length: ${payload.push_token?.length || 0}`);
        
        if (!hasPushToken) {
          console.error(`[Cron] ❌ CRITICAL ERROR: push_token is MISSING from payload object!`);
          console.error(`[Cron] Payload object:`, JSON.stringify(payload, null, 2));
          console.error(`[Cron] pushToken variable:`, pushToken);
          throw new Error('push_token is missing from payload - this should never happen');
        }

        // Serialize payload to verify it includes push_token
        const serializedPayload = JSON.stringify(payload);
        const parsedPayload = JSON.parse(serializedPayload);
        if (!parsedPayload.push_token) {
          console.error(`[Cron] ❌ CRITICAL: push_token lost during JSON serialization!`);
          throw new Error('push_token lost during JSON serialization');
        }
        
        console.log(`[OneSignal update] ✅ Payload verified - push_token present (length: ${payload.push_token.length})`);
        console.log(`[OneSignal update] Payload preview (first 200 chars): ${serializedPayload.substring(0, 200)}...`);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
          },
          body: serializedPayload  // Use pre-serialized payload to ensure push_token is included
        });

        const result = await response.json();
        console.log(`[OneSignal update] Response: ${response.status} ${response.statusText}`);
        console.log(`[OneSignal update] Response body: ${JSON.stringify(result)}`);

        if (response.ok) {
          console.log(`[OneSignal update] Success - Response ID: ${result.id || 'unknown'}`);
          console.log(`[Cron] Updated activityId=${activityId.substring(0, 8)}... soc=${soc}%`);
          updateResults.push({
            activityId: activityId,
            success: true,
            responseId: result.id
          });
        } else {
          console.error(`[OneSignal update] ❌ Error: ${JSON.stringify(result, null, 2)}`);
          updateResults.push({
            activityId: activityId,
            success: false,
            error: result
          });
        }
      } catch (error) {
        console.error(`[Cron] Error updating activity ${activityId.substring(0, 8)}...:`, error);
        updateResults.push({
          activityId: activityId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successful = updateResults.filter(r => r.success).length;
    const failed = updateResults.filter(r => !r.success).length;

    console.log(`[Cron] Completed: ${successful} succeeded, ${failed} failed out of ${activeActivities.length} total`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      updated: successful,
      failed,
      total: activeActivities.length,
      results: updateResults.slice(0, 10)
    });

  } catch (error) {
    console.error('[Cron] Error updating Live Activities:', error);
    return NextResponse.json(
      {
        error: 'Failed to update Live Activities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
