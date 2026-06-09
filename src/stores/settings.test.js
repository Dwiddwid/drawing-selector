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

  describe('new theme + spinner fields', () => {
    it('defaults the new fields', () => {
      const d = defaultSettings()
      expect(d.theme.showEventTitle).toBe(true)
      expect(d.theme.headingColor).toBeNull()
      expect(d.theme.winnerNameColor).toBeNull()
      expect(d.theme.buttonRoundness).toBe('rounded')
      expect(d.theme.cardOpacity).toBe(1)
      expect(d.theme.cardBlur).toBe(0)
      expect(d.spinner).toEqual({
        segmentColors: null,
        pointerColor: null,
        pointerPosition: 'top',
        wheelScale: 1,
      })
    })

    it('mergeSettings backfills new fields for an old payload', () => {
      const merged = mergeSettings({ theme: { primary: '#000000' } })
      expect(merged.theme.showEventTitle).toBe(true)
      expect(merged.theme.buttonRoundness).toBe('rounded')
      expect(merged.spinner.pointerPosition).toBe('top')
    })

    it('updateSpinner clamps wheelScale and guards pointerPosition', () => {
      const settings = useSettingsStore()
      settings.updateSpinner({ wheelScale: 99, pointerPosition: 'sideways' })
      expect(settings.spinner.wheelScale).toBe(1.4)
      expect(settings.spinner.pointerPosition).toBe('top')
      settings.updateSpinner({ wheelScale: 0.1, pointerPosition: 'left' })
      expect(settings.spinner.wheelScale).toBe(0.6)
      expect(settings.spinner.pointerPosition).toBe('left')
    })

    it('applyPreset merges a color block and persists', () => {
      const settings = useSettingsStore()
      const before = settings.theme.fontFamily
      settings.applyPreset({ primary: '#123456', accent: '#abcdef' })
      expect(settings.theme.primary).toBe('#123456')
      expect(settings.theme.accent).toBe('#abcdef')
      // Non-color theme fields are untouched.
      expect(settings.theme.fontFamily).toBe(before)

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.theme.primary).toBe('#123456')
    })

    it('persists and reloads spinner settings', () => {
      const settings = useSettingsStore()
      settings.updateSpinner({ pointerColor: '#ff00ff', segmentColors: ['#111111'] })

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.spinner.pointerColor).toBe('#ff00ff')
      expect(reloaded.spinner.segmentColors).toEqual(['#111111'])
    })

    it('resetSettings restores spinner defaults', () => {
      const settings = useSettingsStore()
      settings.updateSpinner({ pointerColor: '#ff00ff' })
      settings.resetSettings()
      expect(settings.spinner.pointerColor).toBeNull()
    })
  })
})
