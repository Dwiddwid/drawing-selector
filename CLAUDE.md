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

Key actions:
| Action | Effect |
|---|---|
| `importParticipants(list)` | Replaces candidate pool; skips prior winners by key |
| `addCandidate({ firstName, lastName, extras? })` | Appends one participant with a generated id |
| `removeCandidate(id)` | Splices by id |
| `commitSelection()` | Copies winner (not reference), splices from pool |
| `importState({ candidates, winners })` | Full restore from JSON backup |
| `resetCandidates()` / `resetWinners()` | Clear lists and localStorage |

### CSV parsing — `src/utils/csv.js`

`parseParticipantsCsv(text)` is the top-level entry point. Internally:
- `parseCsv(text)` → `{ headers, rows }` — handles quoted fields, escaped `""`,
  CRLF/CR/LF
- `normalizeParticipants(headers, rows)` → `Participant[]` — maps flexible
  header aliases to `{ id, firstName, lastName, extras }`, throws if required
  columns are absent
- `participantKey(p)` — stable de-dup key (lowercased name + sorted extras)
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
  transport, which *does* propagate between `file://` tabs of the same file.
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

```js
{
  id: string,          // crypto.randomUUID() or fallback
  firstName: string,
  lastName: string,
  extras: {            // keyed by original CSV header, value always string
    "School Grade": "3",
    "Bus Route": "12B",
    // ...any other columns
  }
}
```

`extras` preserves the original CSV header casing and order. The drawing screen
renders all entries in `extras` as `Header: value`.

## Key constraints

- No backend — everything is `localStorage` + browser File API.
- `BroadcastChannel` requires both screens to be the same origin in the same
  browser profile.
- The chunk-size warning on build is pre-existing (Vuetify is large) and is not
  a regression.
- `vue.config.js` is vestigial (source-map only) — `vite.config.js` is the
  real build config.
