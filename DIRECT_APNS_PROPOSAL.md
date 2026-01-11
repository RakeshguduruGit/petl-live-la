# Direct APNs Live Activity Updates - Proposal

## Problem

OneSignal UPDATE events for locally-created Live Activities show "No Recipients" when the app is closed. This is a fundamental limitation of OneSignal's Live Activities API - it's designed for push-to-start (remote creation), not locally-created activities.

## Current Architecture

1. **iOS app** creates Live Activity locally using ActivityKit
2. **iOS app** sends START to `/api/la/start` with `push_token`
3. **Vercel backend** forwards to OneSignal Live Activities API
4. **OneSignal** should deliver UPDATE events to device via APNs
5. **Problem**: OneSignal shows "No Recipients" - UPDATE events are not delivered

## Proposed Solution: Direct APNs Updates

Instead of using OneSignal's Live Activities API for UPDATE events, send updates directly via Apple Push Notification Service (APNs) using the push token.

### Requirements

To send direct APNs push notifications, we need:

1. **APNs Authentication Key** (.p8 file)
   - Generated from Apple Developer account
   - Key ID
   - Team ID

2. **Node.js Library**
   - `apn` or `node-apn` package
   - Handles JWT authentication and APNs protocol

3. **Environment Variables**
   - `APNS_KEY_ID` - Key ID from Apple Developer
   - `APNS_TEAM_ID` - Team ID from Apple Developer  
   - `APNS_KEY` - Contents of .p8 file (base64 encoded or raw)
   - `APNS_BUNDLE_ID` - Bundle ID (e.g., `com.gopetl.PETL`)
   - `APNS_TOPIC` - Usually same as bundle ID + `.pushnotification.liveactivity` for Live Activities

4. **Push Token** (already have this)
   - Received from iOS app via ActivityKit
   - Stored in session store

### Implementation Plan

1. **Install APNs library**
   ```bash
   npm install apn
   ```

2. **Create APNs client utility** (`lib/apns-client.ts`)
   - Initialize APNs provider with credentials
   - Create JWT token for authentication
   - Send Live Activity update push notifications

3. **Create new endpoint** (`/api/la/update-direct-apns`)
   - Accepts `activityId`, `pushToken`, and `state`
   - Sends update directly via APNs
   - Bypasses OneSignal API

4. **Update cron job** (`/api/cron/update-live-activities`)
   - Try OneSignal API first (for backward compatibility)
   - If fails, fall back to direct APNs
   - Or use direct APNs as primary method

### APNs Live Activity Payload Format

```json
{
  "aps": {
    "timestamp": 1234567890,
    "event": "update",
    "content-state": {
      "soc": 80,
      "watts": 10.0,
      "timeToFullMinutes": 14,
      "isCharging": true
    }
  }
}
```

### Challenges

1. **APNs Credentials Required**
   - Need .p8 key from Apple Developer account
   - Key ID and Team ID
   - Must be stored securely (Vercel environment variables)

2. **Development vs Production**
   - Development uses `api.sandbox.push.apple.com`
   - Production uses `api.push.apple.com`
   - Different certificates/keys for each environment

3. **JWT Token Generation**
   - Must generate JWT token for each request (or cache for 1 hour)
   - Requires cryptographic libraries

4. **Testing**
   - Need to test with real device
   - APNs sandbox requires development build
   - Production requires TestFlight or App Store build

### Alternative: Continue with OneSignal

If direct APNs is too complex, we could:

1. **Investigate player ID issue**
   - Why is player ID invalid?
   - Is it from wrong environment?
   - Does player exist in OneSignal dashboard?

2. **Use push-to-start instead**
   - Major refactor: Create activities remotely via OneSignal
   - iOS app receives push-to-start notification
   - Activity is created by system, not app
   - UPDATE events should work for push-to-start activities

3. **Hybrid approach**
   - Keep START/END via OneSignal (works)
   - Use direct APNs for UPDATE events only
   - Minimal changes to existing code

### Recommendation

**Start with investigating player ID issue** - it's simpler and may solve the problem:

1. Check if player ID exists in OneSignal dashboard
2. Verify player ID is from correct OneSignal app
3. Check if player ID format is correct (UUID format)
4. Verify OneSignal SDK is properly initialized

If player ID issue cannot be resolved, then implement direct APNs for UPDATE events.

## Next Steps

1. ✅ Document the proposal (this file)
2. ⏳ Check OneSignal dashboard for player ID
3. ⏳ Verify player ID is correct
4. ⏳ If needed, implement direct APNs solution
5. ⏳ Test with real device
