# CLAUDE.md — drawing-selector

Developer context for AI-assisted work on this project.

## Commands

```sh
npm run dev          # Vite dev server with hot reload
npm run build        # production build (emits sw.js + manifest.webmanifest)
npm run build:portable # single-file Offline Edition → dist-portable/index.html
npm test             # Vitest run-once
npm run test:watch   # Vitest watch mode
```

Always run `npm test` before committing. The suite is fast (~3 s).

## Architecture

### State — `src/stores/participants.js`

Single Pinia store. All localStorage writes go through `persistCandidates()` /
`persistWinners()`. The drawing animation is a recursive `setTimeout` loop that
starts fast and slows by incrementing `delay` — do not replace with
`setInterval` (the interval is not fixed).

The reveal length is configurable via `settings.drawTiming`
(`{ mode: 'fixed' | 'random' | 'manual', fixedMs, minMs, maxMs }`).
`resolveDrawDuration()` ([utils/drawTiming.js](src/utils/drawTiming.js)) turns it
into a concrete duration (or `Infinity` for `manual`) **on the drawing screen**,
which is threaded into `runSpinAnimation({ durationMs })` (classic loop) and the
wheel components' `durationMs` prop. The classic loop treats `durationMs` as the
*total*, subtracting the deceleration tail (`decelTailMs`) so the fast phase plus
slow-down lands near it. In `manual` mode the spin free-runs until the operator
presses Stop on the admin window (HomeView), which posts a `{ type: 'stop' }`
channel message → `store.requestManualStop()` + the wheels' `stopRequested` prop.

Key actions:
| Action | Effect |
|---|---|
| `importParticipants(list, mode = 'replace')` | `'replace'` swaps the pool; `'append'` adds to it. Always skips prior winners (and, when appending, in-pool dups) by key |
| `addCandidate(fields)` | Appends one participant `{ id, fields }` with a generated id |
| `updateCandidate(id, { fields })` | Merges a field patch into the participant |
| `removeCandidate(id)` | Splices by id |
| `commitSelection()` | Copies winner (deep-copies `fields`), splices from pool |
| `importState({ candidates, winners })` | Full restore from JSON backup |
| `resetCandidates()` / `resetWinners()` | Clear lists and localStorage |

### CSV parsing & column mapping — `src/utils/csv.js`

CSV import is interactive: the user maps each column to a role in
`CsvMappingDialog.vue` before anything is imported. The flow is
`parseCsv` → dialog (`suggestMapping`) → `normalizeWithMapping` →
`store.importParticipants`.
- `parseCsv(text)` → `{ headers, rows }` — handles quoted fields, escaped `""`,
  CRLF/CR/LF
- `suggestMapping(headers)` → `[{ key, role, label, include }]` — alias-based
  defaults (`role: 'name'` for first/last/single-name columns, else `'detail'`)
  to pre-fill the dialog
- `normalizeWithMapping(rows, mapping)` → `Participant[]` — builds the generic
  `{ id, fields }` shape; the custom `label` becomes the field key; skips rows
  whose name-role values are all empty
- `participantKey(p)` — stable de-dup key (sorted `key=value` over all fields,
  lowercased)
- `migrateParticipant(p)` / `migrateParticipants(list)` — idempotently convert
  legacy `{ firstName, lastName, extras }` records to `{ id, fields }`. Run on
  `loadFromStorage` and `deserializeState`
- `uid()` — exported; used by the store for `addCandidate`

### Export helpers — `src/utils/export.js`

Three exported functions; all pure except for the `triggerDownload` side-effect:
- `downloadWinnersCsv(winners)` — returns `false` when empty; unions extra keys
  across all winners
- `exportStateJson(candidates, winners)` — full JSON state dump
- `deserializeState(json)` — validates shape before returning; throws
  descriptive errors

### Routing

