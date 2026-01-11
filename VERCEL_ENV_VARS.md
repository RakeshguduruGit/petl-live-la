# Vercel Environment Variables for Direct APNs

Add these environment variables to your Vercel project:

## Required Variables:

### 1. APNS_KEY_ID
```
7SH93SA6Y7
```

### 2. APNS_TEAM_ID
```
MFBFYXVNCP
```

### 3. APNS_KEY
Copy the entire contents below (including BEGIN and END lines):
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg+R4yl10KeczuJYJH
aZ2QW/hXHX2XFDKXfabemOwt7gagCgYIKoZIzj0DAQehRANCAARh7QL4q/1FF3qC
DgPKFvCNPYM5Y8NDnEO6rAdpltzF7a81K6FW9Y7tytTb9j5yaUlZVBbn9yBkeh1o
lnfPFcXd
-----END PRIVATE KEY-----
```

### 4. APNS_BUNDLE_ID
```
com.gopetl.PETL
```

### 5. APNS_ENVIRONMENT (Optional)
```
production
```
(If not set, defaults to production)

## How to Add to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - **Key:** Enter the variable name (e.g., `APNS_KEY_ID`)
   - **Value:** Enter the value (e.g., `7SH93SA6Y7`)
   - **Environment:** Select "Production", "Preview", and "Development" (or just Production)
   - Click **Save**

4. For `APNS_KEY`:
   - Use the multiline value shown above
   - Vercel supports multiline environment variables
   - Make sure to include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines

5. After adding all variables:
   - **Redeploy** your project for the changes to take effect
   - You can trigger a redeploy from the Deployments page

## Verification:

After redeploying, check Vercel logs for:
- `[APNs] Configuration loaded - Key ID: 7SH93SA6..., Team ID: MFBFYXVN..., Environment: production`
- If you see: `[APNs] Missing APNs credentials - direct APNs updates disabled`, check that all variables are set correctly

## Testing:

Once configured, the cron job will:
1. Try direct APNs first (if configured)
2. Fall back to OneSignal API if APNs fails or is not configured
3. Log which method was used: `[Cron] 📊 Summary: X via direct APNs, Y via OneSignal API`
