import { isPortable, createTriggerChannel } from './platform.js'

describe('platform helpers', () => {
  function setProtocol(protocol) {
    vi.stubGlobal('location', { protocol })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
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

  describe('createTriggerChannel', () => {
    it('returns a BroadcastChannel on a normal web origin', () => {
      setProtocol('https:')
      const ch = createTriggerChannel()
      expect(ch).toBeInstanceOf(BroadcastChannel)
      ch.close()
    })

    it('returns null under file:// so callers fall back to single-screen', () => {
      setProtocol('file:')
      expect(createTriggerChannel()).toBeNull()
    })

    it('returns null when BroadcastChannel is unavailable', () => {
      setProtocol('https:')
      vi.stubGlobal('BroadcastChannel', undefined)
      expect(createTriggerChannel()).toBeNull()
    })
  })
})
