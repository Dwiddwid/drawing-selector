import { extractPalette, paletteToTheme } from './themeFromImage.js'
import { contrastRatio, isHexColor } from './color.js'

// Build a synthetic RGBA pixel array: list of [r,g,b,count] entries.
function pixels(entries) {
  const out = []
  for (const [r, g, b, count] of entries) {
    for (let i = 0; i < count; i++) out.push(r, g, b, 255)
  }
  return new Uint8ClampedArray(out)
}

describe('extractPalette', () => {
  it('finds the single color of a solid image', () => {
    const palette = extractPalette(pixels([[30, 60, 90, 100]]))
    expect(palette).toHaveLength(1)
    expect(palette[0].hex).toBe('#1e3c5a')
    expect(palette[0].count).toBe(100)
  })

  it('ranks a two-color split by frequency', () => {
    const palette = extractPalette(
      pixels([
        [200, 40, 40, 30], // red, less frequent
        [20, 20, 120, 70], // blue, dominant
      ]),
    )
    expect(palette[0].hex).toBe('#141478')
    expect(palette[1].hex).toBe('#c82828')
  })

  it('skips transparent pixels', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, // opaque red
      0, 255, 0, 10, // nearly transparent green — ignored
    ])
    const palette = extractPalette(data)
    expect(palette).toHaveLength(1)
    expect(palette[0].hex).toBe('#ff0000')
  })

  it('merges near-identical shades instead of returning five reds', () => {
    const palette = extractPalette(
      pixels([
        [200, 30, 30, 20],
        [205, 35, 32, 20],
        [198, 28, 35, 20],
        [20, 20, 200, 20],
      ]),
      5,
    )
    // Three near-identical reds collapse; blue survives as distinct.
    expect(palette.length).toBeLessThanOrEqual(3)
    const hasBlue = palette.some((c) => c.rgb.b > 150 && c.rgb.r < 80)
    expect(hasBlue).toBe(true)
  })

  it('caps the result at the requested count', () => {
    const palette = extractPalette(
      pixels([
        [250, 0, 0, 10],
        [0, 250, 0, 10],
        [0, 0, 250, 10],
        [250, 250, 0, 10],
        [0, 250, 250, 10],
        [250, 0, 250, 10],
      ]),
      3,
    )
    expect(palette).toHaveLength(3)
  })
})

describe('paletteToTheme', () => {
  it('returns null for an empty palette', () => {
    expect(paletteToTheme([])).toBeNull()
    expect(paletteToTheme(null)).toBeNull()
  })

  it('maps a dark dominant color to primary and the lightest to background', () => {
    const palette = extractPalette(
      pixels([
        [25, 45, 80, 60], // dark navy — dominant
        [240, 240, 230, 25], // near-white
        [220, 60, 40, 15], // saturated red
      ]),
    )
    const theme = paletteToTheme(palette)
    expect(theme.primary).toBe(palette.find((c) => c.luminance < 0.45).hex)
    // Background derives from the lightest color (possibly lightened further).
    expect(isHexColor(theme.background)).toBe(true)
    expect(contrastRatio(theme.primary, theme.background)).toBeGreaterThanOrEqual(3)
    expect(theme.surface).toBe('#ffffff')
    expect(theme.textColor).toBe(theme.primary)
  })

  it('produces every key the theme store expects, all valid colors', () => {
    const theme = paletteToTheme(extractPalette(pixels([[100, 50, 150, 50]])))
    for (const key of [
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'textColor',
      'headlineColor',
      'winnerCardBg',
      'winnerCardText',
    ]) {
      expect(isHexColor(theme[key]), `${key} should be a hex color`).toBe(true)
    }
  })

  it('enforces a contrast floor between primary and background', () => {
    // Two similar mid-grays — primary must get darkened until it reads.
    const palette = extractPalette(
      pixels([
        [150, 150, 150, 50],
        [180, 180, 180, 50],
      ]),
    )
    const theme = paletteToTheme(palette)
    expect(contrastRatio(theme.primary, theme.background)).toBeGreaterThanOrEqual(3)
  })
})
