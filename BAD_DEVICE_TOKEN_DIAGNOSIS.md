# APNs BadDeviceToken Error Diagnosis

## Current Status

**HTTP/2 Connection**: ✅ Working (no more parser errors)
**JWT Authentication**: ✅ Working (APNs accepted the request)
**Token Format**: ⚠️ APNs rejecting with "BadDeviceToken" error
**OneSignal Fallback**: ✅ Working (device receives updates via OneSignal)

## Error Details

```
[APNs] ❌ Failed to send Live Activity update - Status: 400
[APNs] Error response: {"reason":"BadDeviceToken"}
```

## Investigation Summary

The push token is:
- 160 hex characters (80 bytes) - correct length for Live Activity push tokens
- Format: hex string (e.g., `80a1c2b5...`)
- Same token works with OneSignal API
- Device receives updates successfully via OneSignal

## ⚠️ CRITICAL FINDING: Key ID Mismatch

From Apple Developer portal:
- **Key shown**: "PETLOneSignalKey2025"
- **Key ID in portal**: `G32XLR8935`
- **Key ID in Vercel logs**: `7SH93SA6...`

**These are different keys!**

The key shown in the portal is:
- ✅ Enabled for APNs: "Team scoped (All topics) [Sandbox & Production]"
- ✅ Should work for both sandbox and production environments
- ❌ But we're using a different Key ID (`7SH93SA6...`) in Vercel

## Possible Causes

### 1. Wrong Key ID in Vercel (Most Likely)

**Issue**: The `APNS_KEY_ID` in Vercel environment variables might be set to the wrong key ID.

**Check**:
- Verify `APNS_KEY_ID` in Vercel is set to `G32XLR8935` (the key shown in portal)
- If it's set to `7SH93SA6...`, update it to match the key you have access to
- Ensure the `APNS_KEY` (the .p8 file content) matches the key with ID `G32XLR8935`

### 2. Key File Mismatch

**Issue**: The `APNS_KEY` (p8 file content) in Vercel might be from a different key than the one with ID `G32XLR8935`.

**Solution**:
- Download the key "PETLOneSignalKey2025" (ID: `G32XLR8935`) from Apple Developer portal
- Update `APNS_KEY` in Vercel with the correct .p8 file content
- Update `APNS_KEY_ID` in Vercel to `G32XLR8935`

### 3. Environment Mismatch

APNs uses separate environments:
- **Sandbox**: For development builds
- **Production**: For TestFlight/App Store builds

If the token was generated in one environment but we're sending to the other, APNs will return "BadDeviceToken".

**Check**:
- Is the app a development build or production build (TestFlight/App Store)?
- Is `APNS_ENVIRONMENT` set to match the build type?
  - Development builds → `APNS_ENVIRONMENT=development` (uses `api.sandbox.push.apple.com`)
  - Production builds → `APNS_ENVIRONMENT=production` (uses `api.push.apple.com`)

**Note**: The key shown supports both "Sandbox & Production", so this is less likely the issue if the key ID matches.

### 4. Bundle ID/Topic Mismatch

The `apns-topic` header must match exactly:
- Current format: `${bundleId}.pushnotification.liveactivity`
- Example: `com.gopetl.PETL.pushnotification.liveactivity`

**Verify**:
- Does the bundle ID in Vercel (`APNS_BUNDLE_ID`) match the app's bundle ID?
- Is the topic format correct for Live Activities?

### 5. Token Validity

Device tokens can become invalid if:
- App is uninstalled
- Device is restored from backup
- iOS version is updated

Since OneSignal works with the same token, this is unlikely to be the issue.

## Recommended Actions

### Immediate Steps

1. **Verify Key ID in Vercel**:
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Check `APNS_KEY_ID` - should be `G32XLR8935` (not `7SH93SA6...`)
   - If wrong, update to match the key shown in Apple Developer portal

2. **Verify Key File**:
   - Download the key "PETLOneSignalKey2025" (ID: `G32XLR8935`) from Apple Developer portal
   - Update `APNS_KEY` in Vercel with the correct .p8 file content
   - Ensure the .p8 file matches the key ID `G32XLR8935`

3. **Redeploy**:
   - After updating environment variables, redeploy the Vercel project
   - Check logs to confirm the correct Key ID is being used

4. **Verify Environment**:
   - Check `APNS_ENVIRONMENT` matches the app build type
   - Development builds → `development`
   - Production builds → `production`

### Alternative Approach

Since OneSignal updates are working:
- Continue using OneSignal for Live Activity updates (currently working)
- The "No Recipients" status in OneSignal dashboard may be a UI issue, not a delivery issue
- Device is receiving updates successfully via OneSignal

### Next Steps

1. ✅ Verify `APNS_KEY_ID` in Vercel matches `G32XLR8935`
2. ✅ Download and update `APNS_KEY` with the correct .p8 file content
3. ✅ Redeploy and check logs for correct Key ID
4. ✅ Test direct APNs after fixing the key ID mismatch

## Current Implementation

- Endpoint: `/3/device/${pushToken}` (hex string)
- Topic: `${bundleId}.pushnotification.liveactivity`
- Push Type: `liveactivity`
- Payload format: Standard Live Activity payload structure

## References

- Apple APNs Documentation: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
- Live Activities Documentation: https://developer.apple.com/documentation/activitykit/updating-live-activities-with-activitykit-push-notifications
