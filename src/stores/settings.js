import { defineStore } from 'pinia'
import { DEFAULT_WHEEL_COLORS } from '../utils/wheel.js'
import { broadcastSync } from '../utils/sync.js'

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
      backgroundStyle: 'waves', // 'waves' | 'solid' | 'image' | 'gradient'
      backgroundImage: null, // data URL when backgroundStyle === 'image'
      backgroundGradient: { from: '#1e3d59', to: '#1c8c9a', angle: 160 },
      logo: null, // data URL shown above the drawing card
      eventTitle: "It's drawing time!",
      showEventTitle: true,
      // Optional overrides. null = derive from the palette above (textColor and
      // headlineColor fall back to primary; winnerCardBg to surface;
      // winnerCardText to primary) — which is the original look.
      textColor: null,
      headlineColor: null,
      winnerCardBg: null,
      winnerCardText: null,
    },
    winnerDisplay: {
      // Ordered field keys that compose the headline/title, joined by
      // `nameSeparator`. Defaults reproduce the original "First Last" look.
      nameKeys: ['First Name', 'Last Name'],
      nameSeparator: ' ',
      showLabels: true,
      // Per-field config. `key` matches a participant field key; `visible`
      // toggles it; `label` overrides the displayed text. Name fields also
      // appear here so their label is editable, but render as the headline.
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
    // Participant list display options.
    participantList: {
      hideZeroEntries: false, // when true, 0-entry participants are hidden from the admin list
      entriesMode: 'odds',          // 'odds' | 'multi-win'
      maxWinsPerParticipant: null,  // null = no cap, positive integer = cap
    },
    // Wheel-spinner appearance. Size/position/offsets apply to the standard
    // wheel only — the giant wheel is full-viewport by design.
    spinner: {
      colorMode: 'default', // 'default' | 'theme' (derived from palette) | 'custom'
      customColors: [...DEFAULT_WHEEL_COLORS],
      pointerColor: '#ff6f61',
      size: 480, // px, 280–1200
      position: 'center', // 'center' | 'left' | 'right'
      offsetX: 0, // px fine-tune from the anchored position
      offsetY: 0,
      // Giant wheel only: how far the wheel's center sits below the screen
      // (multiples of the viewport height). Larger = bigger radius = bigger
      // names — the lever that keeps 400-participant pools legible. 2 is the
      // original look; the minimum that still guarantees full corner coverage.
      giantZoom: 2, // 2–6
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

// Map the legacy `nameFormat` enum onto the generic name-field config so older
// installs/backups keep their "First Last" / "Last, First" headline.
const LEGACY_NAME_FORMATS = {
  'first-last': { nameKeys: ['First Name', 'Last Name'], nameSeparator: ' ' },
  'last-first': { nameKeys: ['Last Name', 'First Name'], nameSeparator: ', ' },
  first: { nameKeys: ['First Name'], nameSeparator: ' ' },
}

function mergeWinnerDisplay(stored, base) {
  const sw = stored || {}
  const merged = {
    ...base,
    ...sw,
    fields: Array.isArray(sw.fields) ? sw.fields : base.fields,
  }
  // Migrate legacy nameFormat → nameKeys/nameSeparator when the new keys are
  // absent.
  if (!Array.isArray(sw.nameKeys) && sw.nameFormat) {
    const legacy = LEGACY_NAME_FORMATS[sw.nameFormat] || LEGACY_NAME_FORMATS['first-last']
    merged.nameKeys = legacy.nameKeys
    merged.nameSeparator = legacy.nameSeparator
  }
  if (!Array.isArray(merged.nameKeys)) merged.nameKeys = [...base.nameKeys]
  if (typeof merged.nameSeparator !== 'string') merged.nameSeparator = base.nameSeparator
  delete merged.nameFormat
  return merged
}

const ANIMATION_STYLES = ['classic', 'wheel', 'wheel-giant', 'reel']
const BACKGROUND_STYLES = ['waves', 'solid', 'image', 'gradient']
const SPINNER_COLOR_MODES = ['default', 'theme', 'custom']
const SPINNER_POSITIONS = ['center', 'left', 'right']

// Deep-merge stored settings over the defaults so settings saved by an older
// version (missing newly-added fields) still load cleanly.
export function mergeSettings(stored) {
  const base = defaultSettings()
  if (!stored || typeof stored !== 'object') return base
  const theme = {
    ...base.theme,
    ...(stored.theme || {}),
    backgroundGradient: {
      ...base.theme.backgroundGradient,
      ...(stored.theme?.backgroundGradient || {}),
    },
  }
  if (!BACKGROUND_STYLES.includes(theme.backgroundStyle)) {
    theme.backgroundStyle = base.theme.backgroundStyle
  }
  const spinner = { ...base.spinner, ...(stored.spinner || {}) }
  if (!SPINNER_COLOR_MODES.includes(spinner.colorMode)) spinner.colorMode = base.spinner.colorMode
  if (!SPINNER_POSITIONS.includes(spinner.position)) spinner.position = base.spinner.position
  if (!Array.isArray(spinner.customColors) || spinner.customColors.length === 0) {
    spinner.customColors = [...base.spinner.customColors]
  }
  if (typeof spinner.giantZoom !== 'number' || Number.isNaN(spinner.giantZoom)) {
    spinner.giantZoom = base.spinner.giantZoom
  } else {
    spinner.giantZoom = Math.min(6, Math.max(2, spinner.giantZoom))
  }
  return {
    isPro: typeof stored.isPro === 'boolean' ? stored.isPro : base.isPro,
    theme,
    winnerDisplay: mergeWinnerDisplay(stored.winnerDisplay, base.winnerDisplay),
    animationStyle: ANIMATION_STYLES.includes(stored.animationStyle)
      ? stored.animationStyle
      : base.animationStyle,
    celebration: { ...base.celebration, ...(stored.celebration || {}) },
    spinner,
    participantList: (() => {
      const pl = { ...base.participantList, ...(stored.participantList || {}) }
      if (!['odds', 'multi-win'].includes(pl.entriesMode)) {
        pl.entriesMode = base.participantList.entriesMode
      }
      if (pl.maxWinsPerParticipant !== null) {
        const cap = Math.floor(Number(pl.maxWinsPerParticipant))
        pl.maxWinsPerParticipant = cap > 0 ? cap : null
      }
      return pl
    })(),
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
      this.spinner = merged.spinner
      this.participantList = merged.participantList
    },
    persist() {
      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            isPro: this.isPro,
            theme: this.theme,
            winnerDisplay: this.winnerDisplay,
            animationStyle: this.animationStyle,
            celebration: this.celebration,
            spinner: this.spinner,
            participantList: this.participantList,
          }),
        )
      } catch {
        // Quota exceeded (large background image / logo data URLs). The
        // in-memory settings still apply for this session.
        return
      }
      broadcastSync('settings')
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
    updateSpinner(partial) {
      this.spinner = { ...this.spinner, ...partial }
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
    setNameKeys(keys) {
      this.winnerDisplay = { ...this.winnerDisplay, nameKeys: [...keys] }
      this.persist()
    },
    toggleNameKey(key) {
      const current = this.winnerDisplay.nameKeys
      const nameKeys = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
      this.winnerDisplay = { ...this.winnerDisplay, nameKeys }
      this.persist()
    },
    setNameSeparator(sep) {
      this.winnerDisplay = { ...this.winnerDisplay, nameSeparator: sep }
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
    updateParticipantList(partial) {
      this.participantList = { ...this.participantList, ...partial }
      this.persist()
    },
    resetSettings() {
      const fresh = defaultSettings()
      this.isPro = fresh.isPro
      this.theme = fresh.theme
      this.winnerDisplay = fresh.winnerDisplay
      this.animationStyle = fresh.animationStyle
      this.celebration = fresh.celebration
      this.spinner = fresh.spinner
      this.participantList = fresh.participantList
      localStorage.removeItem(SETTINGS_KEY)
      broadcastSync('settings')
    },
  },
})
