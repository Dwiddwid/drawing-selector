import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fireConfetti,
  playWinnerSound,
  celebrate,
  confettiColorsFromTheme,
  resolveCelebration,
  DEFAULT_CONFETTI_COLORS,
  INTENSITY_PARTICLES,
} from './celebration.js'
import { isHexColor } from './color.js'

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

  it('plays the selected style and falls back to chime for unknown styles', () => {
    const makeCtx = () => ({
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: '',
        frequency: { value: 0 },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
      })),
      close: vi.fn(),
    })

    let ctx = makeCtx()
    expect(playWinnerSound({ style: 'fanfare', AudioContextCtor: vi.fn(() => ctx) })).toBe(true)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4)

    ctx = makeCtx()
    expect(playWinnerSound({ style: 'tada', AudioContextCtor: vi.fn(() => ctx) })).toBe(true)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)

    ctx = makeCtx()
    expect(playWinnerSound({ style: 'nope', AudioContextCtor: vi.fn(() => ctx) })).toBe(true)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4) // chime fallback
  })
})

describe('confettiColorsFromTheme', () => {
  it('returns brand colors plus lightened variants, all valid hex', () => {
    const colors = confettiColorsFromTheme({
      primary: '#1e3d59',
      secondary: '#1c8c9a',
      accent: '#ff6f61',
    })
    expect(colors).toHaveLength(6)
    expect(colors.slice(0, 3)).toEqual(['#1e3d59', '#1c8c9a', '#ff6f61'])
    for (const c of colors) expect(isHexColor(c)).toBe(true)
  })

  it('falls back to the classic mix when the theme has no colors', () => {
    expect(confettiColorsFromTheme({})).toEqual(DEFAULT_CONFETTI_COLORS)
    expect(confettiColorsFromTheme(null)).toEqual(DEFAULT_CONFETTI_COLORS)
  })
})

describe('resolveCelebration', () => {
  const theme = { primary: '#111111', secondary: '#222222', accent: '#333333' }

  it('resolves the classic palette by default', () => {
    const out = resolveCelebration(
      { confetti: true, confettiColorMode: 'classic', intensity: 'medium', sound: true, soundStyle: 'chime' },
      theme,
    )
    expect(out.confetti.colors).toEqual(DEFAULT_CONFETTI_COLORS)
    expect(out.confetti.particleCount).toBe(INTENSITY_PARTICLES.medium)
    expect(out.sound).toEqual({ style: 'chime' })
  })

  it('derives theme colors and honors custom palettes', () => {
    const themed = resolveCelebration(
      { confetti: true, confettiColorMode: 'theme', intensity: 'medium' },
      theme,
    )
    expect(themed.confetti.colors.slice(0, 3)).toEqual(['#111111', '#222222', '#333333'])

    const custom = resolveCelebration(
      { confetti: true, confettiColorMode: 'custom', confettiCustomColors: ['#abcdef'], intensity: 'medium' },
      theme,
    )
    expect(custom.confetti.colors).toEqual(['#abcdef'])

    // Custom mode with an empty palette falls back to the classic mix.
    const emptyCustom = resolveCelebration(
      { confetti: true, confettiColorMode: 'custom', confettiCustomColors: [], intensity: 'medium' },
      theme,
    )
    expect(emptyCustom.confetti.colors).toEqual(DEFAULT_CONFETTI_COLORS)
  })

  it('maps intensity and scale onto the particle count', () => {
    const base = { confetti: true, confettiColorMode: 'classic', sound: false }
    expect(resolveCelebration({ ...base, intensity: 'low' }, theme).confetti.particleCount).toBe(80)
    expect(resolveCelebration({ ...base, intensity: 'high' }, theme).confetti.particleCount).toBe(320)
    expect(resolveCelebration({ ...base, intensity: 'junk' }, theme).confetti.particleCount).toBe(160)
    expect(
      resolveCelebration({ ...base, intensity: 'high' }, theme, { scale: 0.5 }).confetti.particleCount,
    ).toBe(160)
  })

  it('turns effects off when their switches are off', () => {
    const out = resolveCelebration({ confetti: false, sound: false }, theme)
    expect(out.confetti).toBe(false)
    expect(out.sound).toBe(false)
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
