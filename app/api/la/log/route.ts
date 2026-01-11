// Next.js App Router API Route: iOS App Logging Endpoint
// Receives log messages from iOS app and logs them to Vercel logs
// This allows viewing iOS app logs without having Xcode open

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Security: Verify request has valid secret
  const secret = request.headers.get('x-petl-secret');
  const expectedSecret = process.env.PETL_SERVER_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      level = 'info',      // 'info', 'warning', 'error', 'debug'
      message,             // Log message
      category,            // Optional category (e.g., 'LiveActivity', 'OneSignal', 'Battery')
      metadata,            // Optional additional data
      timestamp,           // Optional timestamp from iOS
      activityId,          // Optional activity ID for context
      playerId             // Optional player ID for context
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // Build log prefix with metadata
    let prefix = '[iOS]';
    if (category) prefix += ` [${category}]`;
    if (activityId) prefix += ` [LA:${activityId.substring(0, 8)}...]`;
    if (playerId) prefix += ` [Player:${playerId.substring(0, 8)}...]`;

    // Format log message
    const logMessage = `${prefix} ${message}`;
    
    // Log additional metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      console.log(`${logMessage}`, JSON.stringify(metadata, null, 2));
    } else {
      console.log(logMessage);
    }

    // Use appropriate log level (Vercel logs all go to console.log, but we can prefix for clarity)
    switch (level) {
      case 'error':
        console.error(`${logMessage}${metadata ? ` ${JSON.stringify(metadata)}` : ''}`);
        break;
      case 'warning':
        console.warn(`${logMessage}${metadata ? ` ${JSON.stringify(metadata)}` : ''}`);
        break;
      case 'debug':
        // Debug logs still go to console.log in Vercel
        console.log(`[DEBUG] ${logMessage}${metadata ? ` ${JSON.stringify(metadata)}` : ''}`);
        break;
      default:
        console.log(logMessage);
    }

    return NextResponse.json({
      success: true,
      logged: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[iOS] [LOG] Error processing log request:', error);
    return NextResponse.json(
      { error: 'Failed to process log', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
