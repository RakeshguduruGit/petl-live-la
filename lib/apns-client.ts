/**
 * Direct APNs Client for Live Activity Updates
 * 
 * This module provides functionality to send Live Activity updates directly
 * via Apple Push Notification Service (APNs), bypassing OneSignal's API.
 * 
 * This is needed because OneSignal UPDATE events show "No Recipients" for
 * locally-created Live Activities when the app is closed.
 * 
 * Requirements:
 * - APNs Authentication Key (.p8 file content)
 * - Key ID from Apple Developer
 * - Team ID from Apple Developer
 * - Bundle ID
 * 
 * Environment Variables:
 * - APNS_KEY_ID: Key ID
 * - APNS_TEAM_ID: Team ID
 * - APNS_KEY: .p8 file content (base64 or raw string)
 * - APNS_BUNDLE_ID: Bundle ID (default: com.gopetl.PETL)
 * - APNS_ENVIRONMENT: 'development' or 'production' (default: production)
 */

import crypto from 'crypto';
import { SignJWT, importPKCS8 } from 'jose';

interface APNsConfig {
  keyId: string;
  teamId: string;
  key: string; // .p8 file content
  bundleId: string;
  environment: 'development' | 'production';
}

interface LiveActivityUpdatePayload {
  soc: number;
  watts: number;
  timeToFullMinutes: number;
  isCharging: boolean;
}

class APNsClient {
  private config: APNsConfig | null = null;
  private jwtToken: string | null = null;
  private jwtTokenExpiry: number = 0;
  private jwtTokenPromise: Promise<string> | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const key = process.env.APNS_KEY;
    const bundleId = process.env.APNS_BUNDLE_ID || 'com.gopetl.PETL';
    const environment = (process.env.APNS_ENVIRONMENT || 'production') as 'development' | 'production';

    if (!keyId || !teamId || !key) {
      console.warn('[APNs] Missing APNs credentials - direct APNs updates disabled');
      this.config = null;
      return;
    }

    this.config = {
      keyId,
      teamId,
      key, // Should be .p8 file content
      bundleId,
      environment
    };

