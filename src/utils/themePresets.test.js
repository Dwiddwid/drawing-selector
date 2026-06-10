import { THEME_PRESETS } from './themePresets.js'
import { mergeSettings, defaultSettings } from '../stores/settings.js'
import { isHexColor } from './color.js'

const REQUIRED_COLOR_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface']
const OPTIONAL_COLOR_KEYS = ['textColor', 'headlineColor', 'winnerCardBg', 'winnerCardText']
// Applying a preset must never clobber the user's branding/content.
const FORBIDDEN_KEYS = ['eventTitle', 'showEventTitle', 'logo', 'backgroundImage']

describe('THEME_PRESETS', () => {
  it('has unique ids and names', () => {
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const names = THEME_PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it.each(THEME_PRESETS.map((p) => [p.id, p]))('%s is complete and valid', (_id, preset) => {
    for (const key of REQUIRED_COLOR_KEYS) {
      expect(isHexColor(preset.theme[key]), `${key} should be a hex color`).toBe(true)
    }
    for (const key of OPTIONAL_COLOR_KEYS) {
      const v = preset.theme[key]
      expect(v === null || isHexColor(v), `${key} should be null or a hex color`).toBe(true)
    }
    expect(typeof preset.theme.fontFamily).toBe('string')
    expect(['waves', 'solid', 'image', 'gradient']).toContain(preset.theme.backgroundStyle)
    if (preset.theme.backgroundStyle === 'gradient') {
      expect(isHexColor(preset.theme.backgroundGradient.from)).toBe(true)
      expect(isHexColor(preset.theme.backgroundGradient.to)).toBe(true)
      expect(typeof preset.theme.backgroundGradient.angle).toBe('number')
    }
  })

  it.each(THEME_PRESETS.map((p) => [p.id, p]))(
    '%s never touches branding/content keys',
    (_id, preset) => {
      for (const key of FORBIDDEN_KEYS) {
        expect(key in preset.theme, `${key} must not be in a preset`).toBe(false)
      }
    },
  )

  it('every preset merges cleanly through mergeSettings', () => {
    for (const preset of THEME_PRESETS) {
      const merged = mergeSettings({ theme: preset.theme })
      expect(merged.theme.primary).toBe(preset.theme.primary)
      expect(merged.theme.backgroundStyle).toBe(preset.theme.backgroundStyle)
      // Branding stays at defaults since presets don't carry it.
      expect(merged.theme.eventTitle).toBe(defaultSettings().theme.eventTitle)
    }
  })
})
