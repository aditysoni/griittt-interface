# Food and Physical insight cards

Food → Detailed now shows a go-to food card above Add Food, with a local photo or bundled food illustration, measured quantity in the past seven days and overall. When quantities were not recorded, it explicitly reports log frequency. Partial measured history is labelled measured. Most frequent food is chosen by overall log count, with weekly count and recency used only for ties; foods are grouped by canonical catalog ID/exact aliases, not vague name similarity. Overall stops at the selected day. No card is shown before there are food records.

Physical → Detailed shows an equivalent activity card and a Training balance card. The body is an actual local 3D coordinate mesh projected into native SVG, with depth ordering and lighting, drag rotation, front/back controls and selectable muscles. It uses existing packages and no remote viewer. Male/female/neutral are saved visual model preferences, not inferred gender. The user can choose directly in the body card. With no existing gender profile, Neutral is the initial model.

Darker green indicates a larger number of completed primary-muscle sets in the selected seven-day period. Cardio does not invent a strength muscle group; unrated/missing muscle groups are not guessed. Counts describe logs, not actual fitness, body composition or recovery. These are schematic low-poly mannequins, not clinical anatomy scans.

Backend endpoints: GET /api/tracking-insights/food and /physical with endDate=YYYY-MM-DD. Both require authentication and scope all records to the signed-in user. Body model preference uses PATCH /api/users/me {bodyModel:'male'|'female'|'neutral'}.

Deploy the matching backend branch before testing the new cards; older backends show a retry/unavailable state. Startup creates the profile preference and ensures body_part is available. Food amounts rely on the committed nutrition catalog changes from the preceding backend commit. No new native module is required. Reload the development app in Simulator after backend deployment.

Checks: iOS bundle export; all male/female/neutral model projections validated and rendered front/back/rotated; backend aggregation and authenticated database tests; frontend TypeScript has only the pre-existing lib/healthKit.ts missing sleep metric mappings. Actual native interaction still needs a Simulator/device smoke test.

Manual food saves now send the entered portion for server-side quantity tracking. Unchanged nutrition fields are omitted during edits so catalog estimates can recalculate for a changed portion. Existing device-only portion notes are not automatically uploaded or retroactively converted.

## Filament and the 30-day food diagram

Physical now uses react-native-filament 1.11.0 with react-native-worklets-core 1.6.3 and prepared CC0 MakeHuman GLBs, replacing the geometric SVG mannequin. Native iOS pods and asset extensions are configured. This change requires a new native iOS build; an OTA/Metro reload alone cannot add Filament to an older binary. Older builds show the static prepared body with an explicit rotation/build message, keeping logs and screens usable.

Food → Detailed adds Your food pattern: up to ten foods around the same body visual. Percentages mean the share of distinct recorded date + meal-slot combinations in the selected 30-day window. A duplicate food entry in the same meal counts once. Foods in the same meal can each count, so percentages may sum above 100%. Entries without meal slots are excluded and reported. This is explicitly not a measurement of body composition or organ effects. Quick answers lacking named food items are not included. Body imagery here is static for clarity and lower rendering cost.

The iOS runtime version is now 1.0.3 for this native dependency change (marketing version and build number are preserved). Publish any future iOS OTA only for the matching runtime/build; existing binaries cannot gain Filament through JavaScript updates alone.

## Static training illustrations (2026-11-20)

The Physical training card now uses bundled male/female front and back PNGs in `assets/body-illustrations`, replacing its live Filament viewer. Front/Back switches pictures; there is no drag-to-rotate interaction. Lime SVG regions follow these exact images and reflect actual weekly muscle sets. The muscle picker switches to the back image for back/triceps and front for the remaining groups. Image regions are illustrative, not individual anatomical measurements. No server or permission changes are needed.
