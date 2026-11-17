# Food daily questions

The Food screen now starts with one seven-day check-in card. It distinguishes recorded check-ins from missing entries and does not interpret missing days as poor nutrition. A compact date navigator replaces the large date ribbon.

The two primary questions are intake and food quality. Intake has four descriptive choices: Less than usual / About usual / More than usual / Not sure. Quality reuses the real catalog question and its existing options, IDs, history and scoring; no old option indices are remapped. Selected custom questions follow, with Add question always accessible. Other previously selected preset questions remain in a collapsed More food questions section.

Every question has a 44pt chart control in its top-right corner. Intake shows 7/28-day response distributions with actual dated entries; its categories are not ranked or scored. Catalog/custom questions reuse the existing history endpoint and open its graph tab directly. Failed history loads show retry, not a misleading empty chart.

One Save answers action commits the changed answers. Question answers use existing server upserts; intake uses a new per-user/per-date AsyncStorage key. Intake is device-only, clearly identified in the UI. The server currently has no compatible four-category intake field. A future authenticated intake endpoint must accept {date, answer: less|usual|more|unsure, updatedAt} and return scoped dated history. Do not translate this field into the old difficult/mixed/well check-in or the numeric nutrition score. No database migrations or backend changes are included.

Existing meals, nutrition entry, photo estimation and legacy three-option check-ins remain accessible in Food items & previous records. Existing stored data is not deleted or migrated.

Unsaved answers are keyed by date; stale fetches are ignored; saves are disabled while the selected date is loading. Intake is persisted before a successful local confirmation is shown. When a combined save partially succeeds, explain the result and preserve retryable input.
