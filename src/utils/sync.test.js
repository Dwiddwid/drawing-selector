import {
  postTrigger,
  broadcastSync,
  onChannelMessage,
  normalizeChannelMessage,
  closeSyncChannel,
} from './sync.js'
import { createTriggerChannel } from './platform.js'

describe('sync channel', () => {
  function setProtocol(protocol) {
    vi.stubGlobal('location', { protocol })
  }

  afterEach(() => {
    closeSyncChannel()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  describe('normalizeChannelMessage', () => {
    it('passes typed messages through unchanged', () => {
      const msg = { v: 1, type: 'sync', scope: 'participants' }
      expect(normalizeChannelMessage(msg)).toBe(msg)
    })

    it("treats the legacy 'Go!' string as a trigger", () => {
      expect(normalizeChannelMessage('Go!')).toEqual({ v: 0, type: 'trigger' })
    })

    it('treats null and type-less objects as triggers', () => {
      expect(normalizeChannelMessage(null).type).toBe('trigger')
      expect(normalizeChannelMessage({ foo: 1 }).type).toBe('trigger')
    })
  })

  describe('web transport (BroadcastChannel)', () => {
    it('postTrigger delivers a typed trigger to another channel', async () => {
      setProtocol('https:')
      const receiver = createTriggerChannel()
      const received = await new Promise((resolve) => {
        receiver.onMessage((data) => resolve(data))
        postTrigger()
      })
      receiver.close()
      expect(received).toEqual({ v: 1, type: 'trigger' })
    })

    it('broadcastSync delivers the scope', async () => {
      setProtocol('https:')
      const receiver = createTriggerChannel()
      const received = await new Promise((resolve) => {
        receiver.onMessage((data) => resolve(data))
        broadcastSync('settings')
      })
      receiver.close()
      expect(received).toEqual({ v: 1, type: 'sync', scope: 'settings' })
    })
  })

  describe('portable transport (localStorage fallback)', () => {
    it('broadcastSync writes the typed message to the trigger key', () => {
      setProtocol('file:')
      broadcastSync('participants')
      const stored = JSON.parse(localStorage.getItem('drawing_trigger'))
      expect(stored.data).toEqual({ v: 1, type: 'sync', scope: 'participants' })
    })

    it('onChannelMessage receives and normalizes messages from a storage event', () => {
      setProtocol('file:')
      const received = []
      onChannelMessage((msg) => received.push(msg))

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'drawing_trigger',
          newValue: JSON.stringify({ data: { v: 1, type: 'sync', scope: 'settings' }, nonce: 1 }),
        }),
      )
      // Legacy tab still posting the old plain string.
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'drawing_trigger',
          newValue: JSON.stringify({ data: 'Go!', nonce: 2 }),
        }),
      )

      expect(received).toEqual([
        { v: 1, type: 'sync', scope: 'settings' },
        { v: 0, type: 'trigger' },
      ])
    })

    it('supports multiple subscribers and unsubscribe', () => {
      setProtocol('file:')
      const a = []
      const b = []
      const offA = onChannelMessage((msg) => a.push(msg))
      onChannelMessage((msg) => b.push(msg))

      const fire = (nonce) =>
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'drawing_trigger',
            newValue: JSON.stringify({ data: { v: 1, type: 'trigger' }, nonce }),
          }),
        )

      fire(1)
      offA()
      fire(2)

      expect(a).toHaveLength(1)
      expect(b).toHaveLength(2)
    })
  })
})
