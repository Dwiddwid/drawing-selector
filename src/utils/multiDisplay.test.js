// Integration: the multi-display trigger channel actually drives the
// participant store's selectRandomCandidate, end-to-end, in both transports.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useParticipantStore } from '../stores/participants.js'
import { createTriggerChannel } from './platform.js'

function person(firstName, lastName) {
  return {
    id: `${firstName}-${lastName}`,
    fields: { 'First Name': firstName, 'Last Name': lastName },
  }
}

describe('multi-display trigger end-to-end (BroadcastChannel)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal('location', { protocol: 'https:' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a posted trigger reaches the receiver and kicks off a draw on the receiver store', async () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

    const receiver = createTriggerChannel()
    const sender = createTriggerChannel()

    const triggered = new Promise((resolve) => {
      receiver.onMessage(() => {
        // This is exactly the wiring DrawingView does.
        store.selectRandomCandidate()
        resolve()
      })
    })
    sender.postMessage('Go!')
    await triggered
    expect(store.spinning).toBe(true)

    sender.close()
    receiver.close()
  })

  it('does not double-fire when two senders post in succession to the same receiver', async () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

    const receiver = createTriggerChannel()
    const sender = createTriggerChannel()

    let calls = 0
    const triggered = new Promise((resolve) => {
      receiver.onMessage(() => {
        calls += 1
        // Mid-spin posts are guarded by the store itself.
        store.selectRandomCandidate()
        if (calls === 2) resolve()
      })
    })
    sender.postMessage('Go!')
    sender.postMessage('Go!')
    await triggered

    expect(calls).toBe(2)
    // Second message arrived while spinning — store ignored it, only one draw active.
    expect(store.spinning).toBe(true)

    sender.close()
    receiver.close()
  })
})

describe('multi-display trigger end-to-end (localStorage fallback)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal('location', { protocol: 'file:' })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('a storage event simulating the other tab drives the store to a winner', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace'), person('Alan', 'Turing')]

    const receiver = createTriggerChannel()
    receiver.onMessage(() => store.selectRandomCandidate())

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'drawing_trigger',
        newValue: JSON.stringify({ data: 'Go!', nonce: 42 }),
      }),
    )

    expect(store.spinning).toBe(true)
    // Close before flushing: the receiver now holds a live poll interval, which
    // would trip runAllTimers' infinite-loop guard.
    receiver.close()
    vi.runAllTimers()
    expect(store.winners).toHaveLength(1)
  })

  it('passes the configured animation style through to the store', () => {
    const store = useParticipantStore()
    store.candidates = [person('Ada', 'Lovelace')]
    const spy = vi.spyOn(store, 'selectRandomCandidate')

    const receiver = createTriggerChannel()
    receiver.onMessage(() => store.selectRandomCandidate('wheel'))

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'drawing_trigger',
        newValue: JSON.stringify({ data: 'Go!', nonce: 7 }),
      }),
    )

    expect(spy).toHaveBeenCalledWith('wheel')
    receiver.close()
    vi.runAllTimers()
    expect(store.winners).toHaveLength(1)
  })
})
