# API Contract Verification: iOS App ↔ Vercel

## iOS App Contract (LiveActivityRemoteClient.swift)

**Base URL:** `https://petl-live-la.vercel.app` ✅

### POST `/api/la/start`
**iOS sends:**
```swift
{
  activityId: String,
  laPushToken: String,      // Live Activity push token (hex)
  contentState: ContentState { soc, watts, timeToFullMinutes, isCharging },
  meta: Meta { schemaVersion, appVersion, build, deviceModel, osVersion, bundleId, playerId }
}
```
**Header:** `X-PETL-Secret`

### POST `/api/la/update`
**iOS sends:**
```swift
{
  activityId: String,
  contentState: ContentState,
  ttlSeconds: Int (default 120),
  meta: Meta
}
```

### POST `/api/la/end`
**iOS sends:**
```swift
{
  activityId: String,
  immediate: Bool,
  meta: Meta
}
```

### POST `/api/la/health`
**iOS sends:**
```swift
{
  meta: Meta
}
```

## Vercel API Routes Status

### ✅ `/api/la/start`
- Accepts: `activityId`, `contentState`, `meta.playerId` ✅
- Ignores: `laPushToken` (not needed for OneSignal Live Activities) ✅
- Uses: `callOneSignal('update', ...)` to send initial update ✅
- Tags device: Sets `charging=true` tag server-side ✅

### ✅ `/api/la/update`
- Accepts: `activityId`, `contentState` ✅
- Uses: `callOneSignal('update', ...)` ✅

### ✅ `/api/la/end`
- Accepts: `activityId`, `immediate` ✅
- Uses: `callOneSignal('end', ...)` ✅
- Removes tag: `charging` tag removed server-side ✅

### ✅ `/api/la/health`
- Accepts: `meta` (optional) ✅
- Returns: Health status ✅

## Verification

**✅ All endpoints match iOS app expectations**
**✅ All required fields handled**
**✅ Optional fields handled gracefully**
**✅ Headers validated correctly**

## Notes

- `laPushToken` is sent by iOS but not used by Vercel (OneSignal uses activityId)
- Vercel routes use `callOneSignal()` helper which formats OneSignal API correctly
- Server-side tagging ensures tags are set even if SDK sync is delayed

