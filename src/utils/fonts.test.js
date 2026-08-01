import { describe, it, expect, afterEach, vi } from 'vitest'
import { FONT_OPTIONS, fontStack, ensureFontLoaded } from './fonts.js'

describe('fontStack', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the full stack for every known option', () => {
    for (const f of FONT_OPTIONS) {
      expect(fontStack(f.name)).toBe(f.stack)
      expect(f.stack).toMatch(/serif|sans-serif|monospace|cursive/)
    }
  })

  it('falls back to a quoted family + sans-serif for unknown names', () => {
    expect(fontStack('Mystery Font')).toBe("'Mystery Font', sans-serif")
  })
})

describe('ensureFontLoaded', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.querySelectorAll('link[data-app-font]').forEach((el) => el.remove())
  })

  it('injects a Google Fonts link once per family', () => {
    vi.stubGlobal('location', { protocol: 'https:' })
    expect(ensureFontLoaded('Poppins')).toBe(true)
    const links = document.querySelectorAll('link[data-app-font="Poppins"]')
    expect(links).toHaveLength(1)
    expect(links[0].href).toContain('fonts.googleapis.com/css2?family=Poppins')
    expect(links[0].href).toContain('display=swap')
    // Second call is a no-op.
    expect(ensureFontLoaded('Poppins')).toBe(false)
    expect(document.querySelectorAll('link[data-app-font="Poppins"]')).toHaveLength(1)
  })

  it('never injects in the portable file:// build', () => {
    vi.stubGlobal('location', { protocol: 'file:' })
    expect(ensureFontLoaded('Poppins')).toBe(false)
    expect(document.querySelectorAll('link[data-app-font]')).toHaveLength(0)
  })

  it('no-ops for system fonts and unknown names', () => {
    vi.stubGlobal('location', { protocol: 'https:' })
    expect(ensureFontLoaded('Arial')).toBe(false)
    expect(ensureFontLoaded('Mystery Font')).toBe(false)
    expect(document.querySelectorAll('link[data-app-font]')).toHaveLength(0)
  })

  it('encodes multi-word family names for the request URL', () => {
    vi.stubGlobal('location', { protocol: 'https:' })
    expect(ensureFontLoaded('Playfair Display')).toBe(true)
    const link = document.querySelector('link[data-app-font="Playfair Display"]')
    expect(link.href).toContain('family=Playfair+Display')
  })
})
