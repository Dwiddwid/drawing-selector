import { describe, it, expect } from 'vitest'
import {
  resolveDrawDuration,
  clampDrawMs,
  MANUAL_DURATION,
  MIN_DRAW_MS,
  MAX_DRAW_MS,
} from './drawTiming.js'

describe('resolveDrawDuration', () => {
  it('returns the fixed duration in fixed mode', () => {
    expect(resolveDrawDuration({ mode: 'fixed', fixedMs: 4500 })).toBe(4500)
  })

  it('returns the manual sentinel (Infinity) in manual mode', () => {
    const d = resolveDrawDuration({ mode: 'manual', fixedMs: 4500 })
    expect(d).toBe(MANUAL_DURATION)
    expect(Number.isFinite(d)).toBe(false)
  })

  it('stays within [min, max] in random mode', () => {
    const timing = { mode: 'random', minMs: 2000, maxMs: 6000 }
    for (let i = 0; i < 200; i++) {
      const d = resolveDrawDuration(timing)
      expect(d).toBeGreaterThanOrEqual(2000)
      expect(d).toBeLessThanOrEqual(6000)
    }
  })

  it('handles reversed random bounds (min above max)', () => {
    const timing = { mode: 'random', minMs: 6000, maxMs: 2000 }
    expect(resolveDrawDuration(timing, () => 0)).toBe(2000)
    expect(resolveDrawDuration(timing, () => 1)).toBe(6000)
  })

  it('uses the injected RNG for the random point', () => {
    expect(resolveDrawDuration({ mode: 'random', minMs: 1000, maxMs: 5000 }, () => 0.5)).toBe(3000)
  })

  it('falls back to the manual sentinel for malformed input', () => {
    expect(resolveDrawDuration(null)).toBe(MANUAL_DURATION)
    expect(resolveDrawDuration('nope')).toBe(MANUAL_DURATION)
  })
})

describe('clampDrawMs', () => {
  it('clamps below/above the allowed bounds', () => {
    expect(clampDrawMs(0, 4500)).toBe(MIN_DRAW_MS)
    expect(clampDrawMs(999999, 4500)).toBe(MAX_DRAW_MS)
  })

  it('rounds and passes through valid values', () => {
    expect(clampDrawMs(3210.6, 4500)).toBe(3211)
  })

  it('falls back for non-numbers', () => {
    expect(clampDrawMs('abc', 4500)).toBe(4500)
    expect(clampDrawMs(NaN, 4500)).toBe(4500)
    expect(clampDrawMs(Infinity, 4500)).toBe(4500)
  })
})
