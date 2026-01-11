# APNs TopicDisallowed Error

## Current Status

After fixing the environment mismatch:
- ✅ Environment: development (correct - matches iOS app)
- ✅ URL: `api.sandbox.push.apple.com` (sandbox endpoint)
- ✅ BadDeviceToken error resolved (environment mismatch fixed)
- ❌ New error: "TopicDisallowed"

## Error Details

```
[APNs] ❌ Failed to send Live Activity update - Status: 400
[APNs] Error response: {"reason":"TopicDisallowed"}
```

## Current Topic Format

Current `apns-topic` header:
```
com.gopetl.PETL.pushnotification.liveactivity
```

## Possible Causes

### 1. Topic Format Issue

For Live Activities, APNs might require a different topic format. The standard format for regular push notifications is:
- `com.bundle.id` (just the bundle ID)

For Live Activities, it might need:
- Just the bundle ID: `com.gopetl.PETL`
- Or a different suffix format

### 2. Key Permissions

The APNs key might not have permissions for Live Activities topic format. However, the key shows "Team scoped (All topics)" which should allow any topic.

### 3. Bundle ID Verification

Verify the bundle ID matches exactly:
- Expected: `com.gopetl.PETL`
- Current topic: `com.gopetl.PETL.pushnotification.liveactivity`

## Next Steps

1. **Check Apple Documentation** for Live Activities topic format
2. **Try different topic formats:**
   - Just bundle ID: `com.gopetl.PETL`
   - Without `.liveactivity`: `com.gopetl.PETL.pushnotification`
   - Current: `com.gopetl.PETL.pushnotification.liveactivity`

3. **Verify Key Permissions** - The key should support "All topics"

## Progress Summary

1. ✅ Fixed key format (5 dashes)
2. ✅ Fixed environment mismatch (development vs production)
3. ⚠️ Current issue: Topic format may be incorrect
