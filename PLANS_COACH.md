# Plans and coach integration

Open AI Coach → Talk to your coach / Your plans. Ask GRITTT's Open AI Coach entry now opens the persistent coach. Coach also has a My plans button.

Implemented: saved coach conversations/history/deletion; daily-limit and unavailable-server states; reviewed plan offers; goal/advice intake; multiple-choice questions; editable draft action names/removal and duration; explicit plan start; action logging with selected local today; one-time steps; pause/resume/end; checkpoints; earned level-up; advice import with duplicate filtering and explicit apply; completion with retained habits. Reviewed actions are never saved automatically from a coach reply.

The API clients use the same EXPO_PUBLIC_API_BASE as the rest of the app and include authentication, local calendar dates, request timeouts and safe errors. Request debug output no longer prints authentication headers or message bodies. Onboarding Mirror responses support both old and new backend field names while retaining the original payload for persistence.

Validation: iOS Expo export passes. Backend route tests and the actual mobile-client contract test pass against a disposable local PostgreSQL database. Full frontend TypeScript still reports the pre-existing missing sleep metric mappings in lib/healthKit.ts; no new integration type errors. Computer control failed to connect to Simulator, so native visual/device acceptance and live AI responses remain unverified.

Plans and text coach add no native modules or iPhone permission prompts. A development build can load this JavaScript through Metro. For an installed production/preview app, use its existing matching update channel or ship a new signed build. Voice logging requires a native binary containing expo-audio and the microphone permission description; it requests mic access only after the voice disclosure action. EAS profiles already set the API to https://grittt.online.

Production backend must expose /api/plans and /api/coach. Food/workout voice additionally needs /api/voice, its feature flag and a valid provider key. Merge/release the frontend integration as well as the combined backend. No OTA update, TestFlight upload or production deployment was performed by this integration.
