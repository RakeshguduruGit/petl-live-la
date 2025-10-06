export async function GET() {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  // Environment validation
  const hasAppId = !!appId;
  const hasRestKey = !!restKey;
  const appIdPrefix = appId?.substring(0, 8) || 'MISSING';
  const restKeyLength = restKey?.length || 0;

  // Configuration checks
  const config = {
    hasAppId,
    hasRestKey,
    appIdPrefix,
    restKeyLength,
    expectedAppIdPrefix: 'ebc50f5b', // From iOS logs
    appIdMatches: appIdPrefix === 'ebc50f5b',
    restKeyValidLength: restKeyLength > 20, // REST keys are typically longer
  };

  // Try a minimal OneSignal API call to validate credentials
  let oneSignalTest = null;
  if (hasAppId && hasRestKey) {
    try {
      const testUrl = `https://api.onesignal.com/apps/${appId}`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(restKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      oneSignalTest = {
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        error: response.ok ? null : await response.text().catch(() => 'Unknown error'),
      };
    } catch (error) {
      oneSignalTest = {
        status: 0,
        statusText: 'Network Error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  const result = {
    ok: hasAppId && hasRestKey && config.appIdMatches && config.restKeyValidLength,
    config,
    oneSignalTest,
    timestamp: new Date().toISOString(),
  };

  return Response.json(result, { 
    status: result.ok ? 200 : 500 
  });
}

export async function POST() {
  return Response.json({ 
    ok: false, 
    error: 'METHOD_NOT_ALLOWED' 
  }, { 
    status: 405,
    headers: { 'Allow': 'GET' }
  });
}
