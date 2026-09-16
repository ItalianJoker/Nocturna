/**
 * @fileoverview Haptic helpers respecting Nocturna's anti-leaking policy.
 *
 * Individual / role-targeted vibration is forbidden. Only the universal
 * village heartbeat (same pattern, every device) may fire — and only when
 * the room setting enables it (server already gates emission).
 */

export function vibrateUniversal(pattern: number[]): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when the tab is backgrounded — ignore.
  }
}
