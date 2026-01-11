// Next.js App Router API Route: Update Live Activities directly via OneSignal
// This is called by Vercel Cron every 3 minutes
import { getAPNsClient } from '@/lib/apns-client';
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
    const activeActivities = await getAllActiveActivities();
    
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

    const updateResults: Array<{ activityId: string; success: boolean; responseId?: string; method?: 'apns' | 'onesignal'; error?: any }> = [];
    
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
      
      // DIAGNOSTIC: Log session store state
      const ageSeconds = Math.round((Date.now() - session.lastUpdated) / 1000);
      console.log(`[Cron] 📊 Session store state for ${activityId.substring(0, 8)}...: soc=${soc}%, watts=${watts}W, timeToFull=${timeToFullMinutes}m, isCharging=${isCharging}, lastUpdated=${new Date(session.lastUpdated).toISOString()}, age=${ageSeconds}s`);

      // Try direct APNs update first (if configured)
      const apnsClient = getAPNsClient();
      if (apnsClient.isConfigured()) {
        console.log(`[Cron] 🍎 Attempting direct APNs update for ${activityId.substring(0, 8)}...`);
        const apnsResult = await apnsClient.sendLiveActivityUpdate(pushToken, {
          soc,
          watts,
          timeToFullMinutes,
          isCharging
        });
        
        if (apnsResult.success) {
          console.log(`[Cron] ✅ Direct APNs update succeeded for ${activityId.substring(0, 8)}... - APNs ID: ${apnsResult.responseId}`);
          updateResults.push({
            activityId: activityId,
            success: true,
            responseId: apnsResult.responseId || 'apns-direct',
            method: 'apns'
          });
          continue; // Skip OneSignal update if APNs succeeded
        } else {
          console.warn(`[Cron] ⚠️ Direct APNs update failed for ${activityId.substring(0, 8)}...: ${apnsResult.error}`);
          console.log(`[Cron] 🔄 Falling back to OneSignal API for ${activityId.substring(0, 8)}...`);
          // Continue to OneSignal update as fallback
        }
      }

      // If activity is stale (5+ minutes old), send silent push to wake app to check battery state
      // This allows the app to detect battery disconnect and send END event
      if (ageSeconds > 5 * 60 && session.playerId) {
        console.log(`[Cron] ⚠️ Activity ${activityId.substring(0, 8)}... is stale (age: ${ageSeconds}s) - sending silent push to wake app for battery state check`);
        try {
          const wakePayload = {
            app_id: ONESIGNAL_APP_ID.trim(),
            include_player_ids: [session.playerId],
            content_available: true,
            data: {
              type: 'cron-stale-check',
              timestamp: new Date().toISOString(),
              activityId: activityId,
              ageSeconds: ageSeconds
            }
          };
          
          const wakeResponse = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${ONESIGNAL_REST_API_KEY.trim()}`
            },
            body: JSON.stringify(wakePayload)
          });
          
          const wakeResult = await wakeResponse.json();
          if (wakeResponse.ok && wakeResult.id) {
            console.log(`[Cron] ✅ Silent push sent to wake app for stale check - ID: ${wakeResult.id}`);
          } else {
            console.warn(`[Cron] ⚠️ Failed to send stale check push: ${JSON.stringify(wakeResult)}`);
          }
        } catch (wakeError) {
          console.error(`[Cron] ❌ Failed to send stale check push: ${wakeError}`);
          // Continue with UPDATE attempt - don't fail the cron job
        }
      }

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
        
        // DIAGNOSTIC: Log full payload structure
        console.log(`[Cron] 📦 Full payload for ${activityId.substring(0, 8)}...:`, JSON.stringify({
          event: payload.event,
          name: payload.name,
          priority: payload.priority,
          push_token_length: payload.push_token?.length || 0,
          push_token_prefix: payload.push_token?.substring(0, 8) || 'MISSING',
          event_updates: payload.event_updates
        }, null, 2));

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
        // Log response headers (Headers is iterable but not easily JSON-ifiable)
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log(`[OneSignal update] 🔍 Response headers:`, JSON.stringify(responseHeaders, null, 2));

        if (response.ok) {
          console.log(`[OneSignal update] ✅ Success - Response ID: ${result.id || 'unknown'}`);
          console.log(`[Cron] ✅ Updated activityId=${activityId.substring(0, 8)}... soc=${soc}%, watts=${watts}W, timeToFull=${timeToFullMinutes}m, isCharging=${isCharging}`);
          console.log(`[Cron] 💡 OneSignal accepted the UPDATE - check dashboard to see if it shows "Delivered" or "No Recipients"`);
          updateResults.push({
            activityId: activityId,
            success: true,
            responseId: result.id,
            method: 'onesignal'
          });
        } else {
          console.error(`[OneSignal update] ❌ Error (${response.status}): ${JSON.stringify(result, null, 2)}`);
          console.error(`[Cron] ❌ Failed to update ${activityId.substring(0, 8)}... - OneSignal API rejected the request`);
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
    const apnsCount = updateResults.filter(r => r.method === 'apns' && r.success).length;
    const onesignalCount = updateResults.filter(r => r.method === 'onesignal' && r.success).length;

    console.log(`[Cron] ✅ Completed: ${successful} succeeded, ${failed} failed out of ${activeActivities.length} total`);
    console.log(`[Cron] 📊 Summary: ${apnsCount} via direct APNs, ${onesignalCount} via OneSignal API`);
    if (apnsCount > 0) {
      console.log(`[Cron] 🍎 Direct APNs updates enabled and working`);
    } else if (getAPNsClient().isConfigured()) {
      console.log(`[Cron] ⚠️ Direct APNs is configured but no updates were sent via APNs (all used OneSignal fallback)`);
    } else {
      console.log(`[Cron] 💡 Direct APNs not configured - set APNS_KEY_ID, APNS_TEAM_ID, and APNS_KEY environment variables to enable`);
    }
    console.log(`[Cron] 💡 Note: OneSignal API returns 201 Created, but check dashboard for "Delivered" vs "No Recipients" status`);
    console.log(`[Cron] 🔍 Direct APNs should work for locally-created activities, unlike OneSignal UPDATE events`);
    
    // Send silent push to wake iOS app so it can log what's happening
    // This allows us to see iOS logs in Vercel even when app is closed
    if (successful > 0 && activeActivities.length > 0) {
      try {
        const playerIds = activeActivities
          .map(s => s.playerId)
          .filter((id): id is string => !!id && id.trim().length > 0);
        
        if (playerIds.length > 0) {
          console.log(`[Cron] 📱 Sending silent push to wake iOS app for logging (${playerIds.length} players)`);
          
          const silentPushPayload = {
            app_id: ONESIGNAL_APP_ID.trim(),  // Ensure no whitespace
            include_player_ids: playerIds,
            content_available: true,
            // No title/body = silent notification (OneSignal automatically sets APNs push type to background)
            data: {
              type: 'cron-update-log',
              timestamp: new Date().toISOString(),
              updateCount: successful,
              activityCount: activeActivities.length
            }
          };
          
          console.log(`[Cron] 📱 Silent push payload app_id: "${ONESIGNAL_APP_ID.trim()}" (length: ${ONESIGNAL_APP_ID.trim().length})`);
          
          const pushResponse = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${ONESIGNAL_REST_API_KEY.trim()}`  // Ensure no whitespace
            },
            body: JSON.stringify(silentPushPayload)
          });
          
          const pushResult = await pushResponse.json();
          if (pushResponse.ok && pushResult.id) {
            console.log(`[Cron] ✅ Silent push sent to wake iOS app - ID: ${pushResult.id}`);
            console.log(`[Cron] 📱 iOS app should wake briefly and log UPDATE event status`);
          } else {
            console.warn(`[Cron] ⚠️ Silent push failed: ${JSON.stringify(pushResult)}`);
          }
        } else {
          console.log(`[Cron] ⚠️ No playerIds available - cannot send silent push to wake iOS app`);
        }
      } catch (pushError) {
        console.error(`[Cron] ❌ Failed to send silent push: ${pushError}`);
        // Don't fail the cron job if silent push fails
      }
    }

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
