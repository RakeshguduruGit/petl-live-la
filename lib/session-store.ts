/**
 * Session Store for Live Activity State
 * 
 * Stores activity state so cron job can send direct Live Activity updates
 * without needing to wake the app via silent push.
 * 
 * Uses Vercel KV (Redis) for persistence across serverless function invocations.
 */

import { kv } from '@vercel/kv';

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

const KV_KEY_PREFIX = 'la:activity:';
const KV_INDEX_KEY = 'la:index'; // Set of all activity IDs

/**
 * Get KV key for an activity
 */
function getActivityKey(activityId: string): string {
  return `${KV_KEY_PREFIX}${activityId}`;
}

/**
 * Store activity with pushToken (called from START endpoint)
 */
export async function storeActivity(
  activityId: string,
  playerId: string,
  pushToken: string,
  state: ActivitySession['state']
): Promise<void> {
  try {
    const session: ActivitySession = {
      activityId,
      playerId,
      pushToken,
      state,
      lastUpdated: Date.now()
    };
    
    // Store the activity
    await kv.set(getActivityKey(activityId), session);
    
    // Add to index set
    await kv.sadd(KV_INDEX_KEY, activityId);
    
    console.log(`[SessionStore] ✅ Stored activity ${activityId.substring(0, 8)}... for player ${playerId.substring(0, 8)}... pushToken: ${pushToken.substring(0, 8)}...`);
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to store activity ${activityId.substring(0, 8)}...:`, error);
    throw error;
  }
}

/**
 * Store or update activity state (called from UPDATE endpoint)
 */
export async function storeActivityState(
  activityId: string,
  playerId: string,
  state: ActivitySession['state']
): Promise<void> {
  try {
    const existing = await kv.get<ActivitySession>(getActivityKey(activityId));
    if (existing) {
      // Update existing activity state
      existing.state = state;
      existing.lastUpdated = Date.now();
      await kv.set(getActivityKey(activityId), existing);
      console.log(`[SessionStore] ✅ Updated state for activityId=${activityId.substring(0, 8)}... soc=${state.soc}%`);
    } else {
      // Can't create without pushToken - should have been created by START
      console.warn(`[SessionStore] ⚠️ Activity ${activityId.substring(0, 8)}... not found - cannot store state without pushToken. It should have been created by START endpoint.`);
    }
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to update activity state ${activityId.substring(0, 8)}...:`, error);
    throw error;
  }
}

/**
 * Update activity state (alternative to storeActivityState)
 */
export async function updateActivityState(
  activityId: string,
  state: ActivitySession['state']
): Promise<boolean> {
  try {
    const existing = await kv.get<ActivitySession>(getActivityKey(activityId));
    if (existing) {
      existing.state = state;
      existing.lastUpdated = Date.now();
      await kv.set(getActivityKey(activityId), existing);
      console.log(`[SessionStore] ✅ Updated state for activityId=${activityId.substring(0, 8)}... soc=${state.soc}%`);
      return true;
    }
    console.warn(`[SessionStore] ⚠️ Activity ${activityId.substring(0, 8)}... not found for update`);
    return false;
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to update activity state ${activityId.substring(0, 8)}...:`, error);
    return false;
  }
}

/**
 * Get activity by activityId
 */
export async function getActivity(activityId: string): Promise<ActivitySession | null> {
  try {
    const session = await kv.get<ActivitySession>(getActivityKey(activityId));
    return session || null;
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to get activity ${activityId.substring(0, 8)}...:`, error);
    return null;
  }
}

/**
 * Remove activity from store (when ended)
 */
export async function removeActivity(activityId: string): Promise<void> {
  try {
    await kv.del(getActivityKey(activityId));
    await kv.srem(KV_INDEX_KEY, activityId);
    console.log(`[SessionStore] ✅ Removed activityId=${activityId.substring(0, 8)}...`);
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to remove activity ${activityId.substring(0, 8)}...:`, error);
    // Don't throw - removal failures are non-critical
  }
}

/**
 * Get all active activities (not stale)
 * Activities are considered stale if not updated in the last 15 minutes
 */
export async function getAllActiveActivities(staleThresholdMs: number = 15 * 60 * 1000): Promise<ActivitySession[]> {
  try {
    const now = Date.now();
    const index = await kv.smembers<string[]>(KV_INDEX_KEY) || [];
    
    console.log(`[SessionStore] Found ${index.length} activities in index`);
    
    const active: ActivitySession[] = [];
    for (const activityId of index) {
      const session = await kv.get<ActivitySession>(getActivityKey(activityId));
      if (session && (now - session.lastUpdated) < staleThresholdMs) {
        active.push(session);
      } else if (session && (now - session.lastUpdated) >= staleThresholdMs) {
        // Clean up stale activity
        console.log(`[SessionStore] 🧹 Cleaning up stale activity ${activityId.substring(0, 8)}... (age: ${Math.round((now - session.lastUpdated) / 1000)}s)`);
        await removeActivity(activityId);
      }
    }
    
    console.log(`[SessionStore] ✅ Found ${active.length} active activities (total: ${index.length} in index)`);
    return active;
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to get all active activities:`, error);
    // Return empty array on error to prevent cron job failures
    return [];
  }
}

/**
 * Clean up stale activities (older than threshold)
 */
export async function cleanupStaleActivities(staleThresholdMs: number = 10 * 60 * 1000): Promise<number> {
  try {
    const now = Date.now();
    const index = await kv.smembers<string[]>(KV_INDEX_KEY) || [];
    let removed = 0;
    
    for (const activityId of index) {
      const session = await kv.get<ActivitySession>(getActivityKey(activityId));
      if (session && now - session.lastUpdated >= staleThresholdMs) {
        await removeActivity(activityId);
        removed++;
      }
    }
    
    return removed;
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to cleanup stale activities:`, error);
    return 0;
  }
}

/**
 * Get store stats (for debugging)
 */
export async function getStoreStats() {
  try {
    const index = await kv.smembers<string[]>(KV_INDEX_KEY) || [];
    const activities = await Promise.all(
      index.map(async (activityId) => {
        const session = await kv.get<ActivitySession>(getActivityKey(activityId));
        if (!session) return null;
        return {
          activityId: session.activityId.substring(0, 8) + '...',
          lastUpdated: new Date(session.lastUpdated).toISOString(),
          ageMinutes: Math.round((Date.now() - session.lastUpdated) / 60000)
        };
      })
    );
    
    return {
      total: index.length,
      activities: activities.filter(a => a !== null)
    };
  } catch (error) {
    console.error(`[SessionStore] ❌ Failed to get store stats:`, error);
    return { total: 0, activities: [] };
  }
}
