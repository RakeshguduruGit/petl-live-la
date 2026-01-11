# BadDeviceToken Error Still Occurring

## Current Status

After fixing the key format (5 dashes), the error persists:
- ✅ APNs Configuration loaded correctly
- ✅ Key ID: 7SH93SA6... (matches "PETL APNs Direct Key")
- ✅ HTTP/2 connection working
- ✅ JWT authentication working
- ❌ Still getting BadDeviceToken error

## Possible Remaining Causes

### 1. Environment Mismatch (Most Likely)

The iOS app might be using a different APNs environment than production.

**Check iOS App Configuration:**
- Look in `PETL.entitlements` for `aps-environment`
- Development builds use `aps-environment=development` (requires sandbox)
- Production builds use `aps-environment=production` (requires production)

**If the app is a development build:**
- Set `APNS_ENVIRONMENT=development` in Vercel
- This will use `api.sandbox.push.apple.com` instead of `api.push.apple.com`

**Current Vercel setting:** `APNS_ENVIRONMENT=production`

### 2. Token Format Issue

Live Activity push tokens are 160 hex characters (80 bytes), which is correct. However, APNs might expect them in a different format.

**Current implementation:** Token is sent as hex string in URL path: `/3/device/${pushToken}`

This matches standard APNs documentation, but Live Activities might have different requirements.

### 3. Token Validity

The token might be:
- Expired or invalid
- From a different app/bundle ID
- Not registered for Live Activities

Since OneSignal accepts the same token and it works, this is less likely.

### 4. Bundle ID/Topic Mismatch

Verify the `apns-topic` header matches exactly:
- Current: `com.gopetl.PETL.pushnotification.liveactivity`
- Should match the app's bundle ID + `.pushnotification.liveactivity`

## Recommended Next Steps

### Step 1: Check iOS App Environment

Check `PETL.entitlements` or `Info.plist`:
```xml
<key>aps-environment</key>
<string>development</string>  <!-- or "production" -->
```

### Step 2: Match APNs Environment

If the app uses `development`:
- Change `APNS_ENVIRONMENT` in Vercel to `development`
- Redeploy

If the app uses `production`:
- Keep `APNS_ENVIRONMENT=production` in Vercel
- Continue investigating other causes

### Step 3: Verify Key File

Double-check that the `APNS_KEY` value in Vercel:
- Has exactly 5 dashes: `-----BEGIN PRIVATE KEY-----`
- Has exactly 5 dashes: `-----END PRIVATE KEY-----`
- Contains the full key content (all 4 base64 lines)

### Step 4: Test with Different Token

If possible, try with a fresh Live Activity push token to rule out token expiration.

## Current Observations

- OneSignal updates work (device receives updates)
- Same token works with OneSignal but not direct APNs
- Key configuration is correct
- HTTP/2 and JWT authentication working

This suggests the issue is environment-specific or token format-related, not authentication.
