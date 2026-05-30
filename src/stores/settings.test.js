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
    settings.resetSettings()
    expect(settings.theme.primary).toBe('#1e3d59')
    expect(localStorage.getItem('settings')).toBe(null)
  })
})
