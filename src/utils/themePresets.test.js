import { describe, it, expect } from 'vitest'
import { THEME_PRESETS } from './themePresets.js'

const HEX = /^#[0-9a-fA-F]{6}$/

describe('THEME_PRESETS', () => {
  it('exposes a non-empty list with unique ids', () => {
    expect(THEME_PRESETS.length).toBeGreaterThan(0)
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each preset has a name and a valid color block', () => {
    const required = ['primary', 'secondary', 'accent', 'background', 'surface']
    for (const preset of THEME_PRESETS) {
      expect(typeof preset.name).toBe('string')
      expect(preset.name.length).toBeGreaterThan(0)
      for (const slot of required) {
        expect(preset.colors[slot], `${preset.id}.${slot}`).toMatch(HEX)
      }
      // Heading/winner overrides are either a hex string or null.
      for (const slot of ['headingColor', 'winnerNameColor']) {
        const v = preset.colors[slot]
        expect(v === null || HEX.test(v), `${preset.id}.${slot}`).toBe(true)
      }
    }
  })

  it('includes the default Ocean palette unchanged', () => {
    const ocean = THEME_PRESETS.find((p) => p.id === 'ocean')
    expect(ocean.colors.primary).toBe('#1e3d59')
    expect(ocean.colors.accent).toBe('#ff6f61')
  })
})
