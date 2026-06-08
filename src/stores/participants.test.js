import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore, ANIMATION_TIMING } from './participants.js'

function person(firstName, lastName, extras = {}) {
  return { id: `${firstName}-${lastName}`, firstName, lastName, extras }
}

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
    expect(store.candidates[0].firstName).toBe('Alan')
    expect(store.winners).toHaveLength(1)
    expect(store.selected.firstName).toBe('Ada')
    // stored winner is a copy, not the original object reference
    expect(store.winners[0]).not.toBe(ada)
    expect(store.index).toBe(-1)
    expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(1)
  })

  it('importParticipants excludes prior winners and persists', () => {
    const store = useParticipantStore()
    store.winners = [person('Ada', 'Lovelace')]

    const result = store.importParticipants([person('Ada', 'Lovelace'), person('Alan', 'Turing')])

    expect(result).toEqual({ imported: 1, skipped: 1 })
    expect(store.candidates).toHaveLength(1)
    expect(store.candidates[0].firstName).toBe('Alan')
    expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(1)
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
      store.addCandidate({ firstName: 'Grace', lastName: 'Hopper' })

      expect(store.candidates).toHaveLength(1)
      const c = store.candidates[0]
      expect(c.firstName).toBe('Grace')
      expect(c.lastName).toBe('Hopper')
      expect(c.id).toBeTruthy()
      expect(JSON.parse(localStorage.getItem('candidates'))[0].firstName).toBe('Grace')
    })

    it('assigns distinct ids even for identical names', () => {
      const store = useParticipantStore()
      store.addCandidate({ firstName: 'Ada', lastName: 'Lovelace' })
      store.addCandidate({ firstName: 'Ada', lastName: 'Lovelace' })
      expect(store.candidates[0].id).not.toBe(store.candidates[1].id)
    })

    it('defaults extras to an empty object', () => {
      const store = useParticipantStore()
      store.addCandidate({ firstName: 'Ada', lastName: 'Lovelace' })
      expect(store.candidates[0].extras).toEqual({})
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
      expect(store.candidates[0].firstName).toBe('Alan')
      expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(1)
    })

    it('is a no-op for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.removeCandidate('ghost-id')
      expect(store.candidates).toHaveLength(1)
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
      expect(store.winners[0].firstName).toBe('Alan')
      expect(store.index).toBe(-1)
      expect(store.selected).toBeNull()
      expect(JSON.parse(localStorage.getItem('candidates'))).toHaveLength(2)
      expect(JSON.parse(localStorage.getItem('winners'))).toHaveLength(1)
    })
  })

  describe('updateCandidate', () => {
    it('patches firstName and lastName and persists', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.persistCandidates()

      store.updateCandidate('Ada-Lovelace', { firstName: 'Ada', lastName: 'Byron' })

      expect(store.candidates[0].lastName).toBe('Byron')
      expect(JSON.parse(localStorage.getItem('candidates'))[0].lastName).toBe('Byron')
    })

    it('is a no-op for an unknown id', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace')]
      store.updateCandidate('ghost-id', { firstName: 'X' })
      expect(store.candidates[0].firstName).toBe('Ada')
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
      expect(store.filteredCandidates.map((c) => c.firstName)).toEqual(['Ada', 'Grace'])
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
      expect(store.filteredCandidates[0].firstName).toBe('Ada')
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
      expect(store.filteredCandidates[0].firstName).toBe('Alan')
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
      expect(projector.filteredCandidates[0].firstName).toBe('Ada')
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
      expect(store.filteredCandidates[0].firstName).toBe('Alan')
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
      expect(store.winners[0].extras.Grade).toBe('3')
    })

    it('returns false when the filtered pool is empty', () => {
      const store = useParticipantStore()
      store.candidates = [person('Ada', 'Lovelace', { Grade: '4' })]
      store.addFilter('Grade', '3')

      expect(store.selectRandomCandidate()).toBe(false)
      expect(store.spinning).toBe(false)
    })

    it.each(['classic', 'wheel', 'reel'])(
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
      for (const style of ['classic', 'wheel', 'reel']) {
        const t = ANIMATION_TIMING[style]
        expect(t).toBeDefined()
        expect(t.baseDelay).toBeGreaterThan(0)
        expect(t.maxDelay).toBeGreaterThan(t.baseDelay)
      }
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
        expect(store.candidates[idx].extras.Grade).toBe('3')
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
      expect(store.selected.firstName).toBe('Alan')
      expect(store.candidates).toHaveLength(1)
      expect(store.candidates[0].firstName).toBe('Ada')
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
      expect(store.winners[0].firstName).toBe(expectedWinner.firstName)
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
      expect(store.winners[0].firstName).toBe('Ada')
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
  })
})
