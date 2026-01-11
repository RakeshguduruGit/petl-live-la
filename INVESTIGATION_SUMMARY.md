# Investigation Summary: Live Activity Updates Not Working

## Problem

The app is not waking up in the background to update Live Activities (LA) and Dynamic Island (DI). The issue has multiple root causes:

1. **OneSignal UPDATE events show "No Recipients"** - UPDATE events are not being delivered to devices
2. **Silent pushes fail** - Invalid player ID (`675e4928-9d45-495d-ac24-0b8c3dba27e7`) prevents app from waking
3. **Background tasks unreliable** - iOS controls when background tasks run (15-30 min intervals, may not run at all)

## Root Cause Analysis

### OneSignal UPDATE Events - "No Recipients"

**Finding**: OneSignal's Live Activities API UPDATE events show "No Recipients" for locally-created activities when the app is closed.

**Why**: OneSignal's Live Activities API is designed for **push-to-start** (remote creation), not **locally-created** activities. According to Apple's documentation, remote updates for locally-created Live Activities must come directly via APNs using the push token, not through OneSignal's Live Activities API.

**Evidence**:
- ✅ START events show "Delivered" in OneSignal dashboard
- ❌ UPDATE events show "No Recipients" in OneSignal dashboard
- ✅ OneSignal API returns 201 Created for UPDATE events
- ❌ But updates are not actually delivered to devices

### Player ID Issue

**Finding**: Player ID `675e4928-9d45-495d-ac24-0b8c3dba27e7` is invalid when trying to send silent pushes.

**Possible Causes**:
1. Player ID is from a different OneSignal app (environment mismatch)
2. Player was deleted/expired in OneSignal
3. Player ID is from test environment, but using production app
4. OneSignal SDK is not properly initialized/registered

**Evidence**:
- Vercel logs show: `{"errors":{"invalid_player_ids":["675e4928-9d45-495d-ac24-0b8c3dba27e7"]}}`
- START endpoint logs show: `⚠️ Player 675e4928... not found (404)`
- Player ID is stored in UserDefaults: `OneSignalPlayerID`

**Next Steps to Investigate**:
1. Check OneSignal dashboard to see if player ID exists
2. Verify player ID is from correct OneSignal app (check APP ID)
3. Check if OneSignal SDK is properly initialized
4. Verify player ID format (should be UUID)

### Background Tasks

**Finding**: iOS background tasks (BGAppRefreshTask, BGProcessingTask) are unreliable for real-time updates.

**Why**: iOS controls when background tasks run:
- May run 15-30 minutes after scheduled time
- May not run at all if device is in low power mode
- May not run if user hasn't opened app recently
- Cannot rely on for real-time updates

**Current Implementation**:
- Background tasks are registered and scheduled
- Tasks fire when iOS allows (unpredictable timing)
- Tasks update charts/analytics but not Live Activities

## Proposed Solutions

### Option 1: Direct APNs Updates (Recommended)

**Approach**: Send Live Activity updates directly via Apple Push Notification Service (APNs), bypassing OneSignal's Live Activities API.

**Pros**:
- Works for locally-created activities
- Direct control over delivery
- No dependency on OneSignal for updates
- Uses standard APNs protocol

**Cons**:
- Requires APNs credentials (.p8 key file, Key ID, Team ID)
- More complex implementation
- Need to handle JWT authentication
- Need to manage development vs production environments

**Status**: 
- ✅ Proposal document created (`DIRECT_APNS_PROPOSAL.md`)
- ✅ APNs client implementation started (`lib/apns-client.ts`)
- ❌ APNs credentials not available yet
- ❌ Needs testing with real device

**Next Steps**:
1. Obtain APNs credentials from Apple Developer account
2. Install `apn` npm package (or use native fetch with JWT)
3. Test APNs payload format with real device
4. Implement endpoint to send updates via APNs
5. Update cron job to use direct APNs for UPDATE events

### Option 2: Fix Player ID Issue

**Approach**: Investigate and fix the player ID issue so silent pushes work.

**Pros**:
- Simpler (may just need to fix player ID)
- Uses existing OneSignal infrastructure
- Silent pushes can wake app for local updates

**Cons**:
- May not solve UPDATE event delivery issue
- Still dependent on OneSignal
- Silent pushes are unreliable (iOS may not deliver)

**Next Steps**:
1. Check OneSignal dashboard for player ID
2. Verify player ID matches OneSignal app
3. Check if player is subscribed
4. Verify OneSignal SDK initialization
5. Test silent push with valid player ID

### Option 3: Hybrid Approach

**Approach**: 
- Keep START/END via OneSignal (works)
- Use direct APNs for UPDATE events only
- Fix player ID for silent pushes (logging/background wake)

**Pros**:
- Best of both worlds
- Minimal changes to existing code
- Direct APNs for critical updates
- Silent pushes for optional features

**Cons**:
- More complex architecture
- Need to maintain both systems
- Still need APNs credentials

## Recommendations

### Immediate Actions

1. **Investigate Player ID** (Quick Win)
   - Check OneSignal dashboard
   - Verify player ID is correct
   - Fix if it's wrong environment/mismatch
   - This will enable silent pushes for logging/background wake

2. **Document APNs Requirements** (Preparation)
   - Identify who has access to Apple Developer account
   - List required credentials (.p8 key, Key ID, Team ID)
   - Plan how to securely store credentials (Vercel environment variables)

3. **Test Current State** (Baseline)
   - Verify UPDATE events are actually not being delivered
   - Check if Live Activity updates when app is open
   - Confirm background tasks are firing (even if delayed)

### Long-term Solution

**Implement Direct APNs for UPDATE Events**:
- This is the only reliable way to update locally-created Live Activities when app is closed
- OneSignal's UPDATE API fundamentally doesn't work for locally-created activities
- Direct APNs gives us full control over delivery

**Keep OneSignal for**:
- START events (works fine)
- END events (works fine)
- Silent pushes (once player ID is fixed)
- User-facing push notifications

## Files Created

1. `DIRECT_APNS_PROPOSAL.md` - Detailed proposal for direct APNs solution
2. `lib/apns-client.ts` - Initial APNs client implementation (needs credentials to work)
3. `INVESTIGATION_SUMMARY.md` - This file

## Next Steps

1. **Review this summary** and choose approach
2. **Check OneSignal dashboard** for player ID
3. **Obtain APNs credentials** if proceeding with direct APNs
4. **Implement chosen solution**
5. **Test with real device**
