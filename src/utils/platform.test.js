import { isPortable, createTriggerChannel } from './platform.js'

describe('platform helpers', () => {
  function setProtocol(protocol) {
    vi.stubGlobal('location', { protocol })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  describe('isPortable', () => {
    it('is true under the file:// protocol', () => {
      setProtocol('file:')
      expect(isPortable()).toBe(true)
    })

    it('is false for http(s) deploys', () => {
      setProtocol('https:')
      expect(isPortable()).toBe(false)
      setProtocol('http:')
      expect(isPortable()).toBe(false)
    })
  })

  describe('createTriggerChannel (web / BroadcastChannel)', () => {
    it('delivers messages between two channels', async () => {
      setProtocol('https:')
      const sender = createTriggerChannel()
      const receiver = createTriggerChannel()
      const received = await new Promise((resolve) => {
        receiver.onMessage((data) => resolve(data))
        sender.postMessage('Go!')
      })
      sender.close()
      receiver.close()
      expect(received).toBe('Go!')
    })
  })

  describe('createTriggerChannel (portable / localStorage fallback)', () => {
    it('does not use BroadcastChannel under file://', () => {
      setProtocol('file:')
      const spy = vi.fn()
      vi.stubGlobal('BroadcastChannel', spy)
      const ch = createTriggerChannel()
      expect(spy).not.toHaveBeenCalled()
      ch.close()
    })

    it('relays a storage event from another tab to the handler', () => {
      setProtocol('file:')
      const ch = createTriggerChannel()
      const received = []
      ch.onMessage((data) => received.push(data))

      // Simulate the write a *different* tab would make, then the storage event
      // the browser dispatches to this tab.
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'drawing_trigger',
          newValue: JSON.stringify({ data: 'Go!', nonce: 1 }),
        }),
      )

      expect(received).toEqual(['Go!'])
      ch.close()
    })

    it('ignores unrelated storage keys', () => {
      setProtocol('file:')
      const ch = createTriggerChannel()
      const received = []
      ch.onMessage((data) => received.push(data))

      window.dispatchEvent(
        new StorageEvent('storage', { key: 'something_else', newValue: 'x' }),
      )

      expect(received).toEqual([])
      ch.close()
    })

    it('stops relaying after close()', () => {
      setProtocol('file:')
      const ch = createTriggerChannel()
      const received = []
      ch.onMessage((data) => received.push(data))
      ch.close()

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'drawing_trigger',
          newValue: JSON.stringify({ data: 'Go!', nonce: 2 }),
        }),
      )

      expect(received).toEqual([])
    })

    it('postMessage writes a changing value to localStorage', () => {
      setProtocol('file:')
      const ch = createTriggerChannel()
      ch.postMessage('Go!')
      const first = localStorage.getItem('drawing_trigger')
      ch.postMessage('Go!')
      const second = localStorage.getItem('drawing_trigger')

      expect(JSON.parse(first).data).toBe('Go!')
      // Nonce guarantees identical triggers still change the stored string.
      expect(first).not.toBe(second)
      ch.close()
    })
  })
})
