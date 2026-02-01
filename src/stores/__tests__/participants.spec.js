import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore } from '../participants.js'

function makeCandidates(count) {
  return Array.from({ length: count }, (_, i) => ({
    'First Name': `First${i}`,
    'Last Name': `Last${i}`,
    'School Grade': `Grade${i}`,
  }))
}

describe('Participant Store', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useParticipantStore()
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('has empty candidates and winners', () => {
      expect(store.candidates).toEqual([])
      expect(store.winners).toEqual([])
    })

    it('has index of -1', () => {
      expect(store.index).toBe(-1)
    })

    it('is not spinning', () => {
      expect(store.spinning).toBe(false)
    })

    it('has multi display mode disabled', () => {
      expect(store.useMultiDisplayMode).toBe(false)
    })
  })

  describe('currentCandidate getter', () => {
    it('returns null when index is -1', () => {
      expect(store.currentCandidate).toBeNull()
    })

    it('returns the correct candidate when index is valid', () => {
      store.candidates = makeCandidates(3)
      store.index = 1
      expect(store.currentCandidate).toEqual({
        'First Name': 'First1',
        'Last Name': 'Last1',
        'School Grade': 'Grade1',
      })
    })
  })

  describe('getParticipants getter', () => {
    it('returns empty array when both candidates and winners are empty', () => {
      expect(store.getParticipants).toEqual([])
    })

    it('returns union of candidates and winners', () => {
      store.candidates = makeCandidates(2)
      store.winners = [{ 'First Name': 'W', 'Last Name': 'W', 'School Grade': 'G' }]
      expect(store.getParticipants).toHaveLength(3)
    })

    it('returns only candidates when there are no winners', () => {
      store.candidates = makeCandidates(3)
      expect(store.getParticipants).toHaveLength(3)
    })

    it('returns only winners when there are no candidates', () => {
      store.winners = makeCandidates(2)
      expect(store.getParticipants).toHaveLength(2)
    })
  })

  describe('winnerSelected getter', () => {
    it('returns false when spinning', () => {
      store.spinning = true
      store.index = 0
      expect(store.winnerSelected).toBe(false)
    })

    it('returns false when index is -1', () => {
      store.spinning = false
      store.index = -1
      expect(store.winnerSelected).toBe(false)
    })

    it('returns true when not spinning and index is valid', () => {
      store.spinning = false
      store.index = 0
      expect(store.winnerSelected).toBe(true)
    })
  })

  describe('pointToRandomCandidate', () => {
    it('sets index within valid range', () => {
      store.candidates = makeCandidates(10)
      for (let i = 0; i < 50; i++) {
        store.pointToRandomCandidate()
        expect(store.index).toBeGreaterThanOrEqual(0)
        expect(store.index).toBeLessThan(10)
      }
    })

    it('sets index to 0 with a single candidate', () => {
      store.candidates = makeCandidates(1)
      store.pointToRandomCandidate()
      expect(store.index).toBe(0)
    })
  })

  describe('selectRandomCandidate', () => {
    it('sets spinning to true when invoked', () => {
      store.candidates = makeCandidates(5)
      store.selectRandomCandidate()
      expect(store.spinning).toBe(true)
    })

    it('returns early if already spinning', () => {
      store.candidates = makeCandidates(5)
      store.spinning = true
      const candidatesBefore = [...store.candidates]
      store.selectRandomCandidate()
      // candidates unchanged since it returned early
      expect(store.candidates).toEqual(candidatesBefore)
    })

    it('removes previous winner from candidates when index > -1', () => {
      store.candidates = makeCandidates(5)
      store.index = 2
      store.selectRandomCandidate()
      expect(store.candidates).toHaveLength(4)
    })

    it('does not remove any candidate when index is -1 (first draw)', () => {
      store.candidates = makeCandidates(5)
      store.index = -1
      store.selectRandomCandidate()
      expect(store.candidates).toHaveLength(5)
    })

    it('eventually stops spinning and selects a winner', () => {
      store.candidates = makeCandidates(5)
      store.selectRandomCandidate()

      // Run all pending timers to completion
      vi.runAllTimers()

      expect(store.spinning).toBe(false)
      expect(store.winners).toHaveLength(1)
      expect(store.winners[0]).toBeDefined()
    })

    it('persists winners to localStorage after selection', () => {
      store.candidates = makeCandidates(5)
      store.selectRandomCandidate()
      vi.runAllTimers()

      const stored = JSON.parse(localStorage.getItem('winners'))
      expect(stored).toHaveLength(1)
    })

    it('can run multiple draws in sequence', () => {
      store.candidates = makeCandidates(5)

      // First draw
      store.selectRandomCandidate()
      vi.runAllTimers()
      expect(store.winners).toHaveLength(1)
      expect(store.spinning).toBe(false)

      // Second draw - should remove previous winner from candidates
      const candidatesAfterFirst = store.candidates.length
      store.selectRandomCandidate()
      vi.runAllTimers()
      expect(store.winners).toHaveLength(2)
      expect(store.candidates.length).toBe(candidatesAfterFirst - 1)
    })
  })
})
