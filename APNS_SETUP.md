# APNs Setup Guide

This guide explains how to set up direct Apple Push Notification Service (APNs) for Live Activity updates.

## Why Direct APNs?

OneSignal UPDATE events show "No Recipients" for locally-created Live Activities when the app is closed. Direct APNs bypasses OneSignal's API and sends updates directly to devices, which should work for locally-created activities.

## Prerequisites

1. **Apple Developer Account** - You need an active Apple Developer account
2. **App Bundle ID** - Your app's bundle ID (e.g., `com.gopetl.PETL`)
3. **Access to Apple Developer Portal** - To generate APNs authentication key

## Step 1: Generate APNs Authentication Key

1. Log in to [Apple Developer Account](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles** > **Keys**
3. Click the **"+"** button to create a new key
4. Enter a unique name (e.g., "PETL APNs Key")
5. Select the checkbox for **Apple Push Notifications service (APNs)**
6. Click **Continue**, then **Register**
7. **Download the .p8 file** - ⚠️ **You can only download this once!** Store it securely.
8. Note the **Key ID** (displayed in the Keys section)
9. Note your **Team ID** (found in the top-right corner of your Apple Developer account)

## Step 2: Configure Vercel Environment Variables

Add the following environment variables to your Vercel project:

1. **APNS_KEY_ID** - The Key ID from Step 1 (e.g., `ABC123XYZ`)
2. **APNS_TEAM_ID** - Your Team ID from Step 1 (e.g., `DEF456UVW`)
3. **APNS_KEY** - The contents of the .p8 file (see below for format)
4. **APNS_BUNDLE_ID** - Your app's bundle ID (e.g., `com.gopetl.PETL`)
5. **APNS_ENVIRONMENT** - `development` or `production` (default: `production`)

### APNS_KEY Format

The `APNS_KEY` environment variable should contain the contents of the .p8 file. You can:

**Option 1: Base64 Encode (Recommended)**
```bash
# Encode the .p8 file to base64
cat AuthKey_XXXXXXXXXX.p8 | base64
```
Then paste the base64 string into the `APNS_KEY` environment variable.

**Option 2: Raw PEM Format (Alternative)**
Copy the entire contents of the .p8 file (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines) and paste it directly into the `APNS_KEY` environment variable.

If using raw PEM format, ensure line breaks are preserved (Vercel environment variables support multiline values).

### Example .p8 File Contents
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
... (key content) ...
-----END PRIVATE KEY-----
```

## Step 3: Verify Configuration

After setting the environment variables:

1. Redeploy your Vercel project
2. Check Vercel logs for: `[APNs] Configuration loaded - Key ID: ..., Team ID: ..., Environment: ...`
3. If you see: `[APNs] Missing APNs credentials - direct APNs updates disabled`, check that all environment variables are set correctly

## Step 4: Test

1. Start a Live Activity on your iOS device
2. Wait for the cron job to run (every 3 minutes)
3. Check Vercel logs for:
   - `[Cron] 🍎 Attempting direct APNs update...`
   - `[Cron] ✅ Direct APNs update succeeded...`
4. Verify the Live Activity updates on your device

## Troubleshooting

### "APNs not configured - missing credentials"
- Check that all required environment variables are set in Vercel
- Ensure variable names are exact (case-sensitive)
- Redeploy after setting environment variables

### "Failed to sign JWT"
- Verify the .p8 file content is correct
- If using base64, ensure it's properly encoded
- Check that the key format is correct (should include PEM headers if raw)

### "APNs error: 403 - InvalidProviderToken"
- Verify Key ID is correct
- Verify Team ID is correct
- Check that the .p8 key is valid and not expired

### "APNs error: 400 - BadDeviceToken"
- Verify the push token is correct (160 hex characters)
- Check that the device token hasn't expired

### "APNs error: 400 - BadTopic"
- Verify the bundle ID matches your app's bundle ID
- Check that the bundle ID is correct (case-sensitive)

## Development vs Production

- **Development**: Uses `api.sandbox.push.apple.com`
  - Set `APNS_ENVIRONMENT=development`
  - Requires development build on device
  
- **Production**: Uses `api.push.apple.com`
  - Set `APNS_ENVIRONMENT=production` (default)
  - Works with TestFlight and App Store builds

## Security Notes

- ⚠️ **Never commit the .p8 file to version control**
- ⚠️ **Store the .p8 file securely** (you can only download it once)
- ⚠️ **Use Vercel environment variables** to store credentials securely
- ⚠️ **Rotate keys regularly** for security best practices

## Fallback Behavior

If direct APNs is not configured or fails, the cron job will:
1. Try direct APNs first (if configured)
2. Fall back to OneSignal API if APNs fails or is not configured
3. Log which method was used for each update

This ensures backward compatibility while allowing gradual migration to direct APNs.
