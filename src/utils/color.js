// Small color helpers shared by the theme-from-image generator, the wheel
// palette derivation, and the preset validation tests. Pure functions only —
// no DOM access — so everything here is testable under jsdom.

// '#rgb' or '#rrggbb' → { r, g, b } (0–255). Returns null for anything else.
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let s = m[1]
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  const n = parseInt(s, 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')
}

export function isHexColor(value) {
  return hexToRgb(value) !== null
}

// { r, g, b } in 0–255 → { h, s, l } with h in 0–360, s/l in 0–1.
export function rgbToHsl({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return { h, s, l }
}

export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const hn = h / 360
  return { r: hue(hn + 1 / 3) * 255, g: hue(hn) * 255, b: hue(hn - 1 / 3) * 255 }
}

// Shift HSL lightness by `amount` (-1..1) and return hex.
export function adjustLightness(hex, amount) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount))
  const out = hslToRgb(hsl)
  return rgbToHex(out.r, out.g, out.b)
}

export const lighten = (hex, amount = 0.15) => adjustLightness(hex, Math.abs(amount))
export const darken = (hex, amount = 0.15) => adjustLightness(hex, -Math.abs(amount))

// WCAG relative luminance (0 = black, 1 = white) from 0–255 channels.
export function relativeLuminance({ r, g, b }) {
  const lin = (v) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// WCAG contrast ratio between two hex colors (1–21). Returns 1 on bad input.
export function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return 1
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// Euclidean RGB distance (0 ≈ identical, ~441 = black↔white).
export function rgbDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}
