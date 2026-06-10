import {
  hexToRgb,
  rgbToHex,
  isHexColor,
  rgbToHsl,
  hslToRgb,
  lighten,
  darken,
  contrastRatio,
  rgbDistance,
} from './color.js'

describe('color helpers', () => {
  it('hexToRgb parses 6- and 3-digit hex, with or without #', () => {
    expect(hexToRgb('#1e3d59')).toEqual({ r: 30, g: 61, b: 89 })
    expect(hexToRgb('1e3d59')).toEqual({ r: 30, g: 61, b: 89 })
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('hexToRgb returns null for invalid input', () => {
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb('red')).toBeNull()
    expect(hexToRgb(null)).toBeNull()
    expect(hexToRgb(42)).toBeNull()
  })

  it('isHexColor mirrors hexToRgb validity', () => {
    expect(isHexColor('#abc')).toBe(true)
    expect(isHexColor('#aabbcc')).toBe(true)
    expect(isHexColor('#aabbcz')).toBe(false)
  })

  it('rgb ↔ hex round-trips and clamps out-of-range channels', () => {
    expect(rgbToHex(30, 61, 89)).toBe('#1e3d59')
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80')
  })

  it('rgb ↔ hsl round-trips within rounding error', () => {
    for (const hex of ['#1e3d59', '#ff6f61', '#000000', '#ffffff', '#808080']) {
      const rgb = hexToRgb(hex)
      const back = hslToRgb(rgbToHsl(rgb))
      expect(rgbToHex(back.r, back.g, back.b)).toBe(hex)
    }
  })

  it('lighten raises lightness; darken lowers it; both stay in range', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080')
    expect(darken('#ffffff', 0.5)).toBe('#808080')
    expect(lighten('#ffffff', 0.5)).toBe('#ffffff') // clamped
    expect(darken('#000000', 0.5)).toBe('#000000') // clamped
  })

  it('contrastRatio matches known anchors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
    expect(contrastRatio('not-a-color', '#fff')).toBe(1) // graceful on bad input
  })

  it('rgbDistance is 0 for identical colors and ~441 for black↔white', () => {
    expect(rgbDistance({ r: 1, g: 2, b: 3 }, { r: 1, g: 2, b: 3 })).toBe(0)
    expect(rgbDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(441.7, 1)
  })
})
