import { defineStore } from 'pinia'
import { participantKey, uid, migrateParticipants, entryWeight } from '../utils/csv.js'
import { broadcastSync } from '../utils/sync.js'

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// Timing curves for each animation style. The picking math is identical across
// styles; these knobs just change how the reveal *feels*.
//   baseDelay:  starting ms between ticks (low = faster initial scroll)
//   step:       ms added to the delay once decel begins (higher = sharper slow)
//   maxDelay:   stop spinning once this is exceeded
//   minRandom:  upper bound of the random "time before slow" pre-roll
export const ANIMATION_TIMING = {
  classic: { baseDelay: 10, step: 50, maxDelay: 500, minRandom: 300 },
  wheel: { baseDelay: 30, step: 25, maxDelay: 750, minRandom: 200 },
}

export const useParticipantStore = defineStore('participantStore', {
  state: () => ({
    candidates: [],
    winners: [],
    index: -1,
    selected: null,
    spinning: false,
    useMultiDisplayMode: false,
    filters: [],
    // Snapshots of the most recent reset so the operator can undo an
    // accidental "Reset candidates" / "Reset winners" click. Cleared once a
    // new import or commit happens (i.e. the undo would no longer make sense).
    lastResetCandidates: null,
    lastResetWinners: null,
  }),
  getters: {
    currentCandidate(state) {
      if (state.index > -1 && state.index < state.candidates.length) {
        return state.candidates[state.index]
      }
      return null
    },
    getParticipants(state) {
      return [...state.candidates, ...state.winners]
    },
    winnerSelected(state) {
      return state.spinning === false && state.selected !== null
    },
    filteredCandidates(state) {
      if (state.filters.length === 0) return state.candidates
      return state.candidates.filter((c) =>
        state.filters.every((f) => c.fields?.[f.key] === f.value),
      )
    },
    // Total number of draw entries across the (filtered) pool, honoring each
    // participant's weight. Equals the candidate count when every weight is 1.
    // A pool with entries but a total of 0 is effectively un-drawable.
    totalEntries() {
      return this.filteredCandidates.reduce((sum, c) => sum + entryWeight(c), 0)
    },
  },
  actions: {
    loadFromStorage() {
      // Migrate any legacy { firstName, lastName, extras } records to the
      // generic { id, fields } shape on the way in.
      this.candidates = migrateParticipants(readJSON('candidates', []))
      this.winners = migrateParticipants(readJSON('winners', []))
      this.useMultiDisplayMode = readJSON('useMultiDisplayMode', false)
      this.filters = readJSON('filters', [])
    },
    // Reload just the draw filters from storage. The projector/drawing screen
    // runs in a separate window (separate store), so it calls this right before
    // a draw to honor filters the admin set after the window was opened.
    loadFilters() {
      this.filters = readJSON('filters', [])
    },
    persistCandidates() {
      localStorage.setItem('candidates', JSON.stringify(this.candidates))
      broadcastSync('participants')
    },
    persistFilters() {
      localStorage.setItem('filters', JSON.stringify(this.filters))
      broadcastSync('participants')
    },
    persistWinners() {
      localStorage.setItem('winners', JSON.stringify(this.winners))
      broadcastSync('participants')
    },
    setMultiDisplayMode(value) {
      this.useMultiDisplayMode = value
      localStorage.setItem('useMultiDisplayMode', JSON.stringify(value))
      broadcastSync('participants')
    },
    // Import a list of participants, excluding anyone who has already won.
    //   mode 'replace' (default) — the list becomes the new candidate pool.
    //   mode 'append' — add to the current pool, also skipping in-pool dups.
    //   mode 'accumulate' — add to the pool, but a row matching an existing
    //     candidate (by identity) *adds its entries* onto that candidate rather
    //     than being skipped. This is the multi-day check-in path: import each
    //     day's attendee list and returning people build up extra entries.
    importParticipants(list, mode = 'replace') {
      const winnerKeys = new Set(this.winners.map(participantKey))
      const base = mode === 'append' || mode === 'accumulate' ? [...this.candidates] : []
      const byKey = new Map(base.map((p) => [participantKey(p), p]))
      const added = []
      let skipped = 0
      let merged = 0
      for (const p of list) {
        const key = participantKey(p)
        if (winnerKeys.has(key)) {
          skipped += 1
          continue
        }
        const existing = byKey.get(key)
        if (existing) {
          if (mode === 'accumulate') {
            existing.entries = entryWeight(existing) + entryWeight(p)
            merged += 1
          } else {
            skipped += 1
          }
          continue
        }
        byKey.set(key, p)
        added.push(p)
      }
      this.candidates = [...base, ...added]
      this.index = -1
      this.selected = null
      this.lastResetCandidates = null
      this.persistCandidates()
      return { imported: added.length, skipped, merged, mode }
    },
    resetCandidates() {
      // Snapshot the current list (and active filters) so the operator can
      // undo a mistaken click before doing anything else.
      this.lastResetCandidates = {
        candidates: this.candidates.map((c) => ({ ...c, fields: { ...(c.fields ?? {}) } })),
        filters: this.filters.map((f) => ({ ...f })),
      }
      this.candidates = []
      this.index = -1
      this.selected = null
      this.filters = []
      localStorage.removeItem('candidates')
      localStorage.removeItem('filters')
      broadcastSync('participants')
    },
    // Reset the winners list. `mode` is the operator's choice from the dialog:
    //   'return' — move winners back into the candidate pool for re-drawing
    //   'remove' — clear them entirely (candidates untouched)
    // Either way a snapshot is kept so the reset can be undone from the toast.
    resetWinners(mode = 'return') {
      const winners = this.winners.map((w) => ({ ...w, fields: { ...(w.fields ?? {}) } }))
      this.lastResetWinners = { mode, winners }
      if (mode === 'return') {
        this.candidates.push(...winners.map((w) => ({ ...w, fields: { ...(w.fields ?? {}) } })))
      }
      this.winners = []
      this.selected = null
      this.persistCandidates()
      this.persistWinners()
    },
    undoResetCandidates() {
      if (!this.lastResetCandidates) return false
      this.candidates = this.lastResetCandidates.candidates
      this.filters = this.lastResetCandidates.filters
      this.lastResetCandidates = null
      this.persistCandidates()
      this.persistFilters()
      return true
    },
    undoResetWinners() {
      if (!this.lastResetWinners) return false
      const { mode, winners } = this.lastResetWinners
      if (mode === 'return') {
        // The reset pushed the winners into candidates — pull them back out.
        const winnerIds = new Set(winners.map((w) => w.id))
        this.candidates = this.candidates.filter((c) => !winnerIds.has(c.id))
      }
      this.winners = winners
      this.lastResetWinners = null
      this.persistCandidates()
      this.persistWinners()
      return true
    },
    clearResetUndo() {
      this.lastResetCandidates = null
      this.lastResetWinners = null
    },
    addCandidate(fields = {}, entries = 1) {
      this.candidates.push({ id: uid(), fields: { ...fields }, entries })
      this.persistCandidates()
    },
    removeCandidate(id) {
      const idx = this.candidates.findIndex((c) => c.id === id)
      if (idx !== -1) {
        this.candidates.splice(idx, 1)
        this.persistCandidates()
      }
    },
    updateCandidate(id, { fields, entries } = {}) {
      const c = this.candidates.find((c) => c.id === id)
      if (!c) return
      if (fields) c.fields = { ...c.fields, ...fields }
      if (entries !== undefined) c.entries = entries
      if (!fields && entries === undefined) return
      this.persistCandidates()
    },
    addFilter(key, value) {
      const existing = this.filters.findIndex((f) => f.key === key)
      if (existing !== -1) {
        this.filters[existing].value = value
      } else {
        this.filters.push({ key, value })
      }
      this.persistFilters()
    },
    removeFilter(key) {
      const idx = this.filters.findIndex((f) => f.key === key)
      if (idx !== -1) {
        this.filters.splice(idx, 1)
        this.persistFilters()
      }
    },
    clearFilters() {
      this.filters = []
      this.persistFilters()
    },
    importState({ candidates, winners }) {
      this.candidates = candidates
      this.winners = winners
      this.index = -1
      this.selected = null
      this.filters = []
      this.lastResetCandidates = null
      this.lastResetWinners = null
      this.persistCandidates()
      this.persistWinners()
      this.persistFilters()
    },
    // Weighted random pick over a pool, honoring each participant's entry count.
    // Returns null when the pool is empty or every weight is 0. With all weights
    // 1 this is a plain uniform pick, identical to the original behavior.
    weightedPick(pool) {
      const total = pool.reduce((sum, c) => sum + entryWeight(c), 0)
      if (total <= 0) return null
      let r = Math.random() * total
      let last = null
      for (const c of pool) {
        const w = entryWeight(c)
        if (w <= 0) continue
        last = c
        r -= w
        if (r < 0) return c
      }
      // Only reachable via floating-point rounding; `last` is the final
      // positive-weight candidate, so we never fall back onto a 0-weight one.
      return last
    },
    pointToRandomCandidate() {
      const pick = this.weightedPick(this.filteredCandidates)
      if (!pick) { this.index = -1; return }
      this.index = this.candidates.findIndex((c) => c.id === pick.id)
    },
    // Move the currently pointed-at candidate into winners (as a copy) and
    // remove them from the pool so they can never be drawn again.
    commitSelection() {
      if (this.index < 0 || this.index >= this.candidates.length) return
      const src = this.candidates[this.index]
      const winner = { ...src, fields: { ...(src.fields ?? {}) } }
      this.winners.push(winner)
      this.candidates.splice(this.index, 1)
      this.selected = winner
      this.index = -1
      this.persistWinners()
      this.persistCandidates()
    },
    // Pick a winner index up front *without* mutating state. Used by visual
    // animations (e.g. the wheel) that need to know who the winner is before
    // the on-screen reveal can land on them. Returns -1 if the pool is empty.
    pickWinnerIndex() {
      const pick = this.weightedPick(this.filteredCandidates)
      if (!pick) return -1
      return this.candidates.findIndex((c) => c.id === pick.id)
    },
    // Enter "spinning" without running the timer-driven slot-machine loop.
    // The caller (a visual animation component) is responsible for ending the
    // spin via commitAt().
    beginVisualSpin() {
      if (this.spinning) return false
      if (this.totalEntries === 0) return false
      this.spinning = true
      this.selected = null
      this.clearResetUndo()
      return true
    },
    // Commit a pre-chosen index (no random pick). Used by the wheel and other
    // visual animations that determined the winner in advance via
    // pickWinnerIndex(). Bails cleanly on an out-of-range index and always
    // leaves spinning=false.
    commitAt(idx) {
      this.spinning = false
      if (idx < 0 || idx >= this.candidates.length) {
        this.index = -1
        return false
      }
      this.index = idx
      this.commitSelection()
      return true
    },
    selectRandomCandidate(style = 'classic') {
      if (this.spinning) return false
      if (this.totalEntries === 0) return false

      const timing = ANIMATION_TIMING[style] ?? ANIMATION_TIMING.classic
      this.spinning = true
      this.selected = null
      // A committed draw renders any prior reset-undo meaningless.
      this.clearResetUndo()

      const timeBeforeSlow = Math.floor(Math.random() * timing.minRandom)
      let i = 0
      let delay = timing.baseDelay

      const tick = () => {
        this.pointToRandomCandidate()
        i += 1
        if (i > timeBeforeSlow) {
          delay += timing.step
        }
        if (delay < timing.maxDelay) {
          setTimeout(tick, delay)
        } else {
          this.spinning = false
          this.commitSelection()
        }
      }

      setTimeout(tick, delay)
      return true
    },
  },
})
