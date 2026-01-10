/**
 * Session Store for Live Activity State
 * 
 * Stores activity state so cron job can send direct Live Activity updates
 * without needing to wake the app via silent push.
 */

export interface ActivitySession {
  activityId: string;
  playerId: string;
  pushToken: string;  // CRITICAL: Required for OneSignal Live Activity updates
  state: {
    soc: number;
    watts: number;
    timeToFullMinutes: number;
    isCharging: boolean;
  };
  lastUpdated: number; // timestamp in milliseconds
}

// In-memory store (use Vercel KV/Redis for production with multiple instances)
const sessions = new Map<string, ActivitySession>();

/**
 * Store activity with pushToken (called from START endpoint)
 */
export function storeActivity(
  activityId: string,
  playerId: string,
  pushToken: string,
  state: ActivitySession['state']
): void {
  sessions.set(activityId, {
    activityId,
    playerId,
    pushToken,
    state,
    lastUpdated: Date.now()
  });
  console.log(`[SessionStore] Stored activity ${activityId.substring(0, 8)}... for player ${playerId.substring(0, 8)}... pushToken: ${pushToken.substring(0, 8)}...`);
}

/**
 * Store or update activity state (called from UPDATE endpoint)
 */
export function storeActivityState(
  activityId: string,
  playerId: string,
  state: ActivitySession['state']
): void {
  const existing = sessions.get(activityId);
  if (existing) {
    // Update existing activity state
    existing.state = state;
    existing.lastUpdated = Date.now();
    console.log(`[SessionStore] Updated state for activityId=${activityId.substring(0, 8)}... soc=${state.soc}%`);
  } else {
    // Can't create without pushToken - should have been created by START
    console.warn(`[SessionStore] Activity ${activityId.substring(0, 8)}... not found - cannot store state without pushToken. It should have been created by START endpoint.`);
  }
}

/**
 * Update activity state (alternative to storeActivityState)
 */
export function updateActivityState(
  activityId: string,
  state: ActivitySession['state']
): boolean {
  const existing = sessions.get(activityId);
  if (existing) {
    existing.state = state;
    existing.lastUpdated = Date.now();
    console.log(`[SessionStore] Updated state for activityId=${activityId.substring(0, 8)}... soc=${state.soc}%`);
    return true;
  }
  console.warn(`[SessionStore] Activity ${activityId.substring(0, 8)}... not found for update`);
  return false;
}

/**
 * Get activity by activityId
 */
export function getActivity(activityId: string): ActivitySession | null {
  return sessions.get(activityId) || null;
}


/**
 * Remove activity from store (when ended)
 */
export function removeActivity(activityId: string): void {
  const removed = sessions.delete(activityId);
  if (removed) {
    console.log(`[SessionStore] Removed activityId=${activityId.substring(0, 8)}...`);
  }
}

/**
 * Get all active activities (not stale)
 * Activities are considered stale if not updated in the last 15 minutes
 */
export function getAllActiveActivities(staleThresholdMs: number = 15 * 60 * 1000): ActivitySession[] {
  const now = Date.now();
  const active = Array.from(sessions.values()).filter(
    session => (now - session.lastUpdated) < staleThresholdMs
  );
  console.log(`[SessionStore] Found ${active.length} active activities (total: ${sessions.size} stored)`);
  return active;
}

/**
 * Clean up stale activities (older than threshold)
 */
export function cleanupStaleActivities(staleThresholdMs: number = 10 * 60 * 1000): number {
  const now = Date.now();
  let removed = 0;
  
  for (const [activityId, session] of sessions.entries()) {
    if (now - session.lastUpdated >= staleThresholdMs) {
      sessions.delete(activityId);
      removed++;
      console.log(`[SessionStore] Cleaned up stale activityId=${activityId.substring(0, 8)}...`);
    }
  }
  
  return removed;
}

/**
 * Get store stats (for debugging)
 */
export function getStoreStats() {
  return {
    total: sessions.size,
    activities: Array.from(sessions.values()).map(s => ({
      activityId: s.activityId.substring(0, 8) + '...',
      lastUpdated: new Date(s.lastUpdated).toISOString(),
      ageMinutes: Math.round((Date.now() - s.lastUpdated) / 60000)
    }))
  };
}

