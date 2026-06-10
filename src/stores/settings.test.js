import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore, defaultSettings, mergeSettings } from './settings.js'

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts with the default ocean theme and Pro enabled', () => {
    const settings = useSettingsStore()
    expect(settings.isPro).toBe(true)
    expect(settings.theme.primary).toBe('#1e3d59')
    expect(settings.winnerDisplay.fields).toEqual([])
  })

  it('persists and reloads a theme change round-trip', () => {
    const settings = useSettingsStore()
    settings.updateTheme({ primary: '#123456', eventTitle: 'Camp Draw' })

    // Fresh store/pinia reading from the same localStorage.
    setActivePinia(createPinia())
    const reloaded = useSettingsStore()
    reloaded.loadFromStorage()
    expect(reloaded.theme.primary).toBe('#123456')
    expect(reloaded.theme.eventTitle).toBe('Camp Draw')
  })

  it('setIsPro toggles and persists the flag', () => {
    const settings = useSettingsStore()
    settings.setIsPro(false)
    expect(settings.isPro).toBe(false)
    expect(JSON.parse(localStorage.getItem('settings')).isPro).toBe(false)
  })

  it('mergeSettings deep-merges partial stored settings over defaults', () => {
    const merged = mergeSettings({ theme: { primary: '#000000' } })
    expect(merged.theme.primary).toBe('#000000')
    // Untouched defaults survive.
    expect(merged.theme.surface).toBe(defaultSettings().theme.surface)
    expect(merged.winnerDisplay.nameFormat).toBe('first-last')
    expect(merged.isPro).toBe(true)
  })

  it('mergeSettings falls back to defaults for malformed input', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
    expect(mergeSettings('nope')).toEqual(defaultSettings())
  })

  it('mergeSettings fills spinner + gradient defaults for an older stored blob', () => {
    // Settings persisted by a version that predates spinner/gradient/overrides.
    const merged = mergeSettings({
      isPro: true,
      theme: { primary: '#123456', backgroundStyle: 'solid' },
      winnerDisplay: { nameFormat: 'first' },
      animationStyle: 'wheel',
      celebration: { confetti: false },
    })
    expect(merged.theme.primary).toBe('#123456')
    expect(merged.theme.backgroundGradient).toEqual(defaultSettings().theme.backgroundGradient)
    expect(merged.theme.showEventTitle).toBe(true)
    expect(merged.theme.textColor).toBeNull()
    expect(merged.spinner).toEqual(defaultSettings().spinner)
  })

  it('mergeSettings rejects invalid backgroundStyle, spinner colorMode and position', () => {
    const merged = mergeSettings({
      theme: { backgroundStyle: 'plaid' },
      spinner: { colorMode: 'disco', position: 'upside-down', customColors: 'nope' },
    })
    expect(merged.theme.backgroundStyle).toBe('waves')
    expect(merged.spinner.colorMode).toBe('default')
    expect(merged.spinner.position).toBe('center')
    expect(merged.spinner.customColors).toEqual(defaultSettings().spinner.customColors)
  })

  it('mergeSettings clamps giantZoom into [2, 6] and defaults non-numbers', () => {
    expect(mergeSettings({ spinner: { giantZoom: 4 } }).spinner.giantZoom).toBe(4)
    expect(mergeSettings({ spinner: { giantZoom: 1 } }).spinner.giantZoom).toBe(2)
    expect(mergeSettings({ spinner: { giantZoom: 99 } }).spinner.giantZoom).toBe(6)
    expect(mergeSettings({ spinner: { giantZoom: 'huge' } }).spinner.giantZoom).toBe(2)
    expect(mergeSettings({ spinner: { giantZoom: NaN } }).spinner.giantZoom).toBe(2)
    // Older blobs without the field get the default.
    expect(mergeSettings({ spinner: { size: 480 } }).spinner.giantZoom).toBe(2)
  })

  it('mergeSettings round-trips a gradient background', () => {
    const merged = mergeSettings({
      theme: {
        backgroundStyle: 'gradient',
        backgroundGradient: { from: '#000000', to: '#ffffff', angle: 45 },
      },
    })
    expect(merged.theme.backgroundStyle).toBe('gradient')
    expect(merged.theme.backgroundGradient).toEqual({ from: '#000000', to: '#ffffff', angle: 45 })
  })

  it('updateSpinner patches and persists spinner settings round-trip', () => {
    const settings = useSettingsStore()
    settings.updateSpinner({ colorMode: 'theme', size: 600, position: 'left', offsetX: 40 })

    setActivePinia(createPinia())
    const reloaded = useSettingsStore()
    reloaded.loadFromStorage()
    expect(reloaded.spinner.colorMode).toBe('theme')
    expect(reloaded.spinner.size).toBe(600)
    expect(reloaded.spinner.position).toBe('left')
    expect(reloaded.spinner.offsetX).toBe(40)
    // Untouched fields keep their defaults.
    expect(reloaded.spinner.pointerColor).toBe('#ff6f61')
  })

  it('resetSettings restores spinner defaults too', () => {
    const settings = useSettingsStore()
    settings.updateSpinner({ size: 700, pointerColor: '#000000' })
    settings.resetSettings()
    expect(settings.spinner).toEqual(defaultSettings().spinner)
  })

  it('syncFields adds new keys and drops removed ones, keeping order/labels', () => {
    const settings = useSettingsStore()
    settings.syncFields(['Grade', 'Bus Route'])
    expect(settings.winnerDisplay.fields.map((f) => f.key)).toEqual(['Grade', 'Bus Route'])

    settings.setFieldLabel('Grade', 'School Grade')
    // 'Bus Route' disappears, 'Parent' appears.
    settings.syncFields(['Grade', 'Parent'])
    const fields = settings.winnerDisplay.fields
    expect(fields.map((f) => f.key)).toEqual(['Grade', 'Parent'])
    expect(fields[0].label).toBe('School Grade') // label preserved
  })

  it('moveField reorders within bounds and ignores out-of-range moves', () => {
    const settings = useSettingsStore()
    settings.syncFields(['A', 'B', 'C'])
    settings.moveField('B', 'up')
    expect(settings.winnerDisplay.fields.map((f) => f.key)).toEqual(['B', 'A', 'C'])

    settings.moveField('B', 'up') // already first — no-op
    expect(settings.winnerDisplay.fields.map((f) => f.key)).toEqual(['B', 'A', 'C'])

    settings.moveField('C', 'down') // already last — no-op
    expect(settings.winnerDisplay.fields.map((f) => f.key)).toEqual(['B', 'A', 'C'])
  })

  it('setFieldVisible toggles a single field', () => {
    const settings = useSettingsStore()
    settings.syncFields(['Grade'])
    settings.setFieldVisible('Grade', false)
    expect(settings.winnerDisplay.fields[0].visible).toBe(false)
  })

  it('resetSettings restores defaults and clears storage', () => {
    const settings = useSettingsStore()
    settings.updateTheme({ primary: '#000000' })
    settings.setAnimationStyle('wheel')
    settings.updateCelebration({ confetti: false, sound: false })
    settings.resetSettings()
    expect(settings.theme.primary).toBe('#1e3d59')
    expect(settings.animationStyle).toBe('classic')
    expect(settings.celebration).toEqual({ confetti: true, sound: true })
    expect(localStorage.getItem('settings')).toBe(null)
  })

  describe('animation & celebration', () => {
    it('defaults to the classic style with confetti and sound enabled', () => {
      const settings = useSettingsStore()
      expect(settings.animationStyle).toBe('classic')
      expect(settings.celebration).toEqual({ confetti: true, sound: true })
    })

    it('setAnimationStyle accepts known styles and persists', () => {
      const settings = useSettingsStore()
      settings.setAnimationStyle('wheel')
      expect(settings.animationStyle).toBe('wheel')
      expect(JSON.parse(localStorage.getItem('settings')).animationStyle).toBe('wheel')
    })

    it('setAnimationStyle accepts the giant wheel style', () => {
      const settings = useSettingsStore()
      settings.setAnimationStyle('wheel-giant')
      expect(settings.animationStyle).toBe('wheel-giant')
      expect(JSON.parse(localStorage.getItem('settings')).animationStyle).toBe('wheel-giant')
    })

    it('setAnimationStyle falls back to classic for an unknown value', () => {
      const settings = useSettingsStore()
      settings.setAnimationStyle('disco')
      expect(settings.animationStyle).toBe('classic')
    })

    it('updateCelebration patches individual flags', () => {
      const settings = useSettingsStore()
      settings.updateCelebration({ confetti: false })
      expect(settings.celebration.confetti).toBe(false)
      expect(settings.celebration.sound).toBe(true)
    })

    it('mergeSettings round-trips animation style and celebration flags', () => {
      const merged = mergeSettings({
        animationStyle: 'reel',
        celebration: { sound: false },
      })
      expect(merged.animationStyle).toBe('reel')
      expect(merged.celebration).toEqual({ confetti: true, sound: false })
    })

    it('mergeSettings rejects an unknown animation style', () => {
      const merged = mergeSettings({ animationStyle: 'made-up' })
      expect(merged.animationStyle).toBe('classic')
    })

    it('persists and reloads animation style + celebration', () => {
      const settings = useSettingsStore()
      settings.setAnimationStyle('reel')
      settings.updateCelebration({ confetti: false })

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.animationStyle).toBe('reel')
      expect(reloaded.celebration.confetti).toBe(false)
      expect(reloaded.celebration.sound).toBe(true)
    })
  })
})