`/` → `HomeView.vue` (admin + `AdminPanel` component)  
`/drawing` → `DrawingView.vue` (projector display, listens on `BroadcastChannel('drawing_trigger')`)

### PWA

Configured in `vite.config.js` via `vite-plugin-pwa` (`generateSW` mode,
`registerType: 'autoUpdate'`). Icons live in `public/pwa-192.png` and
`public/pwa-512.png`. The service worker precaches all built assets.

### Portable build (Offline Edition)

`PORTABLE=true` (set by `npm run build:portable`) switches `vite.config.js` to a
single-file build: `vite-plugin-singlefile` inlines everything into
`dist-portable/index.html`, the PWA plugin is dropped, `base` becomes `./`, and
source maps are off. The output runs from `file://` (USB stick, no server).

`src/utils/platform.js` centralizes the `file://` adaptations:
- `isPortable()` — true when `location.protocol === 'file:'`.
- `createTriggerChannel()` — returns a unified channel
  (`{ postMessage, onMessage, close }`) for multi-display. On the web it wraps
  `BroadcastChannel`; under `file://` (where opaque origins make
  `BroadcastChannel` useless) it falls back to a `localStorage` + `storage`-event
  transport, which *does* propagate between `file://` tabs of the same file. That
  fallback *also* polls the stored value (`POLL_INTERVAL_MS`) because Safari can
  stop dispatching `storage` events to a reloaded `file://` window; a per-message
  nonce de-dups the event vs. the poll and prevents a tab echoing its own post.
  **Always use this instead of `new BroadcastChannel(...)` directly.**

`src/router/index.js` uses `createWebHashHistory()` when `isPortable()` (so
`/#/drawing` resolves without a server), else `createWebHistory()`. Multi-display
works in both web and portable modes.

## Testing patterns

Tests use **Vitest** with the `jsdom` environment (`globals: true` — no imports
needed for `describe`/`it`/`expect`).

- **Store tests** (`src/stores/participants.test.js`): create a fresh Pinia +
  clear `localStorage` in `beforeEach`. Use `vi.useFakeTimers()` for the
  animation loop.
- **CSV tests** (`src/utils/csv.test.js`): pure functions, no mocking needed.
- **Export tests** (`src/utils/export.test.js`): stub `Blob`, `URL.createObjectURL`,
  `URL.revokeObjectURL`, and spy on `document.createElement` to intercept the
  download without a real browser. Clean up with `vi.unstubAllGlobals()` +
  `vi.restoreAllMocks()` in `afterEach`.

## Participant data shape

Participants are generic — they need not be people. A participant is an `id`
plus an insertion-ordered `fields` map (every value is a string):

```js
{
  id: string,          // crypto.randomUUID() or fallback
  fields: {            // keyed by the field label, value always string
    "First Name": "Ada",
    "Last Name": "Lovelace",
    "School Grade": "3",
    // ...e.g. a restaurant list might be { "Restaurant": "...", "Cuisine": "..." }
  }
}
```

Which field(s) form the displayed headline vs. detail rows is configured in
`settings.winnerDisplay`:
- `nameKeys: string[]` — ordered field keys composing the headline, joined by
  `nameSeparator`. `formatWinnerName(p, winnerDisplay)` builds it.
- `fields: [{ key, label, visible }]` — per-field label/visibility/order;
  `visibleWinnerFields` returns the visible **detail** rows (name keys excluded).

Editable both in the import mapping dialog and in `EventSettings.vue`. Legacy
`{ firstName, lastName, extras }` data (and old `nameFormat`) is migrated on load
(see `migrateParticipant` and `mergeSettings`).

## Key constraints

- No backend — everything is `localStorage` + browser File API.
- `BroadcastChannel` requires both screens to be the same origin in the same
  browser profile.
- The chunk-size warning on build is pre-existing (Vuetify is large) and is not
  a regression.
- `vue.config.js` is vestigial (source-map only) — `vite.config.js` is the
  real build config.
