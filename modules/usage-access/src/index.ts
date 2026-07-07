// Native bridge to the Swift UsageAccessModule.
//
// Don't import this directly from app screens — go through lib/usageAccess.ts,
// which adds platform guards (this whole module is iOS-only) and friendlier
// types. The native module is registered under the name "UsageAccess".

import { requireNativeModule } from 'expo-modules-core';

export type UsageAuthStatus = 'notDetermined' | 'granted' | 'denied' | 'unsupported';

type NativeUsageAccess = {
  getAuthorizationStatus(): Promise<UsageAuthStatus>;
  requestAuthorization(): Promise<UsageAuthStatus>;
  openSettings(): Promise<void>;
};

const Native = requireNativeModule<NativeUsageAccess>('UsageAccess');

export default Native;
