import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore } from './participants.js'
import { useSettingsStore } from './settings.js'
import { broadcastSync } from '../utils/sync.js'

// Persisting state must poke other tabs to reload (multi-display live sync).
vi.mock('../utils/sync.js', () => ({
  broadcastSync: vi.fn(),
  postTrigger: vi.fn(),
  onChannelMessage: vi.fn(() => () => {}),
  normalizeChannelMessage: vi.fn((m) => m),
  closeSyncChannel: vi.fn(),
}))

const person = (firstName, lastName) => ({
  id: `${firstName}-${lastName}`,
  fields: { 'First Name': firstName, 'Last Name': lastName },
})

describe('store persistence broadcasts sync messages', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('participant persistence emits a participants sync', () => {
    const store = useParticipantStore()
    store.addCandidate({ 'First Name': 'Ada', 'Last Name': 'Lovelace' })
    expect(broadcastSync).toHaveBeenCalledWith('participants')
  })

  it('filter persistence emits a participants sync', () => {
    const store = useParticipantStore()
    store.addFilter('Grade', '3')
    expect(broadcastSync).toHaveBeenCalledWith('participants')
  })

  it('resetCandidates emits even though it bypasses the persist helpers', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]
    vi.clearAllMocks()
    store.resetCandidates()
    expect(broadcastSync).toHaveBeenCalledWith('participants')
  })

  it('committing a winner emits (admin tab sees the new winner live)', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]
    vi.clearAllMocks()
    store.beginVisualSpin()
    store.commitAt(0)
    expect(broadcastSync).toHaveBeenCalledWith('participants')
  })

  it('settings persistence emits a settings sync', () => {
    const settings = useSettingsStore()
    settings.updateTheme({ primary: '#000000' })
    expect(broadcastSync).toHaveBeenCalledWith('settings')
  })

  it('resetSettings emits a settings sync', () => {
    const settings = useSettingsStore()
    settings.resetSettings()
    expect(broadcastSync).toHaveBeenCalledWith('settings')
  })

  it('loading from storage does not emit (no echo loops)', () => {
    const store = useParticipantStore()
    const settings = useSettingsStore()
    vi.clearAllMocks()
    store.loadFromStorage()
    settings.loadFromStorage()
    expect(broadcastSync).not.toHaveBeenCalled()
  })
})
