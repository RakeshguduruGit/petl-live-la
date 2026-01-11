# APNs Keys Verification

## Expected Values:

### 1. APNS_KEY_ID
**Expected:** `G32XLR8935`
- Source: Apple Developer Portal - Key "PETLOneSignalKey2025"
- Format: 10 characters (alphanumeric)
- Status: ✅ Matches Apple Developer portal

### 2. APNS_TEAM_ID
**Expected:** `MFBFYXVNCP`
- Source: From Apple Developer portal header: "GOPETL, LLC - MFBFYXVNCP"
- Format: 10 characters (uppercase letters/numbers)
- Status: ✅ Matches Apple Developer portal

### 3. APNS_KEY
**Expected Format:** Full PEM format with BEGIN/END lines
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg+R4yl10KeczuJYJH
aZ2QW/hXHX2XFDKXfabemOwt7gagCgYIKoZIzj0DAQehRANCAARh7QL4q/1FF3qC
DgPKFvCNPYM5Y8NDnEO6rAdpltzF7a81K6FW9Y7tytTb9j5yaUlZVBbn9yBkeh1o
lnfPFcXd
-----END PRIVATE KEY-----
```
- Source: Download from Apple Developer Portal - Key "PETLOneSignalKey2025" (ID: G32XLR8935)
- Format: PEM format (includes BEGIN/END lines)
- Length: 6 lines total (1 BEGIN, 4 content lines, 1 END)
- Status: ⚠️ Verify in Vercel that full value is present (not truncated)

### 4. APNS_BUNDLE_ID
**Expected:** `com.gopetl.PETL`
- Source: Standard bundle ID for PETL app
- Format: Reverse domain notation
- Status: ✅ Standard value

### 5. APNS_ENVIRONMENT
**Expected:** `production` (optional, defaults to production)
- Source: Key configured with "Sandbox & Production" in Apple Developer
- Format: `production` or `development`
- Status: ✅ Should use production

## Verification Steps:

1. **Check in Vercel Dashboard:**
   - Go to Settings → Environment Variables
   - Click on each variable to view/edit
   - Verify values match expected values above

2. **Critical Check - APNS_KEY:**
   - Click on `APNS_KEY` variable
   - Edit to view full value
   - Must include:
     - `-----BEGIN PRIVATE KEY-----` (first line)
     - `-----END PRIVATE KEY-----` (last line)
     - All content lines in between
   - If truncated, re-enter the full value

3. **After Deployment - Check Logs:**
   - Look for: `[APNs] Configuration loaded - Key ID: G32XLR89..., Team ID: MFBFYXVN..., Environment: production`
   - This confirms all variables are correctly loaded

## Quick Verification Commands:

You can verify the .p8 file locally:
```bash
# After downloading the key from Apple Developer Portal, check:
ls -la ~/Downloads/AuthKey_G32XLR8935.p8

# View file (first and last lines)
head -1 ~/Downloads/AuthKey_G32XLR8935.p8
tail -1 ~/Downloads/AuthKey_G32XLR8935.p8

# Count lines (should be 6 or more)
wc -l ~/Downloads/AuthKey_G32XLR8935.p8
```
