# Silent Push Troubleshooting

## Current Status
- ✅ Vercel cron sends push successfully (200 OK)
- ❌ iOS app not updating LA/DI
- ❌ LA/DI not dismissing on unplug

## Likely Issues

### 1. Silent Push Delivery Limitations
iOS has strict rules for background/silent pushes:
- App must NOT be force-closed
- Background App Refresh must be enabled
- Low Power Mode must be OFF
- iOS may throttle/delay delivery

### 2. OneSignal Payload Format
Current payload:
```javascript
{
  app_id: "...",
  filters: [...],
  content_available: true,
  data: { type: 'petl-bg-update', timestamp: '...' }
}
```

OneSignal wraps the `data` field in `custom -> a` structure. The iOS app checks:
1. `userInfo["custom"]["a"]` (OneSignal standard)
2. `userInfo["custom"]`
3. `userInfo["data"]`
4. `userInfo` (top-level)

So `data.type` should be accessible via `userInfo["custom"]["a"]["type"]` or `userInfo["data"]["type"]`.

### 3. Background Push Headers
We removed `apns_push_type_override` because OneSignal rejected it. However, iOS requires proper APNs headers for background pushes. OneSignal should set these automatically for `content_available: true` with no title/body, but it might not be working.

## Next Steps

### Check iOS Logs
Look for these log messages in Xcode console or device logs:
- `📨 handleRemoteNotification called - keys: ...`
- `📨 Parsed - isSilent: ...`
- `🔔 Silent push received - triggering background analytics update`

If these logs are missing, the push isn't being received.

### Verify App State
- App should NOT be force-closed
- Background App Refresh: Settings > General > Background App Refresh > PETL (ON)
- Low Power Mode: OFF

### Test with Minimal Visible Notification (Temporary)
Add a minimal `headings` field to verify delivery:
```javascript
headings: { en: "PETL" },
contents: { en: "" },  // Empty but present
```

This will help determine if it's a delivery issue or processing issue.

### Alternative: Check OneSignal Dashboard
Check OneSignal dashboard for:
- Delivery status
- Device subscription status
- Any error messages

