export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const restKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restKey) {
    return Response.json({ ok: false, error: 'Missing credentials' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${restKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        filters: [{ field: 'tag', key: 'charging', relation: '=', value: 'true' }],
        content_available: true,
        priority: 10,
        ttl: 180,
        data: { type: 'petl-bg-update', timestamp: new Date().toISOString() },
      }),
    });

    const result = await response.json();
    return Response.json({ ok: true, recipients: result.recipients || 0, id: result.id });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
