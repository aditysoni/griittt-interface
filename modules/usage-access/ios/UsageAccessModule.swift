import ExpoModulesCore
import FamilyControls

/// Bridges Apple's `FamilyControls.AuthorizationCenter` to JS.
///
/// Auth flow (iOS 16+):
/// 1. Call `getAuthorizationStatus()` to read the current state.
/// 2. If `notDetermined`, call `requestAuthorization()` — Apple shows the
///    system "Allow Screen Time access?" sheet. Returns the new status.
/// 3. If `denied`, the only recourse is sending the user to Settings.app —
///    we expose `openSettings()` for that.
///
/// What this DOES NOT do (intentionally):
///   - Read app names or per-app usage minutes. Apple does not expose that
///     to third-party app code. Use `DeviceActivityReport` (SwiftUI view)
///     or a `DeviceActivityMonitor` extension downstream for actual data.
///
/// Entitlement required:
///   `com.apple.developer.family-controls` — Apple approves case-by-case
///   via the developer portal. Without it, requestAuthorization() throws.
public class UsageAccessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UsageAccess")

    // Reports current OS authorization status without prompting the user.
    AsyncFunction("getAuthorizationStatus") { () -> String in
      if #available(iOS 16.0, *) {
        return Self.statusString(AuthorizationCenter.shared.authorizationStatus)
      }
      return "unsupported"
    }

    // Prompts the user via Apple's system sheet. Resolves with the resulting
    // status. Safe to call when already granted — Apple no-ops in that case.
    AsyncFunction("requestAuthorization") { () async throws -> String in
      guard #available(iOS 16.0, *) else {
        return "unsupported"
      }
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        return Self.statusString(AuthorizationCenter.shared.authorizationStatus)
      } catch {
        // FamilyControls.AuthorizationError cases — most importantly
        // .invalidAccountType (no iCloud), .networkError, .authorizationCanceled,
        // and entitlement-missing errors. Surface as a JS error.
        throw Exception(name: "USAGE_ACCESS_REQUEST_FAILED", description: error.localizedDescription)
      }
    }

    // Pushes the user to Settings.app so they can flip a previously-denied
    // grant. Apple does not let us re-prompt programmatically once denied.
    AsyncFunction("openSettings") { () async throws in
      await MainActor.run {
        if let url = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(url)
        }
      }
    }
  }

  // MARK: - Helpers

  @available(iOS 16.0, *)
  private static func statusString(_ s: AuthorizationStatus) -> String {
    switch s {
    case .notDetermined: return "notDetermined"
    case .approved:      return "granted"
    case .denied:        return "denied"
    @unknown default:    return "denied"
    }
  }
}
