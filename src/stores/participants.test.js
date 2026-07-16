import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore, ANIMATION_TIMING, decelTailMs } from './participants.js'
import { useSettingsStore } from './settings.js'

function person(firstName, lastName, extras = {}) {
  const fields = {}
  if (firstName) fields['First Name'] = firstName
  if (lastName) fields['Last Name'] = lastName
  Object.assign(fields, extras)
  return { id: `${firstName}-${lastName}`, fields }
}
const first = (p) => p.fields['First Name']
const last = (p) => p.fields['Last Name']

describe('participant store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('does nothing when the pool is empty', () => {
    const store = useParticipantStore()
    expect(store.selectRandomCandidate()).toBe(false)
    expect(store.spinning).toBe(false)
    expect(store.winners).toHaveLength(0)
  })

  it('pointToRandomCandidate stays in range and is -1 when empty', () => {
    const store = useParticipantStore()
    store.pointToRandomCandidate()
    expect(store.index).toBe(-1)

    store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
    for (let i = 0; i < 50; i++) {
      store.pointToRandomCandidate()
      expect(store.index).toBeGreaterThanOrEqual(0)
      expect(store.index).toBeLessThan(store.candidates.length)
    }
  })

  it('commitSelection moves a copy to winners and removes from the pool', () => {
    const store = useParticipantStore()
    const ada = person('Ada', 'Lovelace')
    store.candidates = [ada, person('Alan', 'Turing')]
    store.index = 0

    store.commitSelection()

    expect(store.candidates).toHaveLength(1)
    expect(first(store.candidates[0])).toBe('Alan')
    expect(store.winners).toHaveLength(1)
    expect(first(store.selected)).toBe('Ada')
    // stored winner is a copy, not the original object reference
    expect(store.winners[0]).not.toBe(ada)
    expect(store.winners[0].fields).not.toBe(ada.fields)
    expect(store.index).toBe(-1)
    expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(1)
  })

  it('importParticipants excludes prior winners and persists', () => {
    const store = useParticipantStore()
    store.winners = [person('Ada', 'Lovelace')]

    const result = store.importParticipants([person('Ada', 'Lovelace'), person('Alan', 'Turing')])

    expect(result).toEqual({ imported: 1, skipped: 1, merged: 0, mode: 'replace' })
    expect(store.candidates).toHaveLength(1)
    expect(first(store.candidates[0])).toBe('Alan')
    expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(1)
  })

  it('importParticipants append adds to the pool, skipping in-pool and winner dups', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]
    store.winners = [person('Grace', 'Hopper')]

    const result = store.importParticipants(
      [person('Ada', 'Lovelace'), person('Alan', 'Turing'), person('Grace', 'Hopper')],
      'append',
    )

    expect(result).toEqual({ imported: 1, skipped: 2, merged: 0, mode: 'append' })
    expect(store.candidates.map(first)).toEqual(['Ada', 'Alan'])
  })

  it('importParticipants replace swaps out the whole pool', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]

    const result = store.importParticipants([person('Alan', 'Turing')], 'replace')

    expect(result).toEqual({ imported: 1, skipped: 0, merged: 0, mode: 'replace' })
    expect(store.candidates.map(first)).toEqual(['Alan'])
  })

  it('loadFromStorage reads persisted state', () => {
    localStorage.setItem('candidates', JSON.stringify([person('Ada', 'Lovelace')]))
    localStorage.setItem('winners', JSON.stringify([person('Alan', 'Turing')]))
    localStorage.setItem('useMultiDisplayMode', 'true')

    const store = useParticipantStore()
    store.loadFromStorage()

    expect(store.candidates).toHaveLength(1)
    expect(store.winners).toHaveLength(1)
    expect(store.useMultiDisplayMode).toBe(true)
  })

  it('loadFromStorage migrates legacy { firstName, lastName, extras } records', () => {
    localStorage.setItem(
      'candidates',
      JSON.stringify([{ id: '1', firstName: 'Ada', lastName: 'Lovelace', extras: { Grade: '3' } }]),
    )
    const store = useParticipantStore()
    store.loadFromStorage()
    expect(store.candidates[0].fields).toEqual({
      'First Name': 'Ada',
      'Last Name': 'Lovelace',
      Grade: '3',
    })
  })

  it('resetCandidates and resetWinners clear state and storage', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]
    store.winners = [person('Alan', 'Turing')]
    store.persistCandidates()
    store.persistWinners()

    store.resetCandidates()
    store.resetWinners()

    expect(store.candidates).toHaveLength(1) // Alan restored from winners
    expect(store.winners).toHaveLength(0)
    expect(localStorage.getItem('candidates')).toBeTruthy() // Alan persisted
    expect(localStorage.getItem('winners')).toBeTruthy() // empty winners array persisted
  })

  describe('addCandidate', () => {
    it('appends a participant with a generated id and persists', () => {
      const store = useParticipantStore()
      store.addCandidate({ 'First Name': 'Grace', 'Last Name': 'Hopper' })

      expect(store.candidates).toHaveLength(1)
      const c = store.candidates[0]
      expect(first(c)).toBe('Grace')
      expect(last(c)).toBe('Hopper')
      expect(c.id).toBeTruthy()
      expect(JSON.parse(localStorage.getItem('candidates'))[0].fields['First Name']).toBe('Grace')
    })

    it('assigns distinct ids even for identical names', () => {
      const store = useParticipantStore()
      store.addCandidate({ 'First Name': 'Ada', 'Last Name': 'Lovelace' })
      store.addCandidate({ 'First Name': 'Ada', 'Last Name': 'Lovelace' })
      expect(store.candidates[0].id).not.toBe(store.candidates[1].id)
    })

    it('defaults to an empty fields object when none given', () => {
      const store = useParticipantStore()
      store.addCandidate()
      expect(store.candidates[0].fields).toEqual({})
    })

    it('defaults entries to 1 but honors an explicit count', () => {
      const store = useParticipantStore()
      store.addCandidate({ Name: 'Ada' })
      store.addCandidate({ Name: 'Grace' }, 5)
      expect(store.candidates[0].entries).toBe(1)
      expect(store.candidates[1].entries).toBe(5)
    })
  })

  describe('removeCandidate', () => {
    it('removes the matching candidate by id and persists', () => {
      const store = useParticipantStore()
      const ada = person('Ada', 'Lovelace')
      const alan = person('Alan', 'Turing')
      store.candidates = [ada, alan]

      store.removeCandidate(ada.id)

      expect(store.candidates).toHaveLength(1)
      expect(first(store.candidates[0])).toBe('Alan')
      expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(1)
    })

    it('is a no-op for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.removeCandidate('ghost-id')
      expect(store.candidates).toHaveLength(1)
    })
  })

  describe('insertCandidate', () => {
    it('restores a removed candidate at its original index and persists', () => {
      const store = useParticipantStore()
      const ada = person('Ada', 'Lovelace')
      const alan = person('Alan', 'Turing')
      const grace = person('Grace', 'Hopper')
      store.candidates = [ada, alan, grace]

      const index = store.candidates.findIndex((c) => c.id === alan.id)
      store.removeCandidate(alan.id)
      store.insertCandidate(alan, index)

      expect(store.candidates.map(first)).toEqual(['Ada', 'Alan', 'Grace'])
      expect(JSON.parse(localStorage.getItem('candidates'))[1].fields['First Name']).toBe('Alan')
    })

    it('clamps an out-of-range index to the end of the list', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.insertCandidate(person('Grace', 'Hopper'), 99)
      expect(store.candidates.map(first)).toEqual(['Ada', 'Grace'])
    })
  })

  describe('importState', () => {
    it('replaces candidates and winners, resets draw state, and persists both', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.index = 0
      store.selected = person('old', 'winner')

      const newCandidates = [person('Grace', 'Hopper'), person('Linus', 'Torvalds')]
      const newWinners = [person('Alan', 'Turing')]
      store.importState({ candidates: newCandidates, winners: newWinners })

      expect(store.candidates).toHaveLength(2)
      expect(store.winners).toHaveLength(1)
      expect(first(store.winners[0])).toBe('Alan')
      expect(store.index).toBe(-1)
      expect(store.selected).toBeNull()
      expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(2)
      expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(1)
    })
  })

  describe('updateCandidate', () => {
    it('merges field patches and persists', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.persistCandidates()

      store.updateCandidate('Ada-Lovelace', { fields: { 'Last Name': 'Byron' } })

      expect(last(store.candidates[0])).toBe('Byron')
      expect(first(store.candidates[0])).toBe('Ada') // untouched field preserved
      expect(JSON.parse(localStorage.getItem('candidates'))[0].fields['Last Name']).toBe('Byron')
    })

    it('is a no-op for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.updateCandidate('ghost-id', { fields: { 'First Name': 'X' } })
      expect(first(store.candidates[0])).toBe('Ada')
    })
  })

  describe('filter', () => {
    it('filteredCandidates returns all candidates when no filters are set', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      expect(store.filteredCandidates).toHaveLength(2)
    })

    it('filters by a single field', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
        person('Grace', 'Hopper', { Grade: '3' }),
      ]
      store.addFilter('Grade', '3')
      expect(store.filteredCandidates).toHaveLength(2)
      expect(store.filteredCandidates.map(first)).toEqual(['Ada', 'Grace'])
    })

    it('filters by multiple fields simultaneously (AND logic)', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' }),
        person('Alan', 'Turing', { Grade: '3', Bus: '7A' }),
        person('Grace', 'Hopper', { Grade: '4', Bus: '12B' }),
      ]
      store.addFilter('Grade', '3')
      store.addFilter('Bus', '12B')
      expect(store.filteredCandidates).toHaveLength(1)
      expect(first(store.filteredCandidates[0])).toBe('Ada')
    })

    it('addFilter replaces an existing filter for the same key', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      store.addFilter('Grade', '3')
      store.addFilter('Grade', '4')
      expect(store.filters).toHaveLength(1)
      expect(store.filteredCandidates).toHaveLength(1)
      expect(first(store.filteredCandidates[0])).toBe('Alan')
    })

    it('removeFilter removes only the specified field', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' }),
        person('Alan', 'Turing', { Grade: '3', Bus: '7A' }),
      ]
      store.addFilter('Grade', '3')
      store.addFilter('Bus', '12B')
      store.removeFilter('Bus')
      expect(store.filters).toHaveLength(1)
      expect(store.filteredCandidates).toHaveLength(2)
    })

    it('clearFilters restores the full candidate pool', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      store.addFilter('Grade', '3')
      store.clearFilters()
      expect(store.filteredCandidates).toHaveLength(2)
    })

    it('resetCandidates also clears all filters', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '3' })]
      store.addFilter('Grade', '3')
      store.resetCandidates()
      expect(store.filters).toHaveLength(0)
    })

    it('addFilter / removeFilter / clearFilters persist to localStorage', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '3', Bus: '12B' })]

      store.addFilter('Grade', '3')
      store.addFilter('Bus', '12B')
      expect(JSON.parse(localStorage.getItem('filters'))).toEqual([
        { key: 'Grade', value: '3' },
        { key: 'Bus', value: '12B' },
      ])

      store.removeFilter('Bus')
      expect(JSON.parse(localStorage.getItem('filters'))).toEqual([{ key: 'Grade', value: '3' }])

      store.clearFilters()
      expect(JSON.parse(localStorage.getItem('filters'))).toEqual([])
    })

    it('resetCandidates clears the persisted filters key', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '3' })]
      store.addFilter('Grade', '3')
      store.resetCandidates()
      expect(localStorage.getItem('filters')).toBeNull()
    })

    it('a fresh store (projector window) loads persisted filters and applies them', () => {
      // Simulate the admin window setting a filter and persisting it.
      const admin = useParticipantStore()
      admin.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      admin.persistCandidates()
      admin.addFilter('Grade', '3')

      // A separate window mounts its own store and loads from storage.
      setActivePinia(createPinia())
      const projector = useParticipantStore()
      projector.loadFromStorage()
      expect(projector.filters).toEqual([{ key: 'Grade', value: '3' }])
      expect(projector.filteredCandidates).toHaveLength(1)
      expect(first(projector.filteredCandidates[0])).toBe('Ada')
    })

    it('loadFilters reloads only filters from storage without touching candidates', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      // Another window wrote a filter after this store was set up.
      localStorage.setItem('filters', JSON.stringify([{ key: 'Grade', value: '4' }]))
      store.loadFilters()
      expect(store.candidates).toHaveLength(2)
      expect(store.filteredCandidates).toHaveLength(1)
      expect(first(store.filteredCandidates[0])).toBe('Alan')
    })
  })

  describe('full draw with fake timers', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('runs the spin animation and produces exactly one winner', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace'),
        person('Alan', 'Turing'),
        person('Grace', 'Hopper'),
      ]

      expect(store.selectRandomCandidate()).toBe(true)
      expect(store.spinning).toBe(true)

      vi.runAllTimers()

      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(1)
      expect(store.candidates).toHaveLength(2)
      expect(store.selected).not.toBeNull()
    })

    it('respects the active filter — winner always comes from the filtered pool', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
        person('Grace', 'Hopper', { Grade: '3' }),
      ]
      store.addFilter('Grade', '3')

      expect(store.selectRandomCandidate()).toBe(true)
      vi.runAllTimers()

      expect(store.winners).toHaveLength(1)
      expect(store.winners[0].fields.Grade).toBe('3')
    })

    it('returns false when the filtered pool is empty', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '4' })]
      store.addFilter('Grade', '3')

      expect(store.selectRandomCandidate()).toBe(false)
      expect(store.spinning).toBe(false)
    })

    it.each(['classic', 'wheel'])(
      'runs to completion under the %s animation style',
      (style) => {
        const store = useParticipantStore()
        store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

        expect(store.selectRandomCandidate(style)).toBe(true)
        vi.runAllTimers()
        expect(store.spinning).toBe(false)
        expect(store.winners).toHaveLength(1)
      },
    )

    it('falls back to classic timing for an unknown style', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      // The picker should not throw; the spin completes like classic.
      expect(store.selectRandomCandidate('made-up')).toBe(true)
      vi.runAllTimers()
      expect(store.winners).toHaveLength(1)
    })

    it('a finite durationMs draw completes and commits one winner', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

      expect(store.selectRandomCandidate('classic', { durationMs: 300 })).toBe(true)
      expect(store.spinning).toBe(true)
      vi.runAllTimers()
      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(1)
    })

    it('a manual draw keeps spinning until requestManualStop, then commits', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

      expect(store.selectRandomCandidate('classic', { durationMs: Infinity })).toBe(true)
      expect(store.spinning).toBe(true)

      // Free-spin: still going after a long time with no stop requested.
      vi.advanceTimersByTime(10000)
      expect(store.spinning).toBe(true)
      expect(store.winners).toHaveLength(0)

      // Operator stops it — the spin decelerates and commits exactly one winner.
      store.requestManualStop()
      vi.runAllTimers()
      expect(store.spinning).toBe(false)
      expect(store.manualStop).toBe(false)
      expect(store.winners).toHaveLength(1)
    })

    it('selectSpecificCandidate honors manual timing and lands the target', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

      expect(store.selectSpecificCandidate('Alan-Turing', 'classic', { durationMs: Infinity })).toBe(
        true,
      )
      vi.advanceTimersByTime(8000)
      expect(store.spinning).toBe(true)

      store.requestManualStop()
      vi.runAllTimers()
      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(1)
      expect(store.winners[0].id).toBe('Alan-Turing')
    })

    it('committing a draw clears any prior reset-undo snapshot', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.winners = [person('Alan', 'Turing')]
      store.resetWinners()
      expect(store.lastResetWinners).not.toBeNull()

      store.selectRandomCandidate()
      vi.runAllTimers()
      expect(store.lastResetWinners).toBeNull()
    })
  })

  describe('animation timing table', () => {
    it('exposes a timing entry for every supported style', () => {
      for (const style of ['classic', 'wheel']) {
        const t = ANIMATION_TIMING[style]
        expect(t).toBeDefined()
        expect(t.baseDelay).toBeGreaterThan(0)
        expect(t.maxDelay).toBeGreaterThan(t.baseDelay)
      }
    })

    it('decelTailMs sums the slow-down delays for a timing curve', () => {
      // classic: delays 60,110,…,460 before the 510 tick exceeds maxDelay(500).
      expect(decelTailMs(ANIMATION_TIMING.classic)).toBe(2340)
      // Always positive and shorter than maxDelay × a handful of ticks.
      expect(decelTailMs(ANIMATION_TIMING.wheel)).toBeGreaterThan(0)
    })
  })

  describe('visual-spin (wheel) flow', () => {
    it('pickWinnerIndex returns a valid index from the filtered pool without mutating', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
        person('Grace', 'Hopper', { Grade: '3' }),
      ]
      store.addFilter('Grade', '3')

      for (let i = 0; i < 50; i++) {
        const idx = store.pickWinnerIndex()
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(store.candidates.length)
        // Must point at someone who matches the filter.
        expect(store.candidates[idx].fields.Grade).toBe('3')
      }
      // No mutation of running spin state.
      expect(store.spinning).toBe(false)
      expect(store.selected).toBeNull()
      expect(store.index).toBe(-1)
    })

    it('pickWinnerIndex returns -1 when the filtered pool is empty', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '4' })]
      store.addFilter('Grade', '3')
      expect(store.pickWinnerIndex()).toBe(-1)
    })

    it('beginVisualSpin gates on spinning and pool emptiness', () => {
      const store = useParticipantStore()
      expect(store.beginVisualSpin()).toBe(false) // empty pool

      store.candidates = [person('Ada', 'Lovelace')]
      expect(store.beginVisualSpin()).toBe(true)
      expect(store.spinning).toBe(true)
      // Already spinning — second call refuses.
      expect(store.beginVisualSpin()).toBe(false)
    })

    it('beginVisualSpin clears any prior reset-undo', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.winners = [person('Alan', 'Turing')]
      store.resetWinners()
      expect(store.lastResetWinners).not.toBeNull()

      store.beginVisualSpin()
      expect(store.lastResetWinners).toBeNull()
    })

    it('commitAt commits the specified candidate and clears spinning', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      store.beginVisualSpin()

      expect(store.commitAt(1)).toBe(true)
      expect(store.spinning).toBe(false)
      expect(first(store.selected)).toBe('Alan')
      expect(store.candidates).toHaveLength(1)
      expect(first(store.candidates[0])).toBe('Ada')
    })

    it('commitAt with an out-of-range index bails cleanly and still clears spinning', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.beginVisualSpin()

      expect(store.commitAt(-1)).toBe(false)
      expect(store.spinning).toBe(false)
      expect(store.selected).toBeNull()
      expect(store.candidates).toHaveLength(1)
    })

    it('end-to-end wheel flow: pick → begin → commit produces exactly one winner', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace'),
        person('Alan', 'Turing'),
        person('Grace', 'Hopper'),
      ]
      expect(store.beginVisualSpin()).toBe(true)
      const idx = store.pickWinnerIndex()
      expect(idx).toBeGreaterThanOrEqual(0)
      const expectedWinner = store.candidates[idx]
      // No timers needed — the visual layer drives timing in real code.
      expect(store.commitAt(idx)).toBe(true)
      expect(store.winners).toHaveLength(1)
      expect(first(store.winners[0])).toBe(first(expectedWinner))
      expect(store.candidates).toHaveLength(2)
    })
  })

  describe('reset / undo', () => {
    it('undoResetCandidates restores candidates and filters and re-persists', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      store.addFilter('Grade', '3')
      store.persistCandidates()

      store.resetCandidates()
      expect(store.candidates).toHaveLength(0)
      expect(store.filters).toHaveLength(0)
      expect(localStorage.getItem('candidates')).toBeNull()

      expect(store.undoResetCandidates()).toBe(true)
      expect(store.candidates).toHaveLength(2)
      expect(store.filters).toEqual([{ key: 'Grade', value: '3' }])
      expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(2)
      // Undo is single-use.
      expect(store.lastResetCandidates).toBeNull()
      expect(store.undoResetCandidates()).toBe(false)
    })

    it('undoResetWinners restores winners and re-persists', () => {
      const store = useParticipantStore()
      store.winners = [person('Ada', 'Lovelace')]
      store.persistWinners()

      store.resetWinners()
      expect(store.winners).toHaveLength(0)

      expect(store.undoResetWinners()).toBe(true)
      expect(store.winners).toHaveLength(1)
      expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(1)
    })

    it('snapshot is a deep copy — mutating winners after reset does not bleed into the snapshot', () => {
      const store = useParticipantStore()
      store.winners = [person('Ada', 'Lovelace', { Grade: '3' })]
      store.resetWinners()
      // simulate other code mutating the now-empty winners array
      store.winners.push(person('Mallory', 'Mutant'))

      store.undoResetWinners()
      expect(store.winners).toHaveLength(1)
      expect(first(store.winners[0])).toBe('Ada')
    })

    it("resetWinners('return') moves winners back into the candidate pool", () => {
      const store = useParticipantStore()
      store.candidates = [person('Grace', 'Hopper')]
      store.winners = [person('Ada', 'Lovelace')]

      store.resetWinners('return')
      expect(store.winners).toHaveLength(0)
      expect(store.candidates).toHaveLength(2)

      // Undo pulls them back out of candidates and restores winners.
      expect(store.undoResetWinners()).toBe(true)
      expect(store.winners.map(first)).toEqual(['Ada'])
      expect(store.candidates.map(first)).toEqual(['Grace'])
    })

    it("resetWinners('remove') clears winners without touching candidates", () => {
      const store = useParticipantStore()
      store.candidates = [person('Grace', 'Hopper')]
      store.winners = [person('Ada', 'Lovelace')]

      store.resetWinners('remove')
      expect(store.winners).toHaveLength(0)
      expect(store.candidates).toHaveLength(1)
      expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(0)

      // Undo restores winners exactly; candidates stay untouched.
      expect(store.undoResetWinners()).toBe(true)
      expect(store.winners.map(first)).toEqual(['Ada'])
      expect(store.candidates).toHaveLength(1)
      // Undo is single-use.
      expect(store.undoResetWinners()).toBe(false)
    })

    it('importParticipants clears any pending candidates-undo', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.resetCandidates()
      expect(store.lastResetCandidates).not.toBeNull()

      store.importParticipants([person('Grace', 'Hopper')])
      expect(store.lastResetCandidates).toBeNull()
    })

    it('importState clears both undo snapshots', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.winners = [person('Alan', 'Turing')]
      store.resetCandidates()
      store.resetWinners()
      expect(store.lastResetCandidates).not.toBeNull()
      expect(store.lastResetWinners).not.toBeNull()

      store.importState({ candidates: [person('Grace', 'Hopper')], winners: [] })
      expect(store.lastResetCandidates).toBeNull()
      expect(store.lastResetWinners).toBeNull()
    })

    it('importState clears active filters and persists the cleared state', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace', { Grade: '3' }),
        person('Alan', 'Turing', { Grade: '4' }),
      ]
      store.addFilter('Grade', '3')
      expect(store.filters).toHaveLength(1)

      store.importState({ candidates: [person('Grace', 'Hopper')], winners: [] })
      expect(store.filters).toHaveLength(0)
      expect(JSON.parse(localStorage.getItem('filters'))).toEqual([])
      // filteredCandidates should now return the full imported pool.
      expect(store.filteredCandidates).toHaveLength(1)
      expect(first(store.filteredCandidates[0])).toBe('Grace')
    })
  })

  describe('weighted entries', () => {
    const weighted = (name, entries, extra = {}) => ({
      id: name,
      fields: { Name: name, ...extra },
      entries,
    })

    it('totalEntries sums per-candidate weights over the filtered pool', () => {
      const store = useParticipantStore()
      store.candidates = [weighted('A', 1), weighted('B', 3), weighted('C', 0)]
      expect(store.totalEntries).toBe(4)
    })

    it('weightedPick lands in the band proportional to entries', () => {
      const store = useParticipantStore()
      store.candidates = [weighted('A', 1), weighted('B', 3)] // total 4
      const rnd = vi.spyOn(Math, 'random')
      rnd.mockReturnValue(0.1) // r = 0.4 → A
      expect(store.weightedPick(store.candidates).id).toBe('A')
      rnd.mockReturnValue(0.5) // r = 2.0 → B
      expect(store.weightedPick(store.candidates).id).toBe('B')
      rnd.mockRestore()
    })

    it('skews draws toward higher-entry candidates', () => {
      const store = useParticipantStore()
      store.candidates = [weighted('Low', 1), weighted('High', 9)] // 10% vs 90%
      const counts = { Low: 0, High: 0 }
      for (let i = 0; i < 2000; i++) counts[store.weightedPick(store.candidates).id] += 1
      expect(counts.High).toBeGreaterThan(counts.Low * 3)
    })

    it('never picks a 0-entry candidate', () => {
      const store = useParticipantStore()
      store.candidates = [weighted('Zero', 0), weighted('One', 1)]
      for (let i = 0; i < 100; i++) {
        expect(store.weightedPick(store.candidates).id).toBe('One')
      }
    })

    it('returns null and bails the draw when total entries is 0', () => {
      const store = useParticipantStore()
      store.candidates = [weighted('Zero', 0)]
      expect(store.weightedPick(store.candidates)).toBeNull()
      expect(store.totalEntries).toBe(0)
      expect(store.selectRandomCandidate()).toBe(false)
      expect(store.beginVisualSpin()).toBe(false)
      store.pointToRandomCandidate()
      expect(store.index).toBe(-1)
      expect(store.pickWinnerIndex()).toBe(-1)
    })

    it('treats a missing entries property as a single entry (uniform draw)', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      expect(store.totalEntries).toBe(2)
    })
  })

  describe('importParticipants accumulate', () => {
    const checkin = (name, entries = 1) => ({ id: name, fields: { Name: name }, entries })

    it('adds entries to a returning person matched by content key', () => {
      const store = useParticipantStore()
      store.importParticipants([checkin('Ada'), checkin('Alan')], 'replace')
      const result = store.importParticipants([checkin('Ada'), checkin('Grace')], 'accumulate')
      expect(result).toMatchObject({ imported: 1, merged: 1, skipped: 0, mode: 'accumulate' })
      const ada = store.candidates.find((c) => c.fields.Name === 'Ada')
      expect(ada.entries).toBe(2)
      expect(store.candidates.map((c) => c.fields.Name)).toEqual(['Ada', 'Alan', 'Grace'])
    })

    it('matches returning people by imported id, not by displayed fields', () => {
      const store = useParticipantStore()
      const day1 = [{ id: 'u1', externalId: true, fields: { Name: 'John Smith' }, entries: 1 }]
      store.importParticipants(day1, 'replace')
      // Same id, different fields → still the same person.
      const day2 = [
        { id: 'u1', externalId: true, fields: { Name: 'John Smith', Note: 'x' }, entries: 1 },
      ]
      const result = store.importParticipants(day2, 'accumulate')
      expect(result.merged).toBe(1)
      expect(store.candidates).toHaveLength(1)
      expect(store.candidates[0].entries).toBe(2)
    })

    it('skips prior winners rather than accumulating onto them', () => {
      const store = useParticipantStore()
      store.candidates = [checkin('Ada')]
      store.winners = [checkin('Grace')]
      const result = store.importParticipants([checkin('Grace'), checkin('Ada')], 'accumulate')
      expect(result.skipped).toBe(1) // Grace (a prior winner)
      expect(result.merged).toBe(1) // Ada
      const ada = store.candidates.find((c) => c.fields.Name === 'Ada')
      expect(ada.entries).toBe(2)
    })
  })

  describe('manuallySelectWinner', () => {
    it('moves participant to winners and removes from candidates', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      const result = store.manuallySelectWinner('Ada-Lovelace')
      expect(result).toBe(true)
      expect(store.winners).toHaveLength(1)
      expect(store.winners[0].fields['First Name']).toBe('Ada')
      expect(store.candidates).toHaveLength(1)
      expect(store.candidates[0].fields['First Name']).toBe('Alan')
    })

    it('sets store.selected to the winner', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.manuallySelectWinner('Ada-Lovelace')
      expect(store.selected).not.toBeNull()
      expect(store.selected.fields['First Name']).toBe('Ada')
    })

    it('returns false for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      expect(store.manuallySelectWinner('nobody')).toBe(false)
      expect(store.winners).toHaveLength(0)
    })

    it('does not affect spinning state', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.manuallySelectWinner('Ada-Lovelace')
      expect(store.spinning).toBe(false)
    })
  })

  describe('selectSpecificCandidate', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('commits the forced participant after the animation', () => {
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace'),
        person('Alan', 'Turing'),
        person('Grace', 'Hopper'),
      ]
      expect(store.selectSpecificCandidate('Grace-Hopper')).toBe(true)
      expect(store.spinning).toBe(true)
      vi.runAllTimers()
      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(1)
      expect(store.winners[0].fields['First Name']).toBe('Grace')
      expect(store.candidates).toHaveLength(2)
    })

    it('returns false for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      expect(store.selectSpecificCandidate('nobody')).toBe(false)
      expect(store.spinning).toBe(false)
    })

    // Regression: the GO button bound `@click="startDraw"`, which passed the
    // click event as startDraw's `targetId`, reaching selectSpecificCandidate
    // with a PointerEvent instead of an id — no candidate matched, so the draw
    // silently never ran. The store must reject a non-id target (it does), and
    // the no-arg random path (what `@click="startDraw()"` now uses) must run.
    it('does not draw when handed a non-id target (e.g. a click event)', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      const eventLikeTarget = { type: 'click', isTrusted: true } // a PointerEvent never === an id
      expect(store.selectSpecificCandidate(eventLikeTarget)).toBe(false)
      expect(store.spinning).toBe(false)
      // The correct no-arg path starts a real (random) draw.
      expect(store.selectRandomCandidate()).toBe(true)
      expect(store.spinning).toBe(true)
      vi.runAllTimers()
    })

    it('returns false while already spinning', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      store.selectSpecificCandidate('Ada-Lovelace')
      expect(store.selectSpecificCandidate('Alan-Turing')).toBe(false)
      vi.runAllTimers()
    })

    it('handles participant disappearing mid-animation gracefully', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      store.selectSpecificCandidate('Alan-Turing')
      // Remove the target before the animation ends
      store.candidates = [person('Ada', 'Lovelace')]
      vi.runAllTimers()
      // commitSelection bails when index is -1; no crash, no winner added
      expect(store.winners).toHaveLength(0)
    })
  })

  describe('commitSelection — multi-win mode and win cap', () => {
    it("'odds' mode (default) removes participant entirely on win", () => {
      const store = useParticipantStore()
      store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 3 }]
      store.index = 0
      store.commitSelection()
      expect(store.candidates).toHaveLength(0)
      expect(store.winners).toHaveLength(1)
    })

    it("'multi-win' mode decrements entries and keeps participant in pool", () => {
      const store = useParticipantStore()
      const settings = useSettingsStore()
      settings.participantList.entriesMode = 'multi-win'
      store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 3 }]
      store.index = 0
      store.commitSelection()
      expect(store.candidates).toHaveLength(1)
      expect(store.candidates[0].entries).toBe(2)
      expect(store.winners).toHaveLength(1)
    })

    it("'multi-win' mode removes participant when last entry is consumed", () => {
      const store = useParticipantStore()
      const settings = useSettingsStore()
      settings.participantList.entriesMode = 'multi-win'
      store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 1 }]
      store.index = 0
      store.commitSelection()
      expect(store.candidates).toHaveLength(0)
    })

    it('win cap removes participant once cap is reached in multi-win mode', () => {
      const store = useParticipantStore()
      const settings = useSettingsStore()
      settings.participantList.entriesMode = 'multi-win'
      settings.participantList.maxWinsPerParticipant = 2
      store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 5 }]

      // First win: stays in pool (1 win so far, cap = 2)
      store.index = 0
      store.commitSelection()
      expect(store.candidates).toHaveLength(1)
      expect(store.candidates[0].entries).toBe(4)

      // Second win: removed (2 wins = cap reached)
      store.index = 0
      store.commitSelection()
      expect(store.candidates).toHaveLength(0)
      expect(store.winners).toHaveLength(2)
    })

    it('win cap in odds mode has no effect (already removed on win)', () => {
      const store = useParticipantStore()
      const settings = useSettingsStore()
      settings.participantList.maxWinsPerParticipant = 3
      store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 5 }]
      store.index = 0
      store.commitSelection()
      // 'odds' mode: removed immediately regardless of cap
      expect(store.candidates).toHaveLength(0)
    })
  })

  describe('batch draws (multi-winner)', () => {
    it('beginDrawBatch clears the roster; each commit appends to it', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      store.beginDrawBatch()
      expect(store.lastDrawWinners).toEqual([])
      store.index = 0
      store.commitSelection()
      store.index = 0
      store.commitSelection()
      expect(store.lastDrawWinners.map(first)).toEqual(['Ada', 'Alan'])
      store.endDrawBatch()
      // The roster survives endDrawBatch (it drives the end-of-batch display)…
      expect(store.lastDrawWinners).toHaveLength(2)
      // …and the next batch starts fresh.
      store.beginDrawBatch()
      expect(store.lastDrawWinners).toEqual([])
      store.endDrawBatch()
    })

    it('excludes in-batch winners from later picks in multi-win mode, only while active', () => {
      const store = useParticipantStore()
      const settings = useSettingsStore()
      settings.participantList.entriesMode = 'multi-win'
      store.candidates = [
        { ...person('Ada', 'Lovelace'), entries: 5 },
        { ...person('Alan', 'Turing'), entries: 1 },
      ]
      store.beginDrawBatch()
      store.index = 0
      store.commitSelection()
      // Ada stays in the pool (multi-win, 4 entries left) but is excluded from
      // this batch's drawable pool — only Alan can win the next spin.
      expect(store.candidates).toHaveLength(2)
      expect(store.drawableCandidates.map(first)).toEqual(['Alan'])
      expect(store.totalEntries).toBe(1)
      store.endDrawBatch()
      // Once the batch ends she is drawable again.
      expect(store.drawableCandidates.map(first)).toEqual(['Ada', 'Alan'])
      expect(store.totalEntries).toBe(5)
    })

    it('a 3-winner odds batch yields 3 distinct winners via sequential spins', () => {
      vi.useFakeTimers()
      const store = useParticipantStore()
      store.candidates = [
        person('Ada', 'Lovelace'),
        person('Alan', 'Turing'),
        person('Grace', 'Hopper'),
        person('Edsger', 'Dijkstra'),
        person('Donald', 'Knuth'),
      ]
      store.beginDrawBatch()
      for (let i = 0; i < 3; i += 1) {
        expect(store.selectRandomCandidate('classic', { durationMs: 1000 })).toBe(true)
        vi.runAllTimers()
      }
      store.endDrawBatch()
      expect(store.lastDrawWinners).toHaveLength(3)
      expect(store.winners).toHaveLength(3)
      expect(store.candidates).toHaveLength(2)
      const names = store.lastDrawWinners.map(first)
      expect(new Set(names).size).toBe(3)
      vi.useRealTimers()
    })

    it('onDone fires after the winner is committed', () => {
      vi.useFakeTimers()
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      let winnersAtDone = -1
      let spinningAtDone = null
      store.selectRandomCandidate('classic', {
        durationMs: 1000,
        onDone: () => {
          winnersAtDone = store.winners.length
          spinningAtDone = store.spinning
        },
      })
      vi.runAllTimers()
      expect(winnersAtDone).toBe(1)
      expect(spinningAtDone).toBe(false)
      vi.useRealTimers()
    })

    it('an exhausted pool refuses further spins (batch shortfall)', () => {
      vi.useFakeTimers()
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
      store.beginDrawBatch()
      for (let i = 0; i < 2; i += 1) {
        expect(store.selectRandomCandidate('classic', { durationMs: 1000 })).toBe(true)
        vi.runAllTimers()
      }
      // Third spin of a "draw 5" batch: nothing left to draw.
      expect(store.selectRandomCandidate('classic', { durationMs: 1000 })).toBe(false)
      store.endDrawBatch()
      expect(store.lastDrawWinners).toHaveLength(2)
      vi.useRealTimers()
    })

    describe('pickWinnerIds', () => {
      it('returns n distinct ids without mutating any state', () => {
        const store = useParticipantStore()
        store.candidates = [
          person('Ada', 'Lovelace'),
          person('Alan', 'Turing'),
          person('Grace', 'Hopper'),
        ]
        const before = JSON.stringify(store.candidates)
        const ids = store.pickWinnerIds(3)
        expect(ids).toHaveLength(3)
        expect(new Set(ids).size).toBe(3)
        expect(JSON.stringify(store.candidates)).toBe(before)
        expect(store.winners).toHaveLength(0)
        expect(store.selected).toBeNull()
      })

      it('returns fewer ids when the pool runs short', () => {
        const store = useParticipantStore()
        store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
        expect(store.pickWinnerIds(5)).toHaveLength(2)
        expect(store.pickWinnerIds(0)).toHaveLength(0)
      })

      it('skips zero-entry participants and same-identity duplicates', () => {
        const store = useParticipantStore()
        store.candidates = [
          { ...person('Ada', 'Lovelace'), entries: 1 },
          { ...person('Alan', 'Turing'), entries: 0 },
          // Same identity as Ada under a different id — only one may win.
          { ...person('Ada', 'Lovelace'), id: 'ada-duplicate' },
        ]
        const ids = store.pickWinnerIds(3)
        expect(ids).toHaveLength(1)
      })
    })

    describe('commitWinnerById', () => {
      it('commits by id with odds-mode removal and appends to the roster', () => {
        const store = useParticipantStore()
        store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]
        store.beginDrawBatch()
        expect(store.commitWinnerById('Alan-Turing')).toBe(true)
        expect(store.winners.map(first)).toEqual(['Alan'])
        expect(store.candidates.map(first)).toEqual(['Ada'])
        expect(store.lastDrawWinners.map(first)).toEqual(['Alan'])
        expect(first(store.selected)).toBe('Alan')
        store.endDrawBatch()
      })

      it('decrements entries in multi-win mode, same as commitSelection', () => {
        const store = useParticipantStore()
        const settings = useSettingsStore()
        settings.participantList.entriesMode = 'multi-win'
        store.candidates = [{ ...person('Ada', 'Lovelace'), entries: 3 }]
        expect(store.commitWinnerById('Ada-Lovelace')).toBe(true)
        expect(store.candidates).toHaveLength(1)
        expect(store.candidates[0].entries).toBe(2)
      })

      it('returns false for an unknown id', () => {
        const store = useParticipantStore()
        store.candidates = [person('Ada', 'Lovelace')]
        expect(store.commitWinnerById('nobody')).toBe(false)
        expect(store.winners).toHaveLength(0)
      })
    })

    it('endVisualSpin clears spinning without committing', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      expect(store.beginVisualSpin()).toBe(true)
      expect(store.spinning).toBe(true)
      store.endVisualSpin()
      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(0)
    })
  })
})
