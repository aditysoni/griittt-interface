# Food: Quick submission and Detailed

Quick submission retains daily intake/quality/custom questions and their charts. Detailed adds a single reviewable food-entry sheet, optional photo, portion note, meal, and optional calories/protein/carbs/fat/fibre. Blank nutrition is unknown; explicit zero is retained. Photo estimation is an explicit, cancellable request and never auto-saves an entry.

The summary card remains shared across Quick and Detailed, with Weekly habit / Most logged available in both. Habits-style mode tabs sit below the card. Most logged unlocks when the existing monthly analysis endpoint returns actual food entries. It displays monthly entry frequency and days eaten, not portion volume. Quick drafts survive mode changes.

Food names and nutrition sync through existing food APIs. Photos and portion notes are device-local, scoped by signed-in user and food ID; photos are copied from temporary picker storage to document storage. Cross-device photos/portion notes require backend attachment fields and upload support.

Validation: iOS offline Expo export passed; verify-food-details.cjs passed (optional nutrition, zero, decimals, invalid values, numeric-string API totals, coverage, per-user metadata, failed-write photo rollback, deletion). Full tsc reports only pre-existing lib/healthKit.ts missing sleep identifiers. Simulator verification passed: both mode tabs, Detailed-only summary controls, locked Most logged behavior, Add food sheet, all five labeled nutrition fields, disabled empty Save, and close/return navigation. Photo upload/AI estimation and populated rankings were not exercised against the user account. No sample entries were saved into the user's history.
