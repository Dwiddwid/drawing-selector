# Test Coverage Analysis

## Current State

**Test coverage: 0%.** The project has no test framework installed, no test configuration, no test scripts, and no test files. There is no infrastructure for running tests at all.

---

## Business Logic Inventory

The following files contain logic that should be tested:

| File | Logic Summary | Priority |
|------|--------------|----------|
| `src/stores/participants.js` | Core drawing algorithm, random selection, animation loop, winner tracking, localStorage persistence | **Critical** |
| `src/components/AdminPanel.vue` | CSV parsing (`csvToJSON`), file upload handling, winner deduplication, reset functions | **Critical** |
| `src/App.vue` | State hydration from localStorage on mount | Medium |
| `src/views/HomeView.vue` | Multi-display mode save, BroadcastChannel messaging | Medium |
| `src/views/DrawingView.vue` | BroadcastChannel listener, conditional rendering | Low |

---

## Recommended Test Framework Setup

Install **Vitest** (native Vite integration) with **Vue Test Utils** and **jsdom**:

```
npm install -D vitest @vue/test-utils jsdom
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:coverage": "vitest --coverage"
```

Add to `vite.config.js`:
```js
test: {
  environment: 'jsdom',
}
```

---

## Priority 1: Participant Store (`src/stores/participants.js`)

This is the most critical file to test. It contains the core drawing algorithm.

### Tests to write

**`pointToRandomCandidate()`**
- Sets `index` to a value within `[0, candidates.length)`
- Works with a single candidate
- Works with many candidates

**`selectRandomCandidate()`**
- Returns early (no-op) if `spinning` is already `true`
- Sets `spinning = true` when invoked
- Removes the previously-selected candidate from `candidates` (when `index > -1`)
- Eventually sets `spinning = false` after the animation completes
- Pushes the selected candidate into `winners`
- Persists `winners` to `localStorage`
- Does not crash when `candidates` is empty (edge case -- currently unhandled)

**Getter: `currentCandidate`**
- Returns `null` when `index` is `-1`
- Returns the correct candidate when `index` is valid

**Getter: `getParticipants`**
- Returns the union of `candidates` and `winners`
- Returns empty array when both are empty

**Getter: `winnerSelected`**
- Returns `true` only when `spinning === false && index > -1`
- Returns `false` when spinning
- Returns `false` when `index === -1`

### Bugs discovered during analysis

1. **No guard for empty candidates list.** `selectRandomCandidate()` can be called with zero candidates. `pointToRandomCandidate()` would set `index` to `NaN` (`Math.floor(Math.random() * 0)`), and `this.candidates[NaN]` would push `undefined` into `winners`.

2. **Previous winner is spliced before the animation starts.** On line 41, `this.candidates.splice(this.index, 1)` removes the previous winner from candidates at the beginning of the next draw -- but the winner was already pushed into `winners[]` at line 58. This is correct behavior, but a test should verify the candidate pool shrinks by exactly 1 after each draw.

---

## Priority 2: CSV Parsing (`AdminPanel.vue` -- `csvToJSON`)

This is a pure function embedded in a component. It should ideally be extracted into a utility module for easier testing.

### Tests to write

**Happy path**
- Parses a standard CSV with headers `First Name,Last Name,School Grade`
- Returns an array of objects with correct keys/values
- Handles both `\r\n` and `\n` line endings

**Edge cases**
- Skips blank lines in the CSV
- Handles a CSV with only a header row (returns `[]`)
- Handles trailing newline at end of file
- Handles fields with leading/trailing whitespace

**Missing functionality to consider**
- No handling for quoted CSV fields (e.g., `"Smith, Jr."`) -- commas inside quotes will break parsing
- No validation that expected headers exist

### Bugs discovered during analysis

1. **Winner deduplication is broken.** In `selectedFile()` at line 60, `findIndex` returns `-1` when not found and `0+` when found. The check `if (exists)` treats `0` (a valid found-index meaning "found at position 0") as falsy, so it won't filter out a winner that happens to be at index 0. Additionally, line 61 uses `nameList.slice(i, 0)` which is a no-op -- it should be `nameList.splice(i, 1)` to actually remove the element.

---

## Priority 3: App State Hydration (`App.vue`)

### Tests to write

- When `localStorage` contains `candidates`, `winners`, and `useMultiDisplayMode`, the store is populated correctly on mount
- When `localStorage` is empty, the store retains its defaults
- Handles malformed JSON in localStorage gracefully (currently does not -- `JSON.parse` will throw)

---

## Priority 4: HomeView Multi-Display

### Tests to write

- `saveMultiDisplay()` writes the value to localStorage and updates the store
- `selectWinner()` posts a message on the BroadcastChannel (requires mocking `BroadcastChannel`)

---

## Priority 5: DrawingView

### Tests to write

- Renders "Ready to start drawing!" when `store.index < 0`
- Renders "And the Winner Is..." when `store.spinning` is true
- Displays the candidate name when `store.index > -1`
- Hides the GO button when `store.useMultiDisplayMode` is true
- BroadcastChannel `onmessage` calls `store.selectRandomCandidate()`

---

## Summary of Bugs Found

| # | Location | Description | Severity |
|---|----------|-------------|----------|
| 1 | `participants.js:28` | No guard against empty candidates list -- results in `NaN` index and `undefined` winner | High |
| 2 | `AdminPanel.vue:60-61` | Winner deduplication logic is broken: `findIndex` returns `0` for first match (falsy), and `slice` is used instead of `splice` | High |
| 3 | `App.vue:12` | No try/catch around `JSON.parse` for localStorage values -- corrupted data crashes the app | Medium |

---

## Suggested File Structure for Tests

```
src/
  stores/
    __tests__/
      participants.spec.js
  components/
    __tests__/
      AdminPanel.spec.js
  views/
    __tests__/
      DrawingView.spec.js
      HomeView.spec.js
  utils/
    csvParser.js          # Extract csvToJSON here
    __tests__/
      csvParser.spec.js
```
