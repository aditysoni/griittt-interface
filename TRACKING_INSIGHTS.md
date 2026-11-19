# Food and Physical insight cards

Food → Detailed now shows a go-to food card above Add Food, with a local photo or bundled food illustration, measured quantity in the past seven days and overall. When quantities were not recorded, it explicitly reports log frequency. Partial measured history is labelled measured. Most frequent food is chosen by weekly log count, then overall count; foods are grouped by canonical catalog ID/exact aliases, not vague name similarity. Overall stops at the selected day. No card is shown before there are food records.

Physical → Detailed shows an equivalent activity card and a Training balance card. The body is an actual local 3D coordinate mesh projected into native SVG, with depth ordering and lighting, drag rotation, front/back controls and selectable muscles. It uses existing packages and no remote viewer. Male/female/neutral are saved visual model preferences, not inferred gender. The user can choose directly in the body card. With no existing gender profile, Neutral is the initial model.

Darker green indicates a larger number of completed primary-muscle sets in the selected seven-day period. Cardio does not invent a strength muscle group; unrated/missing muscle groups are not guessed. Counts describe logs, not actual fitness, body composition or recovery. These are schematic low-poly mannequins, not clinical anatomy scans.

Backend endpoints: GET /api/tracking-insights/food and /physical with endDate=YYYY-MM-DD. Both require authentication and scope all records to the signed-in user. Body model preference uses PATCH /api/users/me {bodyModel:'male'|'female'|'neutral'}.

Deploy the matching backend branch before testing the new cards; older backends show a retry/unavailable state. Startup creates the profile preference and ensures body_part is available. Food amounts rely on the committed nutrition catalog changes from the preceding backend commit. No new native module is required. Reload the development app in Simulator after backend deployment.

Checks: iOS bundle export; all male/female/neutral model projections validated and rendered front/back/rotated; backend aggregation and authenticated database tests; frontend TypeScript has only the pre-existing lib/healthKit.ts missing sleep metric mappings. Actual native interaction still needs a Simulator/device smoke test.
