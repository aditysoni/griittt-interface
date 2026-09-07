# Architecture diagrams

Excalidraw scenes describing the Grittt app + server. Generated from
[generate.mjs](generate.mjs) — a declarative spec of boxes, zones and arrows —
so they stay regenerable rather than becoming stale hand-drawn JSON.

| File | What it shows |
| --- | --- |
| [01-system-architecture.excalidraw](01-system-architecture.excalidraw) | End-to-end: Expo client → Express API → Postgres, plus HealthKit, Screen Time, OpenAI, Google/Apple auth, EAS OTA |
| [02-feature-map.excalidraw](02-feature-map.excalidraw) | Every screen in `app/` (auth group, tabs, stack screens) and what it does |
| [03-api-surface.excalidraw](03-api-surface.excalidraw) | All 13 route modules with their endpoints → services → tables |
| [04-auth-flows.excalidraw](04-auth-flows.excalidraw) | The three sign-in paths (email, Google mobile poll, Apple) converging on one JWT |
| [05-data-model.excalidraw](05-data-model.excalidraw) | The 14 Postgres tables and how they hang off `users` |

## Opening them

- **Browser** — <https://excalidraw.com>, then File → Open (or just drag the file in).
- **VS Code** — install the `pomdtr.excalidraw-editor` extension; `.excalidraw`
  files then open in the editor directly, with normal git diffs.

## Regenerating

```sh
node docs/diagrams/generate.mjs
```

Output is deterministic (no `Math.random`, no timestamps), so re-running with an
unchanged spec produces byte-identical files and an empty git diff.

## Editing

Two ways, pick one per diagram:

1. **Edit the spec** in `generate.mjs` and regenerate — best for structural
   changes that should survive future updates.
2. **Edit the scene by hand** in Excalidraw and stop regenerating that file —
   regenerating overwrites it. If you do this, fold the change back into the
   spec when convenient.

The layout in `generate.mjs` is explicit coordinates, not auto-layout. The
helpers are `box()`, `stack()`, `zone()`, `arrow()` and `heading()`; arrows bind
to element ids and pick their own edge anchors, so nudging a box in the spec
keeps its arrows attached.

## Keeping them honest

These are hand-authored from the code as of the `ios` branch, not derived at
build time. When you add a route module in `src/index.ts`, a screen under
`app/`, or a table in `src/db/migrate*.ts`, update the matching spec section:

- routes → `apiSurface()`
- screens → `featureMap()`
- tables → `dataModel()` and the `pg` box in `systemArchitecture()`
