# petl-live-la

OneSignal Live Activities API endpoints for iOS app integration.

## Setup

1. Deploy to Vercel by clicking the "Publish" button
2. Add environment variables in Vercel project settings:
   - `ONESIGNAL_APP_ID` - Your OneSignal App ID
   - `ONESIGNAL_REST_API_KEY` - Your OneSignal REST API Key

## API Endpoints

### POST /api/la/start
Start a new Live Activity session.

**Request Body:**
\`\`\`json
{
  "activityId": "unique-activity-id",
  "laPushToken": "device-push-token",
  "contentState": {
    "soc": 90,
    "watts": 7.8,
    "timeToFullMinutes": 14,
    "isCharging": true
  }
}
\`\`\`

### POST /api/la/update
Update an existing Live Activity with new content state.

**Request Body:**
\`\`\`json
{
  "activityId": "unique-activity-id",
  "contentState": {
    "soc": 85,
    "watts": 7.5,
    "timeToFullMinutes": 18,
    "isCharging": true
  }
}
\`\`\`

### POST /api/la/end
End a Live Activity session.

**Request Body:**
\`\`\`json
{
  "activityId": "unique-activity-id"
}
\`\`\`

## Deployment

After deployment, your endpoints will be available at:
- `https://petl-live-la.vercel.app/api/la/start`
- `https://petl-live-la.vercel.app/api/la/update`
- `https://petl-live-la.vercel.app/api/la/end`
