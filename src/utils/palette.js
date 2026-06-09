// Dependency-free color extraction for "build a theme from an uploaded image".
//
// The heavy lifting is split into pure functions (`extractPalette`,
// `paletteToTheme`) that operate on plain data so they can be unit-tested
// without a real browser, plus a thin browser-only glue function
// (`imageToPalette`) that rasterizes an image onto a canvas and hands the pixels
// to `extractPalette`.

function toHex(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

export function rgbToHex({ r, g, b }) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Perceived brightness (0–255). Used to pick light backgrounds vs dark text.
export function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Saturation (0–1) in the HSV sense — how vivid a color is.
export function saturation({ r, g, b }) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

// Bucket pixels by a coarse (4-bit-per-channel) quantization, returning the most
// common buckets as representative average colors. `rgba` is a flat RGBA array
// (Uint8ClampedArray or number[]). Near-transparent pixels are ignored.
export function extractPalette(rgba, maxColors = 6) {
  const buckets = new Map()
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]
    if (a !== undefined && a < 128) continue
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    // 4 bits/channel → 4096 possible buckets.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { r: 0, g: 0, b: 0, count: 0 }
      buckets.set(key, bucket)
    }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count += 1
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) => {
      const color = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
        count: bucket.count,
      }
      return { ...color, hex: rgbToHex(color) }
    })
}

// Map a ranked palette onto the theme's color slots. Heuristics:
//   background → the lightest color (or a near-white fallback if all are dark)
//   surface    → an even lighter tint of the background for card readability
//   accent     → the most saturated color
//   primary    → the most prominent color that reads well as text (darkest-ish)
//   secondary  → the next distinct prominent color
export function paletteToTheme(palette) {
  if (!palette || palette.length === 0) return {}

  const byLum = [...palette].sort((a, b) => luminance(a) - luminance(b))
  const bySat = [...palette].sort((a, b) => saturation(b) - saturation(a))

  const lightest = byLum[byLum.length - 1]
  const darkest = byLum[0]
  const accent = bySat[0]

  // primary: prefer a dark, prominent color so text on a light background is
  // legible; fall back to the darkest if the most-frequent one is pale.
  const primary = palette.find((c) => luminance(c) < 140) ?? darkest
  const secondary = palette.find((c) => c !== primary && c !== accent) ?? accent

  const background = luminance(lightest) > 180 ? lightest : lighten(lightest, 0.85)
  const surface = lighten(background, 0.6)

  return {
    primary: rgbToHex(primary),
    secondary: rgbToHex(secondary),
    accent: rgbToHex(accent),
    background: rgbToHex(background),
    surface: rgbToHex(surface),
    headingColor: rgbToHex(primary),
    winnerNameColor: rgbToHex(accent),
  }
}

// Blend a color toward white by `amount` (0 = unchanged, 1 = white).
function lighten({ r, g, b }, amount) {
  return {
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  }
}

// Browser-only: rasterize a data-URL image into a small canvas and extract its
// palette. Resolves with the same shape as `extractPalette`.
export function imageToPalette(dataUrl, size = 64) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Image processing is not available in this environment.'))
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not read image pixels.'))
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        resolve(extractPalette(data))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not process that image.'))
      }
    }
    img.onerror = () => reject(new Error('Could not load that image.'))
    img.src = dataUrl
  })
}
