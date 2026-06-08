import { defineStore } from 'pinia'

const SETTINGS_KEY = 'settings'

// Default look mirrors the original "ocean" palette so existing installs are
// visually unchanged until the user customizes anything.
export function defaultSettings() {
  return {
    // Pro feature flag. Features are built but ungated for now.
    // TODO: replace this with real license/payment enforcement.
    isPro: true,
    theme: {
      primary: '#1e3d59', // Deep Blue
      secondary: '#1c8c9a', // Sea Blue
      accent: '#ff6f61', // Coral
      background: '#e0f7fa', // Light Aqua
      surface: '#ffffff', // White cards
      fontFamily: 'Poppins',
      backgroundStyle: 'waves', // 'waves' | 'solid' | 'image'
      backgroundImage: null, // data URL when backgroundStyle === 'image'
      logo: null, // data URL shown above the drawing card
      eventTitle: "It's drawing time!",
    },
    winnerDisplay: {
      nameFormat: 'first-last', // 'first-last' | 'first' | 'last-first'
      showLabels: true,
      // Ordered detail rows shown under the winner's name. `key` matches an
      // extras header; `visible` toggles it; `label` overrides the displayed text.
      fields: [],
    },
    // Reveal animation variant for the drawing screen. The picking math is
    // identical across styles; the variant tweaks timing curves and adds a CSS
    // class so each looks/feels distinct.
    animationStyle: 'classic', // 'classic' | 'wheel' | 'reel'
    // Post-reveal celebration. Both are opt-out so existing installs keep the
    // bigger-feeling default presentation.
    celebration: {
      confetti: true,
      sound: true,
    },
  }
}

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const ANIMATION_STYLES = ['classic', 'wheel', 'wheel-giant', 'reel']

// Deep-merge stored settings over the defaults so settings saved by an older
// version (missing newly-added fields) still load cleanly.
export function mergeSettings(stored) {
  const base = defaultSettings()
  if (!stored || typeof stored !== 'object') return base
  return {
    isPro: typeof stored.isPro === 'boolean' ? stored.isPro : base.isPro,
    theme: { ...base.theme, ...(stored.theme || {}) },
    winnerDisplay: {
      ...base.winnerDisplay,
      ...(stored.winnerDisplay || {}),
      fields: Array.isArray(stored.winnerDisplay?.fields)
        ? stored.winnerDisplay.fields
        : base.winnerDisplay.fields,
    },
    animationStyle: ANIMATION_STYLES.includes(stored.animationStyle)
      ? stored.animationStyle
      : base.animationStyle,
    celebration: { ...base.celebration, ...(stored.celebration || {}) },
  }
}

export const useSettingsStore = defineStore('settingsStore', {
  state: () => defaultSettings(),
  actions: {
    loadFromStorage() {
      const merged = mergeSettings(readJSON(SETTINGS_KEY, null))
      this.isPro = merged.isPro
      this.theme = merged.theme
      this.winnerDisplay = merged.winnerDisplay
      this.animationStyle = merged.animationStyle
      this.celebration = merged.celebration
    },
    persist() {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          isPro: this.isPro,
          theme: this.theme,
          winnerDisplay: this.winnerDisplay,
          animationStyle: this.animationStyle,
          celebration: this.celebration,
        }),
      )
    },
    setAnimationStyle(value) {
      this.animationStyle = ANIMATION_STYLES.includes(value) ? value : 'classic'
      this.persist()
    },
    updateCelebration(partial) {
      this.celebration = { ...this.celebration, ...partial }
      this.persist()
    },
    setIsPro(value) {
      this.isPro = value
      this.persist()
    },
    updateTheme(partial) {
      this.theme = { ...this.theme, ...partial }
      this.persist()
    },
    updateWinnerDisplay(partial) {
      this.winnerDisplay = { ...this.winnerDisplay, ...partial }
      this.persist()
    },
    // Ensure winnerDisplay.fields contains an entry for every available key,
    // preserving existing order/labels and appending newly-seen keys.
    syncFields(availableKeys) {
      const existing = this.winnerDisplay.fields
      const known = new Set(existing.map((f) => f.key))
      const next = existing.filter((f) => availableKeys.includes(f.key))
      for (const key of availableKeys) {
        if (!known.has(key)) {
          next.push({ key, label: key, visible: true })
        }
      }
      this.winnerDisplay = { ...this.winnerDisplay, fields: next }
      this.persist()
    },
    setFieldVisible(key, visible) {
      const field = this.winnerDisplay.fields.find((f) => f.key === key)
      if (field) {
        field.visible = visible
        this.persist()
      }
    },
    setFieldLabel(key, label) {
      const field = this.winnerDisplay.fields.find((f) => f.key === key)
      if (field) {
        field.label = label
        this.persist()
      }
    },
    moveField(key, dir) {
      const fields = this.winnerDisplay.fields
      const idx = fields.findIndex((f) => f.key === key)
      if (idx === -1) return
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= fields.length) return
      ;[fields[idx], fields[swap]] = [fields[swap], fields[idx]]
      this.persist()
    },
    resetSettings() {
      const fresh = defaultSettings()
      this.isPro = fresh.isPro
      this.theme = fresh.theme
      this.winnerDisplay = fresh.winnerDisplay
      this.animationStyle = fresh.animationStyle
      this.celebration = fresh.celebration
      localStorage.removeItem(SETTINGS_KEY)
    },
  },
})
