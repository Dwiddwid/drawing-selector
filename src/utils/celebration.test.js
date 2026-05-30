import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireConfetti, playWinnerSound, celebrate } from './celebration.js'

describe('fireConfetti', () => {
  let ctxStub

  beforeEach(() => {
    // jsdom's canvas has no 2D context. Stub a minimal one so the routine
    // exercises its real code path.
    ctxStub = {
      clearRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillRect: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
    }
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag)
      if (tag === 'canvas') el.getContext = () => ctxStub
      return el
    })
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      // Drive the loop forward fast — jump past the configured durationMs so
      // the routine exits and cleans up.
      cb(performance.now() + 5000)
      return 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.getElementById('celebration-canvas')?.remove()
  })

  it('returns true and exercises the canvas context when the API is available', () => {
    expect(fireConfetti({ particleCount: 10, durationMs: 100 })).toBe(true)
    expect(ctxStub.clearRect).toHaveBeenCalled()
    expect(ctxStub.fillRect).toHaveBeenCalled()
  })

  it('reuses a single celebration-canvas element across rapid calls', () => {
    fireConfetti({ particleCount: 4, durationMs: 100 })
    // The first call cleans up before the second starts (because rAF stub is
    // synchronous and runs past durationMs). So the canvas is removed and
    // recreated, but there should never be two simultaneously.
    fireConfetti({ particleCount: 4, durationMs: 100 })
    const canvases = document.querySelectorAll('#celebration-canvas')
    expect(canvases.length).toBeLessThanOrEqual(1)
  })
})

describe('playWinnerSound', () => {
  it('returns false when no AudioContext implementation is available', () => {
    expect(playWinnerSound({ AudioContextCtor: null })).toBe(false)
  })

  it('schedules a chord on the supplied AudioContext constructor', () => {
    const stops = []
    const gainStub = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    })
    const oscStub = () => ({
      type: '',
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn((t) => stops.push(t)),
    })
    const ctxStub = {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(oscStub),
      createGain: vi.fn(gainStub),
      close: vi.fn(),
    }
    const Ctor = vi.fn(() => ctxStub)

    expect(playWinnerSound({ AudioContextCtor: Ctor })).toBe(true)
    // Four-note arpeggio.
    expect(ctxStub.createOscillator).toHaveBeenCalledTimes(4)
    expect(ctxStub.createGain).toHaveBeenCalledTimes(4)
    expect(stops).toHaveLength(4)
  })

  it('returns false when the constructor throws', () => {
    const Ctor = vi.fn(() => {
      throw new Error('blocked by autoplay policy')
    })
    expect(playWinnerSound({ AudioContextCtor: Ctor })).toBe(false)
  })
})

describe('celebrate', () => {
  it('honors the per-effect opt-out flags', () => {
    const Ctor = vi.fn(() => ({
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: '',
        frequency: { value: 0 },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
      }),
      close: vi.fn(),
    }))
    const result = celebrate({ confetti: false, sound: { AudioContextCtor: Ctor } })
    expect(result.confetti).toBeUndefined()
    expect(result.sound).toBe(true)
  })
})
