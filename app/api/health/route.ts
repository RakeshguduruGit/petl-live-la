// Health check endpoint for monitoring system status
// Use this for Vercel Analytics, UptimeRobot, or internal dashboards

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'petl-live-activity-api',
      performance: {
        responseTimeMs: Date.now() - startTime,
      },
      version: '1.0.0',
    };
    
    return Response.json(health, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return Response.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
