import { describe, it, expect } from 'vitest'
import {
  buildWheelSegments,
  targetRotation,
  reelDrumRotation,
  flapperDeflection,
  MAX_WHEEL_SEGMENTS,
  DEFAULT_WHEEL_COLORS,
  wheelColorsFromTheme,
} from './wheel.js'
import { isHexColor } from './color.js'

function person(firstName, lastName) {
  return { id: `${firstName}-${lastName}`, firstName, lastName, extras: {} }
}

describe('wheelColorsFromTheme', () => {
  const theme = { primary: '#1e3d59', secondary: '#1c8c9a', accent: '#ff6f61' }

  it('returns 8 valid hex colors', () => {
    const colors = wheelColorsFromTheme(theme)
    expect(colors).toHaveLength(8)
    for (const c of colors) expect(isHexColor(c)).toBe(true)
  })

  it('no two adjacent segments share a color (including the wrap-around)', () => {
    const colors = wheelColorsFromTheme(theme)
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).not.toBe(colors[(i + 1) % colors.length])
    }
  })

  it('keeps adjacent variants distinct even for a monochrome theme', () => {
    const colors = wheelColorsFromTheme({
      primary: '#336699',
      secondary: '#336699',
      accent: '#336699',
    })
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).not.toBe(colors[(i + 1) % colors.length])
    }
  })

  it('exports the original default palette for the settings store', () => {
    expect(DEFAULT_WHEEL_COLORS).toHaveLength(8)
    for (const c of DEFAULT_WHEEL_COLORS) expect(isHexColor(c)).toBe(true)
  })
})

describe('buildWheelSegments', () => {
  it('returns empty results for an empty pool', () => {
    expect(buildWheelSegments([], 0)).toEqual({ segments: [], winnerSegmentIdx: -1 })
  })

  it('returns empty results when winnerIdx is invalid', () => {
    expect(buildWheelSegments([person('Ada', 'Lovelace')], -1)).toEqual({
      segments: [],
      winnerSegmentIdx: -1,
    })
  })

  it('shows every candidate when pool fits within the limit', () => {
    const pool = [person('Ada', 'Lovelace'), person('Alan', 'Turing'), person('Grace', 'Hopper')]
    const { segments, winnerSegmentIdx } = buildWheelSegments(pool, 1)
    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.label)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper'])
    // For pools under the limit, winnerSegmentIdx matches the candidate index.
    expect(winnerSegmentIdx).toBe(1)
    expect(segments[winnerSegmentIdx].candidateIdx).toBe(1)
  })

  it('caps the segment count and always includes the winner for larger pools', () => {
    const pool = []
    for (let i = 0; i < 50; i++) pool.push(person(`P${i}`, ''))
    const winnerIdx = 37
    // Deterministic RNG so we can assert positions.
    let seed = 0
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const { segments, winnerSegmentIdx } = buildWheelSegments(pool, winnerIdx, { random })
    expect(segments).toHaveLength(MAX_WHEEL_SEGMENTS)
    expect(winnerSegmentIdx).toBeGreaterThanOrEqual(0)
    expect(winnerSegmentIdx).toBeLessThan(MAX_WHEEL_SEGMENTS)
    expect(segments[winnerSegmentIdx].candidateIdx).toBe(winnerIdx)
    expect(segments[winnerSegmentIdx].label).toBe('P37')
    // All candidate indices distinct (no duplicates).
    const uniq = new Set(segments.map((s) => s.candidateIdx))
    expect(uniq.size).toBe(MAX_WHEEL_SEGMENTS)
  })

  it('honors a custom max', () => {
    const pool = [
      person('Ada', 'Lovelace'),
      person('Alan', 'Turing'),
      person('Grace', 'Hopper'),
      person('Linus', 'Torvalds'),
    ]
    const { segments } = buildWheelSegments(pool, 0, { max: 3 })
    expect(segments).toHaveLength(3)
  })

  it('giant mode (max >= pool size) shows every candidate with winner index unchanged', () => {
    const pool = []
    for (let i = 0; i < 40; i++) pool.push(person(`P${i}`, ''))
    const winnerIdx = 29
    // The giant wheel passes max = pool.length so nothing is sampled out.
    const { segments, winnerSegmentIdx } = buildWheelSegments(pool, winnerIdx, {
      max: pool.length,
    })
    expect(segments).toHaveLength(40)
    // When all are shown, the segment index equals the candidate index.
    expect(winnerSegmentIdx).toBe(winnerIdx)
    expect(segments[winnerSegmentIdx].candidateIdx).toBe(winnerIdx)
    // Every candidate appears exactly once, in order.
    expect(segments.map((s) => s.candidateIdx)).toEqual(pool.map((_, i) => i))
  })

  it('falls back to "(no name)" when both first and last are empty', () => {
    const pool = [{ id: 'x', firstName: '', lastName: '', extras: {} }]
    const { segments } = buildWheelSegments(pool, 0)
    expect(segments[0].label).toBe('(no name)')
  })
})

