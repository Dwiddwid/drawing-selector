import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore, defaultSettings, mergeSettings, clampDrawCount } from './settings.js'

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
    expect(merged.winnerDisplay.nameKeys).toEqual(['First Name', 'Last Name'])
    expect(merged.winnerDisplay.nameSeparator).toBe(' ')
    expect(merged.isPro).toBe(true)
  })

  it('mergeSettings migrates a legacy nameFormat to nameKeys/nameSeparator', () => {
    expect(mergeSettings({ winnerDisplay: { nameFormat: 'last-first' } }).winnerDisplay).toMatchObject(
      { nameKeys: ['Last Name', 'First Name'], nameSeparator: ', ' },
    )
    const first = mergeSettings({ winnerDisplay: { nameFormat: 'first' } }).winnerDisplay
    expect(first.nameKeys).toEqual(['First Name'])
    expect('nameFormat' in first).toBe(false)
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

  describe('participantList', () => {
    it('defaults hideZeroEntries to false', () => {
      const settings = useSettingsStore()
      expect(settings.participantList).toMatchObject({ hideZeroEntries: false, entriesMode: 'odds', maxWinsPerParticipant: null })
    })

    it('updateParticipantList patches and persists', () => {
      const settings = useSettingsStore()
      settings.updateParticipantList({ hideZeroEntries: true })
      expect(settings.participantList.hideZeroEntries).toBe(true)
      expect(JSON.parse(localStorage.getItem('settings')).participantList.hideZeroEntries).toBe(true)
    })

    it('mergeSettings deep-merges participantList from stored blob', () => {
      const merged = mergeSettings({ participantList: { hideZeroEntries: true } })
      expect(merged.participantList.hideZeroEntries).toBe(true)
    })

    it('mergeSettings fills participantList defaults for older blobs that lack it', () => {
      const merged = mergeSettings({ isPro: true, animationStyle: 'classic' })
      expect(merged.participantList).toMatchObject({ hideZeroEntries: false, entriesMode: 'odds', maxWinsPerParticipant: null })
    })

    it('persists and reloads participantList round-trip', () => {
      const settings = useSettingsStore()
      settings.updateParticipantList({ hideZeroEntries: true })

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.participantList.hideZeroEntries).toBe(true)
    })

    it('resetSettings restores participantList defaults', () => {
      const settings = useSettingsStore()
      settings.updateParticipantList({ hideZeroEntries: true })
      settings.resetSettings()
      expect(settings.participantList).toEqual(defaultSettings().participantList)
    })
  })

  describe('drawTiming', () => {
    it('defaults to fixed ~4.5s', () => {
      const settings = useSettingsStore()
      expect(settings.drawTiming).toEqual({
        mode: 'fixed',
        fixedMs: 4500,
        minMs: 3000,
        maxMs: 8000,
      })
    })

    it('updateDrawTiming patches, validates the mode, and persists', () => {
      const settings = useSettingsStore()
      settings.updateDrawTiming({ mode: 'random', minMs: 1000, maxMs: 5000 })
      expect(settings.drawTiming).toMatchObject({ mode: 'random', minMs: 1000, maxMs: 5000 })
      // An unknown mode is rejected, keeping the prior value.
      settings.updateDrawTiming({ mode: 'disco' })
      expect(settings.drawTiming.mode).toBe('random')
      expect(JSON.parse(localStorage.getItem('settings')).drawTiming.mode).toBe('random')
    })

    it('updateDrawTiming clamps out-of-range durations', () => {
      const settings = useSettingsStore()
      settings.updateDrawTiming({ fixedMs: 0, minMs: 999999 })
      expect(settings.drawTiming.fixedMs).toBe(500) // MIN_DRAW_MS
      expect(settings.drawTiming.minMs).toBe(30000) // MAX_DRAW_MS
    })

    it('mergeSettings fills drawTiming defaults for older blobs that lack it', () => {
      const merged = mergeSettings({ isPro: true, animationStyle: 'classic' })
      expect(merged.drawTiming).toEqual(defaultSettings().drawTiming)
    })

    it('mergeSettings validates mode and clamps durations from a stored blob', () => {
      const merged = mergeSettings({
        drawTiming: { mode: 'bogus', fixedMs: 100, minMs: 50, maxMs: 99999 },
      })
      expect(merged.drawTiming.mode).toBe('fixed')
      expect(merged.drawTiming.fixedMs).toBe(500)
      expect(merged.drawTiming.minMs).toBe(500)
      expect(merged.drawTiming.maxMs).toBe(30000)
    })

    it('persists and reloads drawTiming round-trip', () => {
      const settings = useSettingsStore()
      settings.updateDrawTiming({ mode: 'manual' })

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.drawTiming.mode).toBe('manual')
    })

    it('resetSettings restores drawTiming defaults', () => {
      const settings = useSettingsStore()
      settings.updateDrawTiming({ mode: 'manual', fixedMs: 9000 })
      settings.resetSettings()
      expect(settings.drawTiming).toEqual(defaultSettings().drawTiming)
    })
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

  describe('multi-winner draws', () => {
    it('defaults to 1 winner per draw, revealed simultaneously', () => {
      const settings = useSettingsStore()
      expect(settings.drawCount).toBe(1)
      expect(settings.multiWinnerReveal).toBe('simultaneous')
    })

    it('clampDrawCount floors, clamps to [1, 20], and falls back on junk', () => {
      expect(clampDrawCount(3)).toBe(3)
      expect(clampDrawCount(3.9)).toBe(3)
      expect(clampDrawCount(0)).toBe(1)
      expect(clampDrawCount(-5)).toBe(1)
      expect(clampDrawCount(999)).toBe(20)
      expect(clampDrawCount('abc')).toBe(1)
      expect(clampDrawCount(undefined)).toBe(1)
      expect(clampDrawCount('abc', 5)).toBe(5)
      expect(clampDrawCount('7')).toBe(7)
    })

    it('setDrawCount clamps and persists round-trip', () => {
      const settings = useSettingsStore()
      settings.setDrawCount(5)
      expect(settings.drawCount).toBe(5)
      settings.setDrawCount(999)
      expect(settings.drawCount).toBe(20)
      settings.setDrawCount('junk') // keeps the current value
      expect(settings.drawCount).toBe(20)

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.drawCount).toBe(20)
    })

    it('setMultiWinnerReveal accepts known modes and ignores junk', () => {
      const settings = useSettingsStore()
      settings.setMultiWinnerReveal('sequential')
      expect(settings.multiWinnerReveal).toBe('sequential')
      settings.setMultiWinnerReveal('made-up')
      expect(settings.multiWinnerReveal).toBe('sequential')

      setActivePinia(createPinia())
      const reloaded = useSettingsStore()
      reloaded.loadFromStorage()
      expect(reloaded.multiWinnerReveal).toBe('sequential')
    })

    it('mergeSettings fills defaults for older blobs and validates values', () => {
      expect(mergeSettings({}).drawCount).toBe(1)
      expect(mergeSettings({}).multiWinnerReveal).toBe('simultaneous')
      expect(mergeSettings({ drawCount: 7 }).drawCount).toBe(7)
      expect(mergeSettings({ drawCount: 'junk' }).drawCount).toBe(1)
      expect(mergeSettings({ drawCount: 50 }).drawCount).toBe(20)
      expect(mergeSettings({ multiWinnerReveal: 'sequential' }).multiWinnerReveal).toBe('sequential')
      expect(mergeSettings({ multiWinnerReveal: 'nope' }).multiWinnerReveal).toBe('simultaneous')
    })

    it('resetSettings restores the multi-winner defaults', () => {
      const settings = useSettingsStore()
      settings.setDrawCount(5)
      settings.setMultiWinnerReveal('sequential')
      settings.resetSettings()
      expect(settings.drawCount).toBe(1)
      expect(settings.multiWinnerReveal).toBe('simultaneous')
    })
  })
})
