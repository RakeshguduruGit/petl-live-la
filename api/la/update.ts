import type { NextApiRequest, NextApiResponse } from 'next';
import { callOneSignal, methodGuard } from '../../lib/onesignal';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guard = methodGuard(req.method || 'GET', ['POST']);
  if (!guard.isAllowed) {
    res.setHeader('Allow', guard.allowHeader);
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const incoming = (typeof req.body === 'object' && req.body) ? req.body : {};
  
  // Include only the fields your iOS client sends/needs
  const payload = {
    action: 'update',
    activityId: incoming.activityId ?? null,
    state: incoming.contentState ?? null,
    event: "update",
    dismissal_date: Math.floor(Date.now() / 1000) + 120, // Rolling 2-minute TTL
    event_updates: {
      "content-state": incoming.contentState || {
        soc: 85,
        watts: 7.5,
        timeToFullMinutes: 18,
        isCharging: true,
      },
    },
  };

  const result = await callOneSignal('update', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  return res.status(status).json(result);
}