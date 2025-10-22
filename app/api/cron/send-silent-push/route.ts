export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const restKey = process.env.ONESIGNAL_REST_API_KEY?.trim();

  if (!appId || !restKey) {
    return Response.json({ ok: false, error: 'Missing credentials' }, { status: 500 });
  }

  console.log(`[Cron] Using App ID: ${appId.substring(0, 8)}... (length: ${appId.length})`);
  console.log(`[Cron] Using REST Key: ${restKey.substring(0, 15)}... (length: ${restKey.length})`);

  const payload = {
    app_id: appId,
    filters: [{ field: 'tag', key: 'charging', relation: '=', value: 'true' }],
    content_available: true,
    priority: 10,
    ttl: 180,
    data: { type: 'petl-bg-update', timestamp: new Date().toISOString() },
  };

  console.log('[Cron] Sending silent push with payload:', JSON.stringify(payload));

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${restKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    console.log('[Cron] OneSignal response:', JSON.stringify(result));
    
    if (!response.ok) {
      console.error('[Cron] OneSignal error:', result);
      return Response.json({ ok: false, error: 'OneSignal error', details: result }, { status: response.status });
    }

    // For silent pushes, OneSignal doesn't return recipients count
    // If we get an ID and no errors, the push was sent successfully
    const hasId = result.id && result.id !== '';
    const hasErrors = result.errors && result.errors.length > 0;
    
    if (hasId && !hasErrors) {
      console.log(`[Cron] ✅ Silent push sent successfully! ID: ${result.id}`);
      return Response.json({ ok: true, recipients: 'sent', id: result.id, message: 'Silent push sent to tagged devices' });
    } else {
      console.log(`[Cron] ❌ Silent push failed. ID: ${result.id || 'none'}, Errors: ${JSON.stringify(result.errors || [])}`);
      return Response.json({ ok: false, error: 'Push failed', details: result }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Cron] Fetch error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
