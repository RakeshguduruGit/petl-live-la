// Next.js App Router API Route: End Live Activity
// Receives Live Activity end request from iOS app and forwards to OneSignal

import { NextRequest, NextResponse } from 'next/server';
import { removeActivity } from '@/lib/session-store';

export async function POST(request: NextRequest) {
  // Security: Verify request has valid secret
  const secret = request.headers.get('x-petl-secret');
  const expectedSecret = process.env.PETL_SERVER_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { activityId, immediate, meta } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'Missing activityId' }, { status: 400 });
    }

    // Get OneSignal credentials from environment
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[LA/END] Missing OneSignal credentials');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Forward to OneSignal Live Activity API to end
    // Format matches iOS app's OneSignalClient.swift implementation
    const dismissalDate = immediate 
      ? Math.floor(Date.now() / 1000) - 5  // Force immediate dismissal
      : Math.floor(Date.now() / 1000);     // Normal dismissal
    
    const response = await fetch(
      `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/live_activities/${activityId}/notifications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
          event: 'end',
          name: 'petl-la-end',  // ✅ Required by OneSignal
          // OneSignal requires event_updates even for end; send a minimal valid ContentState
          event_updates: {
            soc: 0,
            watts: 0.0,
            timeToFullMinutes: 2,
            isCharging: false
          },
          // Force immediate dismissal by setting a recent past timestamp
          dismissal_date: dismissalDate
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[LA/END] OneSignal API error:', result);
      return NextResponse.json(
        { error: 'OneSignal API error', details: result },
        { status: response.status }
      );
    }

    // Remove activity from session store
    await removeActivity(activityId);

    // Remove activity_id tag from player (if we have playerId in meta)
    // Only attempt tag removal if player exists in OneSignal to avoid unnecessary 404 warnings
    const playerId = meta?.playerId;
    if (playerId) {
      try {
        // First, check if player exists in OneSignal
        const playerCheckUrl = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/players/${playerId}`;
        const playerCheckResponse = await fetch(playerCheckUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
          }
        });
        
        if (!playerCheckResponse.ok) {
          if (playerCheckResponse.status === 404) {
            console.log(`[LA/END] ℹ️ Player ${playerId.substring(0, 8)}... not found in OneSignal (404). Skipping tag removal - player doesn't exist yet.`);
          } else {
            console.warn(`[LA/END] ⚠️ Could not verify player existence (status: ${playerCheckResponse.status}). Skipping tag removal.`);
          }
          // Don't attempt tag removal if player doesn't exist
        } else {
          // Player exists - proceed with tag removal
          console.log(`[LA/END] ✅ Player ${playerId.substring(0, 8)}... exists - removing activity tags`);
          const tagResponse = await fetch(
            `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/players/${playerId}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
              },
              body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,  // OneSignal requires app_id in body
                tags: {
                  la_activity_id: '',  // Empty string removes the tag
                  la_push_token: '',   // Remove push token too
                  charging: 'false'    // Remove charging tag
                }
              })
            }
          );

          if (!tagResponse.ok) {
            // Check content type before trying to parse as JSON
            const contentType = tagResponse.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
              // JSON error response
              try {
                const tagError = await tagResponse.json();
                console.error('[LA/END] Failed to remove activity_id tag:', JSON.stringify(tagError, null, 2));
              } catch (e) {
                const text = await tagResponse.text().catch(() => '');
                console.error(`[LA/END] Failed to remove tags - JSON parse error: ${e}`);
                console.error(`[LA/END] Response preview: ${text.substring(0, 200)}...`);
              }
            } else {
              const text = await tagResponse.text().catch(() => '');
              console.warn(`[LA/END] ⚠️ Failed to remove tags - OneSignal returned HTML/error page (status: ${tagResponse.status})`);
              console.warn(`[LA/END] Response preview: ${text.substring(0, 200)}...`);
            }
            // Don't fail the request if tag removal fails - Live Activity end succeeded
          } else {
            const contentType = tagResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              try {
                const tagResult = await tagResponse.json();
                console.log(`[LA/END] ✅ Removed activity_id tag for player ${playerId.substring(0, 8)}...`);
              } catch (e) {
                console.warn(`[LA/END] ⚠️ Tag removal succeeded but response was not valid JSON: ${e}`);
              }
            } else {
              console.warn(`[LA/END] ⚠️ Tag removal returned non-JSON response (content-type: ${contentType})`);
            }
          }
        }
      } catch (error) {
        console.error('[LA/END] ❌ Error during tag removal check:', error);
        console.error('[LA/END] Error details:', error instanceof Error ? error.message : String(error));
        // Continue - Live Activity end succeeded, session store already cleaned up
      }
    } else {
      console.log(`[LA/END] ℹ️ No playerId provided in meta - skipping tag removal`);
    }

    return NextResponse.json({
      success: true,
      activityId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[LA/END] Error:', error);
    return NextResponse.json(
      { error: 'Failed to end Live Activity', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

