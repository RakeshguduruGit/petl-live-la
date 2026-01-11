# APNs DeviceTokenNotForTopic Error

## Current Status

After fixing topic format:
- ✅ Environment: development (correct)
- ✅ Topic format: bundle ID only (fixed TopicDisallowed)
- ❌ New error: "DeviceTokenNotForTopic"

## Error Details

```
[APNs] ❌ Failed to send Live Activity update - Status: 400
[APNs] Error response: {"reason":"DeviceTokenNotForTopic"}
```

## Current Configuration

- **Topic (apns-topic header)**: `com.gopetl.PETL`
- **Bundle ID in Vercel**: `com.gopetl.PETL` (should match)
- **iOS App Bundle ID**: `com.gopetl.PETL` (from Info.plist)

## Possible Causes

### 1. Bundle ID Mismatch

The `apns-topic` header must exactly match the bundle ID that the push token was generated for.

**Verify**:
- `APNS_BUNDLE_ID` in Vercel should be exactly `com.gopetl.PETL`
- iOS app's bundle ID should be exactly `com.gopetl.PETL`
- No extra spaces, different casing, or typos

### 2. Live Activities Topic Format

For Live Activities, APNs might require a different topic format. Some possibilities:
- Just bundle ID: `com.gopetl.PETL` (current)
- With `.pushnotification.liveactivity`: `com.gopetl.PETL.pushnotification.liveactivity`
- Just bundle ID with different header combination

### 3. Token Scope

Live Activity push tokens might be scoped differently than regular device tokens. The token might be valid but not for the topic format we're using.

### 4. OneSignal Difference

Since OneSignal works with the same token, they might be:
- Using a different topic format
- Handling the token differently
- Using a different APNs endpoint or method

## Next Steps

1. **Verify Bundle ID Exactly Matches**:
   - Check `APNS_BUNDLE_ID` in Vercel is exactly `com.gopetl.PETL`
   - Verify iOS app bundle ID matches exactly

2. **Try Different Topic Formats** (if needed):
   - Current: `com.gopetl.PETL`
   - Alternative: `com.gopetl.PETL.pushnotification.liveactivity`

3. **Check Apple Documentation**:
   - Review official Apple documentation for Live Activities topic format
   - Verify if Live Activities have special topic requirements

## Progress Summary

1. ✅ Fixed key format (5 dashes)
2. ✅ Fixed environment mismatch (development)
3. ✅ Fixed TopicDisallowed (using bundle ID only)
4. ⚠️ Current issue: DeviceTokenNotForTopic (token/topic mismatch)
