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
    action: 'start',
    activityId: incoming.activityId ?? null,
    laPushTokenHex: incoming.laPushToken ?? null,
    state: incoming.contentState ?? null,
    name: "petl-session",
    event: "start",
    event_updates: {
      "content-state": incoming.contentState || {
        soc: 90,
        watts: 7.8,
        timeToFullMinutes: 14,
        isCharging: true,
      },
    },
  };

  const result = await callOneSignal('start', payload);
  const status = result.status ?? (result.ok ? 200 : 500);
  return res.status(status).json(result);
}
