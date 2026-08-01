import { defineStore } from 'pinia'
import { participantKey, uid, migrateParticipants, entryWeight } from '../utils/csv.js'
import { broadcastSync } from '../utils/sync.js'
import { useSettingsStore } from './settings.js'

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

// Wall-clock length (ms) of the deceleration phase for a timing curve: the sum
// of the increasing per-tick delays once the slow-down begins, until the delay
// exceeds maxDelay and the spin stops. The configured draw duration is treated
// as the *total*, so the fast phase is shortened by this tail to keep the
// operator's number honest.
export function decelTailMs(timing) {
  let delay = timing.baseDelay
  let total = 0
  while (true) {
    delay += timing.step
    if (delay < timing.maxDelay) total += delay
    else break
  }
  return total
}

export const useParticipantStore = defineStore('participantStore', {
  state: () => ({
    candidates: [],
    winners: [],
    index: -1,
    selected: null,
    // Winner copies committed during the current/most-recent draw batch, in
    // draw order. Drives the end-of-batch roster on the drawing screen. Not
    // persisted — it's a per-window presentation concern.
    lastDrawWinners: [],
    // True while a multi-winner batch is running. While active, candidates who
    // already won in this batch are excluded from subsequent picks (matters in
    // multi-win entries mode, where winners stay in the pool).
    batchActive: false,
    spinning: false,
    // Set by requestManualStop() to tell an in-progress 'manual' classic spin to
    // begin decelerating. Reset at the start/end of each spin.
    manualStop: false,
    // Set by abortSpin() to tear down an in-progress classic spin *without*
    // committing a winner — used when the drawing screen unmounts mid-draw, so
    // a navigated-away batch can't keep awarding winners in the background.
    spinAborted: false,
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
    // Identity keys of everyone who has already won in the current batch.
    batchWinnerKeys(state) {
      return new Set(state.lastDrawWinners.map(participantKey))
    },
    // The pool a draw may pick from: the filtered candidates, minus anyone who
    // already won in the current batch. Identical to filteredCandidates when no
    // batch is running (odds mode removes winners from the pool anyway; this
    // matters for multi-win mode, where they stay).
    drawableCandidates(state) {
      if (!state.batchActive || state.lastDrawWinners.length === 0) {
        return this.filteredCandidates
      }
      const keys = this.batchWinnerKeys
      return this.filteredCandidates.filter((c) => !keys.has(participantKey(c)))
    },
    // Total number of draw entries across the drawable pool, honoring each
    // participant's weight. Equals the candidate count when every weight is 1.
    // A pool with entries but a total of 0 is effectively un-drawable.
    totalEntries() {
      return this.drawableCandidates.reduce((sum, c) => sum + entryWeight(c), 0)
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
      // The last draw's roster refers to winners that no longer exist.
      this.lastDrawWinners = []
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
    // Re-insert a previously-removed candidate at its original position. Backs
    // the "Undo" on a single delete; the index is clamped so a list that shrank
    // in the meantime still lands the row somewhere valid.
    insertCandidate(participant, index) {
      const i = Math.min(Math.max(0, index), this.candidates.length)
      this.candidates.splice(i, 0, participant)
      this.persistCandidates()
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
      this.lastDrawWinners = []
      this.batchActive = false
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
      const pick = this.weightedPick(this.drawableCandidates)
      if (!pick) { this.index = -1; return }
      this.index = this.candidates.findIndex((c) => c.id === pick.id)
    },
    // Move the currently pointed-at candidate into winners (as a copy).
    // In 'odds' mode (default) the participant is removed from the pool.
    // In 'multi-win' mode, one entry is consumed; they stay until entries hit 1.
    // A maxWinsPerParticipant cap overrides multi-win: once reached, they're removed.
    commitSelection() {
      if (this.index < 0 || this.index >= this.candidates.length) return
      const src = this.candidates[this.index]
      const winner = { ...src, fields: { ...(src.fields ?? {}) } }
      this.winners.push(winner)

      const { entriesMode, maxWinsPerParticipant } = useSettingsStore().participantList
      const weight = entryWeight(src)
      const srcKey = participantKey(src)
      const winCount = maxWinsPerParticipant !== null
        ? this.winners.filter((w) => participantKey(w) === srcKey).length
        : 0
      const capReached = maxWinsPerParticipant !== null && winCount >= maxWinsPerParticipant

      if (entriesMode === 'multi-win' && weight > 1 && !capReached) {
        src.entries = weight - 1
      } else {
        this.candidates.splice(this.index, 1)
      }

      this.selected = winner
      // The roster describes *this batch's* draw. Manual admin awards (which
      // commit outside a batch) must not accumulate into it, or the projector
      // would show a "winners" roster before anyone has drawn.
      if (this.batchActive) this.lastDrawWinners.push(winner)
      this.index = -1
      this.persistWinners()
      this.persistCandidates()
    },
    // Bracket a multi-winner draw. beginDrawBatch() resets the roster; while
    // the batch is active, drawableCandidates excludes this batch's winners so
    // one trigger never awards the same person twice (relevant in multi-win
    // mode). Single draws use the same bracket — their roster just has 1 entry.
    beginDrawBatch() {
      this.batchActive = true
      this.lastDrawWinners = []
    },
    endDrawBatch() {
      this.batchActive = false
    },
    // Pick a winner index up front *without* mutating state. Used by visual
    // animations (e.g. the wheel) that need to know who the winner is before
    // the on-screen reveal can land on them. Returns -1 if the pool is empty.
    pickWinnerIndex() {
      const pick = this.weightedPick(this.drawableCandidates)
      if (!pick) return -1
      return this.candidates.findIndex((c) => c.id === pick.id)
    },
    // Pick up to `n` distinct winners up front *without* mutating state —
    // weighted sampling without replacement over the drawable pool, also
    // skipping same-identity duplicates. Used by the simultaneous multi-winner
    // reveal, which needs every winner known before its panes start spinning.
    // Returns fewer than `n` ids when the pool runs short.
    pickWinnerIds(n) {
      const ids = []
      let pool = this.drawableCandidates
      while (ids.length < n) {
        const pick = this.weightedPick(pool)
        if (!pick) break
        ids.push(pick.id)
        const key = participantKey(pick)
        pool = pool.filter((c) => c.id !== pick.id && participantKey(c) !== key)
      }
      return ids
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
    // Leave "spinning" without committing anything. The simultaneous reveal
    // commits its pre-picked winners via commitWinnerById() and then ends the
    // visual spin explicitly (commitSelection doesn't touch `spinning`).
    endVisualSpin() {
      this.spinning = false
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
    // Request that an in-progress 'manual'-timed spin start slowing to a stop.
    // A no-op for fixed/random draws (they decelerate on their own schedule).
    requestManualStop() {
      this.manualStop = true
    },
    // Abandon an in-progress classic spin without picking a winner. The tick
    // loop notices on its next tick, clears `spinning` and fires `onDone` so
    // any awaiting batch can unwind. Returns false when nothing was spinning.
    abortSpin() {
      if (!this.spinning) return false
      this.spinAborted = true
      return true
    },
    // Shared slot-machine animation loop. Cycles the pointer at the base delay,
    // then decelerates to a stop; once stopped, `resolveWinner()` fixes the final
    // `this.index` (a no-op for a random draw — the last tick already set it) and
    // the pointed-at candidate is committed.
    //
    // `durationMs` is the target *total* animation length:
    //   finite — run fast for (durationMs − decel tail), then decelerate, so the
    //     whole reveal lands near durationMs. Counted in base-delay ticks so it
    //     stays deterministic under fake timers. Values below the decel tail
    //     collapse to a single fast tick (the tail is the practical minimum).
    //   Infinity ('manual') — stay fast until requestManualStop() is called, then
    //     decelerate.
    runSpinAnimation(style, resolveWinner, { durationMs = 4500, onDone } = {}) {
      const timing = ANIMATION_TIMING[style] ?? ANIMATION_TIMING.classic
      this.spinning = true
      this.selected = null
      this.manualStop = false
      this.spinAborted = false
      // A committed draw renders any prior reset-undo meaningless.
      this.clearResetUndo()

      const manual = !Number.isFinite(durationMs)
      const fastMs = Math.max(timing.baseDelay, durationMs - decelTailMs(timing))
      const fastTicks = manual ? Infinity : Math.max(1, Math.round(fastMs / timing.baseDelay))
      let i = 0
      let delay = timing.baseDelay
      let decelerating = false

      const tick = () => {
        // Abandoned (the drawing screen unmounted mid-spin): stop the loop and
        // leave the pool untouched — no winner is committed.
        if (this.spinAborted) {
          this.spinAborted = false
          this.spinning = false
          this.manualStop = false
          this.index = -1
          onDone?.()
          return
        }
        this.pointToRandomCandidate()
        i += 1
        if (!decelerating && (manual ? this.manualStop : i >= fastTicks)) {
          decelerating = true
        }
        if (decelerating) {
          delay += timing.step
        }
        if (delay < timing.maxDelay) {
          setTimeout(tick, delay)
        } else {
          this.spinning = false
          this.manualStop = false
          resolveWinner()
          this.commitSelection()
          // After the commit, so batch orchestration reads a settled state.
          onDone?.()
        }
      }

      setTimeout(tick, delay)
    },
    // Run the slot-machine animation but land on a specific participant.
    // Visual cycling is still random; the forced participant is committed at the
    // end. A manual pick is an explicit operator override, so it intentionally
    // ignores the active draw filter (unlike the random draw, which is gated on
    // the filtered pool via totalEntries).
    selectSpecificCandidate(id, style = 'classic', { durationMs, onDone } = {}) {
      if (this.spinning) return false
      if (this.candidates.findIndex((c) => c.id === id) < 0) return false
      this.runSpinAnimation(
        style,
        () => {
          this.index = this.candidates.findIndex((c) => c.id === id)
        },
        { durationMs, onDone },
      )
      return true
    },
    // Commit a candidate to winners by id, with the same entriesMode/cap
    // semantics as commitSelection. Used by the simultaneous reveal (winners
    // are pre-picked by id, and each commit reshuffles candidate indices).
    commitWinnerById(id) {
      const idx = this.candidates.findIndex((c) => c.id === id)
      if (idx === -1) return false
      this.index = idx
      this.commitSelection()
      return true
    },
    // Add a participant directly to winners without any animation (admin-only path).
    manuallySelectWinner(id) {
      return this.commitWinnerById(id)
    },
    selectRandomCandidate(style = 'classic', { durationMs, onDone } = {}) {
      if (this.spinning) return false
      if (this.totalEntries === 0) return false
      this.runSpinAnimation(style, () => {}, { durationMs, onDone })
      return true
    },
  },
})
