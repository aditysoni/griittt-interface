// App-facing API for iOS Screen Time / FamilyControls authorization.
//
// Always reach for these helpers — never import the native module directly.
// On non-iOS platforms every call resolves to "unsupported" so screens don't
// have to repeat the Platform.OS check.
//
// State machine the UI cares about:
//   notDetermined → call requestAuthorization() → granted | denied
//   denied        → call openSettings() (we can't re-prompt programmatically)
//   granted       → you're set; downstream code (DeviceActivityReport etc.)
//                   can now run.
//   unsupported   → either not iOS or iOS < 16; hide the entry point.

import { Platform } from 'react-native';
import UsageAccess, { UsageAuthStatus } from '../modules/usage-access/src';

export type { UsageAuthStatus };

function isIOS(): boolean {
  return Platform.OS === 'ios';
}

export const usageAccess = {
  async getStatus(): Promise<UsageAuthStatus> {
    if (!isIOS()) return 'unsupported';
    try {
      return await UsageAccess.getAuthorizationStatus();
    } catch {
      // Module missing (e.g. running in Expo Go before prebuild) — treat as
      // unsupported so the UI can hide the gate gracefully.
      return 'unsupported';
    }
  },

  async request(): Promise<UsageAuthStatus> {
    if (!isIOS()) return 'unsupported';
    try {
      return await UsageAccess.requestAuthorization();
    } catch {
      // Most likely cause in production: entitlement missing or user-cancelled
      // sheet. We surface as "denied" so callers can offer Settings.app.
      return 'denied';
    }
  },

  async openSettings(): Promise<void> {
    if (!isIOS()) return;
    try {
      await UsageAccess.openSettings();
    } catch {
      // openSettings only fails if the OS refuses the URL — extremely rare.
      // No-op rather than crash the screen.
    }
  },
};