    console.log(`[APNs] Configuration loaded - Key ID: ${keyId.substring(0, 8)}..., Team ID: ${teamId.substring(0, 8)}..., Environment: ${environment}`);
  }

  /**
   * Generate JWT token for APNs authentication
   * Tokens are valid for 1 hour and should be cached
   * 
   * Uses ES256 algorithm (ECDSA with SHA-256) for signing
   */
  private async generateJWT(): Promise<string> {
    if (!this.config) {
      throw new Error('APNs not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Reuse token if still valid (with 5 minute buffer)
    if (this.jwtToken && now < this.jwtTokenExpiry - 300) {
      return this.jwtToken;
    }
    
    // If there's already a pending token generation, reuse it
    if (this.jwtTokenPromise) {
      return this.jwtTokenPromise;
    }

    // Prepare private key (PEM format)
    let privateKey = this.config.key.trim();
    
    // Handle base64-encoded keys
    if (!privateKey.includes('-----BEGIN')) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
      } catch {
        // If decoding fails, assume it's already in the correct format
      }
    }
    
    // Ensure proper line breaks (handle both \n and \\n)
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // Verify PEM format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('[APNs] ❌ Private key missing PEM headers');
      throw new Error('Private key must be in PEM format with BEGIN PRIVATE KEY/END PRIVATE KEY headers');
    }
    
    // Fix missing newlines after BEGIN/END lines (common when pasted into Vercel)
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----\n')) {
      privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
    }
    if (!privateKey.includes('\n-----END PRIVATE KEY-----')) {
      privateKey = privateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
    }
    
    // Ensure key ends with newline
    if (!privateKey.endsWith('\n')) {
      privateKey += '\n';
    }

    // Create a promise for token generation (prevents concurrent calls)
    this.jwtTokenPromise = (async () => {
      try {
        // Import the private key using jose library (handles ES256 correctly)
        const key = await importPKCS8(privateKey, 'ES256');
        
        // Create JWT using jose library (handles ES256 signing correctly)
        const jwt = await new SignJWT({
          iss: this.config.teamId,
          iat: now
        })
          .setProtectedHeader({
            alg: 'ES256',
            kid: this.config.keyId
          })
          .setIssuedAt(now)
          .sign(key);

        // Cache token (valid for 1 hour)
        this.jwtToken = jwt;
        this.jwtTokenExpiry = now + 3600;
        this.jwtTokenPromise = null; // Clear promise cache

        return jwt;
      } catch (error) {
        this.jwtTokenPromise = null; // Clear promise cache on error
        console.error('[APNs] ❌ Error signing JWT:', error);
        console.error('[APNs] Key preview (first 100 chars):', privateKey.substring(0, 100).replace(/\n/g, '\\n'));
        throw new Error(`Failed to sign JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })();
    
    return this.jwtTokenPromise;
  }

  /**
   * Get APNs server URL based on environment
   */
  private getAPNsURL(): string {
    if (!this.config) {
      throw new Error('APNs not configured');
    }

    return this.config.environment === 'development'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  }

  /**
   * Send Live Activity update directly via APNs
   * 
   * @param pushToken - Live Activity push token (hex string, 160 chars)
   * @param payload - Update payload with state data
   * @returns Promise<{ success: boolean; responseId?: string; error?: string }>
   */
  async sendLiveActivityUpdate(
    pushToken: string,
    payload: LiveActivityUpdatePayload
  ): Promise<{ success: boolean; responseId?: string; error?: string }> {
    if (!this.config) {
      return {
        success: false,
        error: 'APNs not configured - missing credentials'
      };
    }

           try {
             const jwt = await this.generateJWT();
             const url = `${this.getAPNsURL()}/3/device/${pushToken}`;

      // APNs Live Activity payload format
      // Reference: https://developer.apple.com/documentation/activitykit/updating-live-activities-with-activitykit-push-notifications
      // The payload structure is: { "aps": { "timestamp": number, "event": "update", "content-state": {...} } }
      const apnsPayload = {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: 'update',
          'content-state': {
            soc: payload.soc,
            watts: payload.watts,
            timeToFullMinutes: payload.timeToFullMinutes,
            isCharging: payload.isCharging
          }
        }
      };

      console.log(`[APNs] Sending Live Activity update to token ${pushToken.substring(0, 8)}...`);
      console.log(`[APNs] URL: ${url}`);
      console.log(`[APNs] Payload:`, JSON.stringify(apnsPayload, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apns-topic': `${this.config.bundleId}.pushnotification.liveactivity`, // Live Activities topic format
          'apns-push-type': 'liveactivity',
          'apns-priority': '10',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apnsPayload)
      });

      if (response.ok) {
        const apnsId = response.headers.get('apns-id') || 'unknown';
        console.log(`[APNs] ✅ Live Activity update sent successfully - APNs ID: ${apnsId}`);
        return {
          success: true,
          responseId: apnsId
        };
      } else {
        const errorText = await response.text();
        console.error(`[APNs] ❌ Failed to send Live Activity update - Status: ${response.status}`);
        console.error(`[APNs] Error response: ${errorText}`);
        
        // Log response headers for debugging
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.error(`[APNs] Response headers:`, JSON.stringify(responseHeaders, null, 2));
        
        return {
          success: false,
          error: `APNs error: ${response.status} - ${errorText}`
        };
      }
    } catch (error) {
      console.error('[APNs] ❌ Exception sending Live Activity update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if APNs is configured and ready to use
   */
  isConfigured(): boolean {
    return this.config !== null;
  }
}

// Singleton instance
let apnsClient: APNsClient | null = null;

export function getAPNsClient(): APNsClient {
  if (!apnsClient) {
    apnsClient = new APNsClient();
  }
  return apnsClient;
}

export type { LiveActivityUpdatePayload };