describe('targetRotation', () => {
  it('positions the winner segment center under the top pointer', () => {
    const n = 8
    const winnerSeg = 3
    const rot = targetRotation(winnerSeg, n, 0)
    const segAngle = (Math.PI * 2) / n
    const segCenter = winnerSeg * segAngle + segAngle / 2
    // After rotation, the segment center should sit at the pointer (-PI/2).
    const finalAngle = rot + segCenter
    // Normalize to [-PI, PI].
    const norm = Math.atan2(Math.sin(finalAngle), Math.cos(finalAngle))
    expect(norm).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('adds full revolutions for showmanship', () => {
    const a = targetRotation(0, 8, 0)
    const b = targetRotation(0, 8, 5)
    expect(b - a).toBeCloseTo(Math.PI * 2 * 5, 6)
  })

  it('returns 0 for a zero-segment wheel', () => {
    expect(targetRotation(0, 0)).toBe(0)
  })
})

describe('reelDrumRotation', () => {
  it('lands the winner panel squarely facing front (a whole number of turns)', () => {
    const n = 10
    const seg = 360 / n
    for (const w of [0, 3, 9]) {
      const rot = reelDrumRotation(w, n)
      // The winner panel is mounted at w·seg; after rotating the drum by `rot`
      // its net orientation must be a multiple of 360 (face-front).
      expect(((rot + w * seg) % 360 + 360) % 360).toBeCloseTo(0, 6)
    }
  })

  it('adds the requested number of full turns', () => {
    const a = reelDrumRotation(2, 8, 0)
    const b = reelDrumRotation(2, 8, 6)
    expect(b - a).toBeCloseTo(360 * 6, 6)
  })

  it('returns a positive sweep with the default turns', () => {
    expect(reelDrumRotation(7, 8)).toBeGreaterThan(0)
  })

  it('returns 0 for a degenerate panel count', () => {
    expect(reelDrumRotation(0, 0)).toBe(0)
  })
})

describe('flapperDeflection', () => {
  const segAngle = (Math.PI * 2) / 12

  it('is at rest when a peg sits exactly at the top', () => {
    expect(flapperDeflection(0, segAngle)).toBe(0)
    expect(flapperDeflection(segAngle, segAngle)).toBeCloseTo(0, 6)
  })

  it('rises from rest to fully deflected across the contact window, then snaps back', () => {
    const contact = 0.45
    // Mid-contact → roughly half deflected.
    expect(flapperDeflection(segAngle * (contact / 2), segAngle, contact)).toBeCloseTo(0.5, 6)
    // Just before the peg clears the tip → nearly full deflection.
    expect(
      flapperDeflection(segAngle * (contact - 0.001), segAngle, contact),
    ).toBeGreaterThan(0.99)
    // The instant the peg clears → snapped back to rest.
    expect(flapperDeflection(segAngle * contact, segAngle, contact)).toBe(0)
    // Between pegs the flapper waits at rest.
    expect(flapperDeflection(segAngle * 0.8, segAngle, contact)).toBe(0)
  })

  it('is periodic with the segment angle', () => {
    const r = segAngle * 0.2
    expect(flapperDeflection(r + segAngle * 3, segAngle)).toBeCloseTo(
      flapperDeflection(r, segAngle),
      6,
    )
  })

  it('handles negative rotation (wheel never spins backwards, but stay safe)', () => {
    const v = flapperDeflection(-segAngle * 0.2, segAngle)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })

  it('returns 0 for a degenerate segment angle', () => {
    expect(flapperDeflection(1, 0)).toBe(0)
    expect(flapperDeflection(1, -1)).toBe(0)
  })
})
