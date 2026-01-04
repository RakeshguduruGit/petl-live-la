# Contract Match Verification: iOS ↔ Vercel

## ✅ Endpoint Matching

| iOS Endpoint | Vercel Route | Status |
|-------------|--------------|--------|
| POST `/api/la/start` | `app/api/la/start/route.ts` | ✅ Matches |
| POST `/api/la/update` | `app/api/la/update/route.ts` | ✅ Matches |
| POST `/api/la/end` | `app/api/la/end/route.ts` | ✅ Matches |
| POST `/api/la/health` | `app/api/la/health/route.ts` | ✅ Created |

## ✅ Payload Field Matching

### `/api/la/start`
**iOS sends:**
- `activityId` ✅
- `laPushToken` ⚠️ (sent but not used - OK, OneSignal uses activityId)
- `contentState` ✅
- `meta` ✅

**Vercel expects:**
- `activityId` ✅
- `contentState` ✅
- `meta.playerId` ✅

### `/api/la/update`
**iOS sends:**
- `activityId` ✅
- `contentState` ✅
- `ttlSeconds` ⚠️ (sent but not used - OK, OneSignal doesn't need it)
- `meta` ✅

**Vercel expects:**
- `activityId` ✅
- `contentState` ✅

### `/api/la/end`
**iOS sends:**
- `activityId` ✅
- `immediate` ✅
- `meta` ✅

**Vercel expects:**
- `activityId` ✅
- `immediate` ✅
- `meta.playerId` ✅

### `/api/la/health`
**iOS sends:**
- `meta` ✅

**Vercel expects:**
- `meta` (optional) ✅

## ✅ Header Matching

**iOS sends:**
- `X-PETL-Secret` header ✅

**Vercel validates:**
- `x-petl-secret` header ✅
- Matches `PETL_SERVER_SECRET` env var ✅

## ✅ Response Format

**iOS expects:**
- JSON response
- Status codes: 200 (success), 400 (bad request), 401 (unauthorized), 500 (server error)

**Vercel returns:**
- `Response.json()` ✅
- Correct status codes ✅

## Conclusion

**✅ ALL CONTRACTS MATCH**

The Vercel API routes correctly handle all fields sent by the iOS app. Optional fields that aren't used (like `laPushToken`, `ttlSeconds`) are ignored gracefully, which is correct behavior.

