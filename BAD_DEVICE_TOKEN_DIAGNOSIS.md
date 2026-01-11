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

## Possible Causes

### 1. Environment Mismatch (Most Likely)

APNs uses separate environments:
- **Sandbox**: For development builds
- **Production**: For TestFlight/App Store builds

If the token was generated in one environment but we're sending to the other, APNs will return "BadDeviceToken".

**Check**:
- Is the app a development build or production build (TestFlight/App Store)?
- Is `APNS_ENVIRONMENT` set to match the build type?
  - Development builds → `APNS_ENVIRONMENT=development` (uses `api.sandbox.push.apple.com`)
  - Production builds → `APNS_ENVIRONMENT=production` (uses `api.push.apple.com`)

### 2. Token Format Issue

APNs expects device tokens in hex format in the URL path for regular push notifications. However, Live Activity push tokens might have different requirements.

**Current implementation**:
- Token is sent as hex string in URL path: `/3/device/${pushToken}`
- This matches standard APNs documentation for regular device tokens

**Note**: OneSignal handles the APNs communication internally, so they may be converting the token format or using a different endpoint.

### 3. Bundle ID/Topic Mismatch

The `apns-topic` header must match exactly:
- Current format: `${bundleId}.pushnotification.liveactivity`
- Example: `com.gopetl.PETL.pushnotification.liveactivity`

**Verify**:
- Does the bundle ID in Vercel (`APNS_BUNDLE_ID`) match the app's bundle ID?
- Is the topic format correct for Live Activities?

### 4. Token Validity

Device tokens can become invalid if:
- App is uninstalled
- Device is restored from backup
- iOS version is updated

Since OneSignal works with the same token, this is unlikely to be the issue.

## Recommendations

### Immediate Action

1. **Verify Environment Configuration**:
   ```bash
   # Check Vercel environment variables
   - APNS_ENVIRONMENT should be 'production' for TestFlight/App Store builds
   - APNS_ENVIRONMENT should be 'development' for development builds
   ```

2. **Check App Build Type**:
   - Is this a TestFlight/App Store build? → Use `production` environment
   - Is this a development build? → Use `development` environment

3. **Verify Bundle ID**:
   - Confirm `APNS_BUNDLE_ID` in Vercel matches the app's bundle ID exactly
   - Current value: `com.gopetl.PETL`

### Alternative Approach

Since OneSignal updates are working:
- Continue using OneSignal for Live Activity updates (currently working)
- The "No Recipients" status in OneSignal dashboard may be a UI issue, not a delivery issue
- Device is receiving updates successfully via OneSignal

### Next Steps

1. Verify `APNS_ENVIRONMENT` matches the app build type
2. Check if switching environments fixes the issue
3. Consider staying with OneSignal if it continues to work reliably
4. If direct APNs is critical, investigate if Live Activities require a different endpoint or token format

## Current Implementation

- Endpoint: `/3/device/${pushToken}` (hex string)
- Topic: `${bundleId}.pushnotification.liveactivity`
- Push Type: `liveactivity`
- Payload format: Standard Live Activity payload structure

## References

- Apple APNs Documentation: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
- Live Activities Documentation: https://developer.apple.com/documentation/activitykit/updating-live-activities-with-activitykit-push-notifications
