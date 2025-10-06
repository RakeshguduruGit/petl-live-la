export async function POST() {
  return Response.json({ ok: true, message: 'Test endpoint working' });
}

export async function GET() {
  return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
    status: 405,
    headers: { 'Allow': 'POST' },
  });
}
