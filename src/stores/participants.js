import { defineStore } from 'pinia'
import { participantKey, uid } from '../utils/csv.js'

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
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
        state.filters.every((f) => c.extras?.[f.key] === f.value),
      )
    },
  },
  actions: {
    loadFromStorage() {
      this.candidates = readJSON('candidates', [])
      this.winners = readJSON('winners', [])
      this.useMultiDisplayMode = readJSON('useMultiDisplayMode', false)
    },
    persistCandidates() {
      localStorage.setItem('candidates', JSON.stringify(this.candidates))
    },
    persistWinners() {
      localStorage.setItem('winners', JSON.stringify(this.winners))
    },
    setMultiDisplayMode(value) {
      this.useMultiDisplayMode = value
      localStorage.setItem('useMultiDisplayMode', JSON.stringify(value))
    },
    // Replace the candidate pool, excluding anyone who has already won.
    importParticipants(list) {
      const winnerKeys = new Set(this.winners.map(participantKey))
      const filtered = []
      let skipped = 0
      for (const p of list) {
        if (winnerKeys.has(participantKey(p))) {
          skipped += 1
          continue
        }
        filtered.push(p)
      }
      this.candidates = filtered
      this.index = -1
      this.selected = null
      this.persistCandidates()
      return { imported: filtered.length, skipped }
    },
    resetCandidates() {
      this.candidates = []
      this.index = -1
      this.selected = null
      this.filters = []
      localStorage.removeItem('candidates')
    },
    resetWinners() {
      this.winners = []
      localStorage.removeItem('winners')
    },
    addCandidate({ firstName, lastName, extras = {} }) {
      this.candidates.push({ id: uid(), firstName, lastName, extras })
      this.persistCandidates()
    },
    removeCandidate(id) {
      const idx = this.candidates.findIndex((c) => c.id === id)
      if (idx !== -1) {
        this.candidates.splice(idx, 1)
        this.persistCandidates()
      }
    },
    updateCandidate(id, patch) {
      const c = this.candidates.find((c) => c.id === id)
      if (!c) return
      if (patch.firstName !== undefined) c.firstName = patch.firstName
      if (patch.lastName !== undefined) c.lastName = patch.lastName
      this.persistCandidates()
    },
    addFilter(key, value) {
      const existing = this.filters.findIndex((f) => f.key === key)
      if (existing !== -1) {
        this.filters[existing].value = value
      } else {
        this.filters.push({ key, value })
      }
    },
    removeFilter(key) {
      const idx = this.filters.findIndex((f) => f.key === key)
      if (idx !== -1) this.filters.splice(idx, 1)
    },
    clearFilters() {
      this.filters = []
    },
    importState({ candidates, winners }) {
      this.candidates = candidates
      this.winners = winners
      this.index = -1
      this.selected = null
      this.persistCandidates()
      this.persistWinners()
    },
    pointToRandomCandidate() {
      const pool = this.filteredCandidates
      if (pool.length === 0) { this.index = -1; return }
      const pick = pool[Math.floor(Math.random() * pool.length)]
      this.index = this.candidates.findIndex((c) => c.id === pick.id)
    },
    // Move the currently pointed-at candidate into winners (as a copy) and
    // remove them from the pool so they can never be drawn again.
    commitSelection() {
      if (this.index < 0 || this.index >= this.candidates.length) return
      const winner = { ...this.candidates[this.index] }
      this.winners.push(winner)
      this.candidates.splice(this.index, 1)
      this.selected = winner
      this.index = -1
      this.persistWinners()
      this.persistCandidates()
    },
    selectRandomCandidate() {
      if (this.spinning) return false
      if (this.filteredCandidates.length === 0) return false

      this.spinning = true
      this.selected = null

      const timeBeforeSlow = Math.floor(Math.random() * 300)
      let i = 0
      let delay = 10

      const tick = () => {
        this.pointToRandomCandidate()
        i += 1
        if (i > timeBeforeSlow) {
          delay += 50
        }
        if (delay < 500) {
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
