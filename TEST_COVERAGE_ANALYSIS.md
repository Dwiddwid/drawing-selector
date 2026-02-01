# Test Coverage Analysis

## Current State

**48 tests across 5 test files, all passing.**

The project uses **Vitest** with **Vue Test Utils** and **jsdom** for testing. Tests can be run via:

```
npm run test          # single run
npm run test:watch    # watch mode
```

---

## Test Infrastructure

| Component | Details |
|-----------|---------|
| Test runner | Vitest 4.x |
| Component testing | @vue/test-utils 2.x |
| DOM environment | jsdom 27.x |
| Setup file | `src/test-setup.js` (polyfills `ResizeObserver` and `BroadcastChannel`) |
| Config | `vite.config.js` — `test` block with jsdom env, Vuetify inlined |

---

## Test File Inventory

| Test File | Tests | Source File(s) Covered | What's Tested |
|-----------|-------|----------------------|---------------|
| `src/stores/__tests__/participants.spec.js` | 22 | `src/stores/participants.js` | Initial state (4), `currentCandidate` getter (2), `getParticipants` getter (4), `winnerSelected` getter (3), `pointToRandomCandidate` action (2), `selectRandomCandidate` action (7) |
| `src/utils/__tests__/csvParser.spec.js` | 10 | `src/utils/csvParser.js` | Standard CSV parsing, `\r\n`/`\r` line endings, blank line skipping, header-only CSV, trailing newlines, whitespace preservation, single/many columns, missing fields |
| `src/components/__tests__/App.spec.js` | 4 | `src/App.vue` | localStorage hydration of candidates, winners, and multi-display mode; empty localStorage defaults |
| `src/views/__tests__/DrawingView.spec.js` | 7 | `src/views/DrawingView.vue` | Conditional rendering (ready/spinning/winner states), GO button visibility based on multi-display mode, `selectRandomCandidate` click handler |
| `src/views/__tests__/HomeView.spec.js` | 5 | `src/views/HomeView.vue` | Title rendering, "Select winner" button conditional on multi-display mode, checkbox presence, "Start drawing" link |

---

## Refactoring Done

- **`csvToJSON` extracted** from `src/components/AdminPanel.vue` into `src/utils/csvParser.js` so it can be unit tested independently. `AdminPanel.vue` now imports it from the utility module.

---

## What Is Covered

### Participant Store (22 tests) — `src/stores/participants.js`

| Area | Tests | Status |
|------|-------|--------|
| Initial state defaults | 4 | Covered |
| `currentCandidate` getter (null + valid index) | 2 | Covered |
| `getParticipants` getter (empty, candidates-only, winners-only, combined) | 4 | Covered |
| `winnerSelected` getter (spinning, no-index, valid) | 3 | Covered |
| `pointToRandomCandidate` (range validation, single candidate) | 2 | Covered |
| `selectRandomCandidate` spinning guard | 1 | Covered |
| `selectRandomCandidate` sets spinning flag | 1 | Covered |
| `selectRandomCandidate` removes previous winner from candidates | 1 | Covered |
| `selectRandomCandidate` first draw (no removal) | 1 | Covered |
| `selectRandomCandidate` animation completes and selects winner | 1 | Covered |
| `selectRandomCandidate` persists winners to localStorage | 1 | Covered |
| `selectRandomCandidate` sequential draws | 1 | Covered |

### CSV Parser (10 tests) — `src/utils/csvParser.js`

| Area | Tests | Status |
|------|-------|--------|
| Standard CSV with headers | 1 | Covered |
| `\r\n` line endings | 1 | Covered |
| `\r` line endings | 1 | Covered |
| Blank line skipping | 1 | Covered |
| Header-only CSV | 1 | Covered |
| Trailing newline | 1 | Covered |
| Whitespace preservation in fields | 1 | Covered |
| Single-column CSV | 1 | Covered |
| Many-column CSV | 1 | Covered |
| Missing fields (undefined) | 1 | Covered |

### App State Hydration (4 tests) — `src/App.vue`

| Area | Tests | Status |
|------|-------|--------|
| Loads candidates from localStorage | 1 | Covered |
| Loads winners from localStorage | 1 | Covered |
| Loads useMultiDisplayMode from localStorage | 1 | Covered |
| Keeps defaults when localStorage is empty | 1 | Covered |

### DrawingView (7 tests) — `src/views/DrawingView.vue`

| Area | Tests | Status |
|------|-------|--------|
| "Ready to start drawing!" when index < 0 | 1 | Covered |
| "And the Winner Is..." when spinning | 1 | Covered |
| Displays candidate name and last name | 1 | Covered |
| Displays school grade | 1 | Covered |
| Hides GO button in multi-display mode | 1 | Covered |
| Shows GO button in single-display mode | 1 | Covered |
| GO button click calls `selectRandomCandidate` | 1 | Covered |

### HomeView (5 tests) — `src/views/HomeView.vue`

| Area | Tests | Status |
|------|-------|--------|
| Renders Title component text | 1 | Covered |
| "Select winner" button shown in multi-display mode | 1 | Covered |
| "Select winner" button hidden in single-display mode | 1 | Covered |
| Multi-display checkbox present | 1 | Covered |
| "Start drawing" link present | 1 | Covered |

---

## What Is NOT Covered (Remaining Gaps)

### AdminPanel.vue — file upload and reset logic

The `csvToJSON` function was extracted and tested, but the following logic inside `AdminPanel.vue` remains untested:

- **`selectedFile()`** — file type validation, FileReader integration, winner deduplication filtering, localStorage persistence of candidates
- **`resetCandidates()`** — clears store and localStorage
- **`resetWinners()`** — clears store and localStorage
- **Component rendering** — participant list, winner list, file input, reset buttons

### App.vue — malformed localStorage

- No test for corrupted/malformed JSON in localStorage (`JSON.parse` will throw and crash the app)

### HomeView.vue — `saveMultiDisplay` and BroadcastChannel

- **`saveMultiDisplay()`** — persists multi-display setting to localStorage and updates store
- **`selectWinner()`** — posts "Go!" message on the BroadcastChannel

### DrawingView.vue — BroadcastChannel listener

- **`bc.onmessage`** — triggers `store.selectRandomCandidate()` when a message arrives

---

## Known Bugs Found During Analysis

These were discovered during the initial code review and remain unfixed:

| # | Location | Description | Severity |
|---|----------|-------------|----------|
| 1 | `participants.js:28` | No guard against empty candidates list — `Math.floor(Math.random() * 0)` produces `NaN`, pushing `undefined` into winners | High |
| 2 | `AdminPanel.vue:52-53` | Winner deduplication is broken: `findIndex` returning `0` (first match) is treated as falsy by `if (exists)`, and `slice` is used instead of `splice` so no element is ever removed | High |
| 3 | `App.vue:12` | No try/catch around `JSON.parse` for localStorage values — corrupted data crashes the app | Medium |

---

## Recommendations for Further Improvement

1. **Fix the 3 known bugs** listed above — particularly the winner deduplication logic and the empty-candidates guard.
2. **Add AdminPanel component tests** for file upload handling, reset functions, and rendered participant/winner lists.
3. **Add BroadcastChannel integration tests** for HomeView's `selectWinner()` and DrawingView's `onmessage` handler.
4. **Add error-handling tests** for malformed localStorage data in `App.vue`.
5. **Consider adding `@vitest/coverage-v8`** to generate quantitative coverage reports.
