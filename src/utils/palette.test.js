import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  extractPalette,
  paletteToTheme,
  rgbToHex,
  luminance,
  saturation,
  imageToPalette,
} from './palette.js'

// Build a flat RGBA array from [r,g,b] triples, all fully opaque.
function rgba(...pixels) {
  const out = []
  for (const [r, g, b, a = 255] of pixels) out.push(r, g, b, a)
  return out
}

describe('rgbToHex', () => {
  it('formats and clamps channels', () => {
    expect(rgbToHex({ r: 30, g: 61, b: 89 })).toBe('#1e3d59')
    expect(rgbToHex({ r: 300, g: -5, b: 255 })).toBe('#ff00ff')
  })
})

describe('luminance / saturation', () => {
  it('ranks white brighter than black', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeGreaterThan(
      luminance({ r: 0, g: 0, b: 0 }),
    )
  })
  it('reports gray as unsaturated and red as saturated', () => {
    expect(saturation({ r: 128, g: 128, b: 128 })).toBe(0)
    expect(saturation({ r: 255, g: 0, b: 0 })).toBe(1)
  })
})

describe('extractPalette', () => {
  it('returns the most frequent colors first', () => {
    // Three red pixels, one blue.
    const data = rgba([255, 0, 0], [255, 0, 0], [255, 0, 0], [0, 0, 255])
    const palette = extractPalette(data)
    expect(palette[0].hex).toBe('#ff0000')
    expect(palette[0].count).toBe(3)
    expect(palette).toHaveLength(2)
  })

  it('ignores near-transparent pixels', () => {
    const data = rgba([255, 0, 0, 10], [0, 0, 255, 255])
    const palette = extractPalette(data)
    expect(palette).toHaveLength(1)
    expect(palette[0].hex).toBe('#0000ff')
  })

  it('caps the number of returned colors', () => {
    const pixels = []
    for (let i = 0; i < 20; i++) pixels.push([i * 12, 0, 0])
    const palette = extractPalette(rgba(...pixels), 4)
    expect(palette.length).toBeLessThanOrEqual(4)
  })
})

describe('paletteToTheme', () => {
  it('returns an empty object for an empty palette', () => {
    expect(paletteToTheme([])).toEqual({})
  })

  it('maps a palette onto all theme slots as hex', () => {
    const palette = extractPalette(
      rgba([20, 30, 90], [20, 30, 90], [240, 240, 245], [255, 110, 90]),
    )
    const theme = paletteToTheme(palette)
    for (const slot of [
      'primary',
      'secondary',
      'accent',
      'background',
      'surface',
      'headingColor',
      'winnerNameColor',
    ]) {
      expect(theme[slot]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('picks a light background', () => {
    const palette = extractPalette(rgba([10, 10, 10], [245, 245, 245]))
    const theme = paletteToTheme(palette)
    expect(luminance(hexToRgb(theme.background))).toBeGreaterThan(150)
  })
})

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

describe('imageToPalette', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rasterizes the image and extracts its palette', async () => {
    const fakePixels = new Uint8ClampedArray(rgba([255, 0, 0], [255, 0, 0], [0, 0, 255]))
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: fakePixels })),
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ctx }
      return {}
    })
    // Stub Image so setting .src synchronously fires onload.
    class FakeImage {
      set src(_v) {
        if (this.onload) this.onload()
      }
    }
    vi.stubGlobal('Image', FakeImage)

    const palette = await imageToPalette('data:image/png;base64,xxx')
    expect(palette[0].hex).toBe('#ff0000')
    expect(ctx.drawImage).toHaveBeenCalled()
  })

  it('rejects when the image fails to load', async () => {
    class FakeImage {
      set src(_v) {
        if (this.onerror) this.onerror()
      }
    }
    vi.stubGlobal('Image', FakeImage)
    await expect(imageToPalette('bad')).rejects.toThrow(/could not load/i)
  })
})
