// Generate a theme palette from an uploaded image — fully client-side, no
// dependencies, so it works in the portable file:// build too.
//
// Split into pure functions (extractPalette, paletteToTheme — testable under
// jsdom) and a thin DOM wrapper (themeFromImageFile) that does the
// FileReader → Image → canvas plumbing. Images loaded from data URLs don't
// taint the canvas, so getImageData works even under file://.
import {
  rgbToHex,
  rgbToHsl,
  relativeLuminance,
  rgbDistance,
  contrastRatio,
  lighten,
  darken,
} from './color.js'

// Extract up to `count` representative colors from raw RGBA pixel data.
// Quantizes to 4 bits/channel (4096 buckets), counts frequencies, then greedily
// keeps the most frequent colors that are visually distinct from those already
// chosen. Returns [{ hex, rgb, count, luminance, saturation }] sorted by count.
export function extractPalette(pixels, count = 5) {
  const buckets = new Map()
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] <= 128) continue // skip transparent pixels
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4)
    const b = buckets.get(key)
    if (b) {
      b.count += 1
      b.r += pixels[i]
      b.g += pixels[i + 1]
      b.b += pixels[i + 2]
    } else {
      buckets.set(key, { count: 1, r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] })
    }
  }

  const ranked = [...buckets.values()]
    .map((b) => ({
      count: b.count,
      rgb: { r: b.r / b.count, g: b.g / b.count, b: b.b / b.count },
    }))
    .sort((a, b) => b.count - a.count)

  const pick = (minDistance) => {
    const chosen = []
    for (const cand of ranked) {
      if (chosen.length >= count) break
      if (chosen.every((c) => rgbDistance(c.rgb, cand.rgb) > minDistance)) {
        chosen.push(cand)
      }
    }
    return chosen
  }

  // Prefer well-separated colors; relax the threshold once if the image is too
  // uniform to yield `count` distinct ones.
  let chosen = pick(60)
  if (chosen.length < count) chosen = pick(25)

  return chosen.map((c) => ({
    hex: rgbToHex(c.rgb.r, c.rgb.g, c.rgb.b),
    rgb: c.rgb,
    count: c.count,
    luminance: relativeLuminance(c.rgb),
    saturation: rgbToHsl(c.rgb).s,
  }))
}

// Map extracted palette colors onto theme roles. Falls back gracefully when the
// image yields fewer than 5 distinct colors.
export function paletteToTheme(palette) {
  if (!palette || palette.length === 0) return null
  const remaining = [...palette]
  const take = (pred) => {
    const idx = remaining.findIndex(pred)
    if (idx === -1) return null
    return remaining.splice(idx, 1)[0]
  }

  const maxBy = (selector) =>
    remaining.length === 0
      ? null
      : take((c) => c === remaining.reduce((a, b) => (selector(b) > selector(a) ? b : a)))

  // Primary: the most frequent reasonably-dark color (it carries text).
  const primary = take((c) => c.luminance < 0.45) ?? remaining.shift()
  // Accent: the most saturated of what's left.
  const accent = maxBy((c) => c.saturation) ?? primary
  // Background: the lightest of what's left.
  const background = maxBy((c) => c.luminance)
  // Secondary: next remaining color (mid-tone) or a lightened primary.
  const secondary = remaining.shift() ?? null

  let primaryHex = primary.hex
  // Keep the background light enough that dark text stays readable.
  let backgroundHex = background ? background.hex : lighten(primaryHex, 0.55)
  if (background && background.luminance < 0.6) backgroundHex = lighten(background.hex, 0.3)
  // Contrast floor: darken primary until it reads against the background.
  for (let i = 0; i < 4 && contrastRatio(primaryHex, backgroundHex) < 3; i++) {
    primaryHex = darken(primaryHex, 0.12)
  }

  return {
    primary: primaryHex,
    secondary: secondary ? secondary.hex : lighten(primaryHex, 0.18),
    accent: accent.hex,
    background: backgroundHex,
    surface: '#ffffff',
    textColor: primaryHex,
    headlineColor: primaryHex,
    winnerCardBg: '#ffffff',
    winnerCardText: primaryHex,
  }
}

// DOM wrapper: read the file, downsample onto a small canvas, extract.
// Resolves { theme, swatches } or rejects with a descriptive Error.
export function themeFromImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.onload = (evt) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode that image.'))
      img.onload = () => {
        try {
          // Downsample: 64px on the long edge is plenty for dominant colors.
          const scale = Math.min(1, 64 / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale))
          const h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext?.('2d')
          if (!ctx) throw new Error('Canvas is not available in this browser.')
          ctx.drawImage(img, 0, 0, w, h)
          const { data } = ctx.getImageData(0, 0, w, h)
          const palette = extractPalette(data, 5)
          const theme = paletteToTheme(palette)
          if (!theme) throw new Error('Could not find usable colors in that image.')
          resolve({ theme, swatches: palette.map((c) => c.hex) })
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not analyze that image.'))
        }
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
  })
}
