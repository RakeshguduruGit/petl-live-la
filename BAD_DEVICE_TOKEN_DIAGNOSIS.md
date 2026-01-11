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

## ✅ Key ID Verified

From Apple Developer portal:
- **Key name**: "PETL APNs Direct Key"
- **Key ID**: `7SH93SA6Y7`
- **Key ID in Vercel logs**: `7SH93SA6...` ✅ Matches!

The key is:
- ✅ Enabled for APNs: "Team scoped (All topics) [Sandbox & Production]"
- ✅ Created specifically for direct APNs: "APNs authentication key for direct Live Activity updates"
- ✅ Should work for both sandbox and production environments
- ✅ Key ID matches what's configured in Vercel

## Possible Causes

### 1. Key File Mismatch (Most Likely)

**Issue**: The `APNS_KEY` (p8 file content) in Vercel might not match the key with ID `7SH93SA6Y7`.

**Solution**:
- Verify you downloaded the correct key file: "PETL APNs Direct Key" (ID: `7SH93SA6Y7`)
- The download button is grayed out (already downloaded or download disabled after first download)
- If you don't have the file, you'll need to create a new key or contact Apple Support
- Update `APNS_KEY` in Vercel with the correct .p8 file content for key ID `7SH93SA6Y7`

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

1. **Verify Key File**:
   - The key "PETL APNs Direct Key" (ID: `7SH93SA6Y7`) is already created
   - Download button is grayed out (keys can only be downloaded once)
   - If you don't have the .p8 file, check your Downloads folder or backup
   - If the file is missing, you'll need to create a new key (the old one cannot be re-downloaded)

2. **Verify Key ID in Vercel**:
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Check `APNS_KEY_ID` - should be `7SH93SA6Y7` ✅
   - Verify `APNS_KEY` contains the correct .p8 file content for this key ID

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

1. ✅ Verify `APNS_KEY_ID` in Vercel matches `7SH93SA6Y7` (already correct)
2. ⚠️ Verify `APNS_KEY` contains the correct .p8 file content for key ID `7SH93SA6Y7`
3. ⚠️ If key file is missing, create a new key (old keys cannot be re-downloaded)
4. ✅ Redeploy and test direct APNs after verifying key file

## Current Implementation

- Endpoint: `/3/device/${pushToken}` (hex string)
- Topic: `${bundleId}.pushnotification.liveactivity`
- Push Type: `liveactivity`
- Payload format: Standard Live Activity payload structure

## References

- Apple APNs Documentation: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
- Live Activities Documentation: https://developer.apple.com/documentation/activitykit/updating-live-activities-with-activitykit-push-notifications
