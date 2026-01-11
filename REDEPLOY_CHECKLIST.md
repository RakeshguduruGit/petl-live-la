# Redeploy Checklist - Direct APNs Setup

## ✅ Environment Variables Added
All 5 APNs environment variables have been added to Vercel:
- `APNS_KEY_ID` = `7SH93SA6Y7`
- `APNS_TEAM_ID` = `MFBFYXVNCP`
- `APNS_KEY` = (Added - verify full value)
- `APNS_BUNDLE_ID` = `com.gopetl.PETL`
- `APNS_ENVIRONMENT` = `production`

## ⚠️ Important: Verify APNS_KEY Format

The `APNS_KEY` value should include:
1. The `-----BEGIN PRIVATE KEY-----` line
2. The key content (multiple lines)
3. The `-----END PRIVATE KEY-----` line

If you see the value truncated in Vercel (e.g., "MIGTAGEAMBMGByqGSM49AgEGCCqGSM49..."), click on the variable to edit it and verify it has the complete value.

**Full APNS_KEY should look like:**
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg+R4yl10KeczuJYJH
aZ2QW/hXHX2XFDKXfabemOwt7gagCgYIKoZIzj0DAQehRANCAARh7QL4q/1FF3qC
DgPKFvCNPYM5Y8NDnEO6rAdpltzF7a81K6FW9Y7tytTb9j5yaUlZVBbn9yBkeh1o
lnfPFcXd
-----END PRIVATE KEY-----
```

## Steps to Redeploy:

### Option 1: Redeploy from Vercel Dashboard (Easiest)
1. Go to your Vercel project dashboard
2. Click on **"Deployments"** tab
3. Find the latest deployment
4. Click the **"..."** (three dots) menu
5. Click **"Redeploy"**
6. Confirm the redeploy

### Option 2: Trigger via Git (Automatic)
1. Make a small change to any file (or just add a comment)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Trigger redeploy for APNs configuration"
   git push
   ```
3. Vercel will automatically deploy

## After Redeploy:

1. **Check Logs** (in Vercel Dashboard → Logs tab):
   - Look for: `[APNs] Configuration loaded - Key ID: 7SH93SA6..., Team ID: MFBFYXVN..., Environment: production`
   - If you see: `[APNs] Missing APNs credentials`, the APNS_KEY might be incomplete

2. **Wait for Cron Job** (runs every 3 minutes):
   - Check logs for: `[Cron] 🍎 Attempting direct APNs update...`
   - Look for: `[Cron] ✅ Direct APNs update succeeded...`
   - Summary will show: `[Cron] 📊 Summary: X via direct APNs, Y via OneSignal API`

3. **Test Live Activity Updates**:
   - Start a Live Activity on your iOS device
   - Wait for the next cron job (3 minutes)
   - Check if the Live Activity updates on your device
   - Check Vercel logs to see if APNs was used

## Troubleshooting:

If APNs is not working:
1. Verify `APNS_KEY` has the full PEM format (BEGIN/END lines)
2. Check Vercel logs for error messages
3. Verify Key ID and Team ID are correct
4. Check that the key was created with "Sandbox & Production" enabled
