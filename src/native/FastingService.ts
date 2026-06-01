/**
 * TypeScript façade for the native Android fasting foreground service.
 *
 * ANDROID-ONLY. On iOS/web (and in jest, where Platform.OS is not 'android'),
 * every call is a no-op, and the native module is never required — so the app
 * never crashes where the service doesn't exist (e.g. before a dev-client build).
 *
 * The service is best-effort: a fast's correctness is derived from
 * session.startTime in JS, so a missing/failed service only affects the
 * ongoing notification, never the timer.
 */

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

import { FastingServiceConfig } from './FastingService.types';

interface NativeFastingService {
  start(startTimeMillis: number, goalTimeMillis: number, planName: string): void;
  update(startTimeMillis: number, goalTimeMillis: number, planName: string): void;
  stop(): void;
}

// undefined = not yet resolved; null = unavailable (resolution failed / wrong platform).
let cached: NativeFastingService | null | undefined;

function getNative(): NativeFastingService | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (cached === undefined) {
    try {
      cached = requireNativeModule('FastingService') as unknown as NativeFastingService;
    } catch {
      cached = null;
    }
  }
  return cached ?? null;
}

/** Starts (or restarts) the ongoing fasting notification + foreground service. */
export function startFastingService(config: FastingServiceConfig): void {
  getNative()?.start(config.startTimeMillis, config.goalTimeMillis, config.planName);
}

/** Re-establishes the notification for an in-progress fast (recomputes phase). */
export function updateFastingService(config: FastingServiceConfig): void {
  getNative()?.update(config.startTimeMillis, config.goalTimeMillis, config.planName);
}

/** Stops the service and removes the ongoing notification. */
export function stopFastingService(): void {
  getNative()?.stop();
}
