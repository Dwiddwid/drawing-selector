<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { useParticipantStore } from './stores/participants.js'
import { useSettingsStore } from './stores/settings.js'
import { onMounted, onBeforeUnmount, watch } from 'vue'

const store = useParticipantStore()
const settings = useSettingsStore()
const theme = useTheme()

const BUTTON_RADIUS = { pill: '9999px', rounded: '20px', square: '4px' }

// Push the user's theme settings into Vuetify's live theme colors and into
// CSS variables consumed by the global styles / drawing screen.
function applyTheme(t) {
  const colors = theme.themes.value.customTheme.colors
  colors.primary = t.primary
  colors.secondary = t.secondary
  colors.accent = t.accent
  colors.background = t.background
  colors.surface = t.surface

  const root = document.documentElement
  root.style.setProperty('--app-font', t.fontFamily)
  root.style.setProperty('--app-primary', t.primary)
  root.style.setProperty('--app-accent', t.accent)
  root.style.setProperty('--app-background', t.background)
  root.style.setProperty('--app-surface', t.surface)
  // Optional overrides fall back to primary when unset.
  root.style.setProperty('--app-heading', t.headingColor || t.primary)
  root.style.setProperty('--app-winner-name', t.winnerNameColor || t.primary)
  root.style.setProperty('--app-btn-radius', BUTTON_RADIUS[t.buttonRoundness] || BUTTON_RADIUS.rounded)
  root.style.setProperty('--app-card-opacity', t.cardOpacity ?? 1)
  root.style.setProperty('--app-card-blur', `${t.cardBlur ?? 0}px`)

  if (t.backgroundStyle === 'image' && t.backgroundImage) {
    root.style.setProperty('--app-bg-image', `url("${t.backgroundImage}")`)
  } else {
    root.style.setProperty('--app-bg-image', 'none')
  }
  // Toggle the animated wave background only in 'waves' mode.
  document.body.classList.toggle('app-bg-waves', t.backgroundStyle === 'waves')
  document.body.classList.toggle('app-bg-plain', t.backgroundStyle !== 'waves')
}

// Keep a projector window (multi-display mode) in sync with the admin tab. The
// `storage` event fires in *other* same-origin tabs when localStorage changes,
// and also propagates between file:// tabs of the same document — so reloading
// settings here covers both web and the portable Offline Edition without a
// dedicated channel. settings.persist() runs on every change, so updates are
// effectively immediate.
function onStorage(event) {
  if (event.key !== 'settings') return
  settings.loadFromStorage()
  applyTheme(settings.theme)
}

onMounted(() => {
  store.loadFromStorage()
  settings.loadFromStorage()
  applyTheme(settings.theme)
  window.addEventListener('storage', onStorage)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorage)
})

watch(
  () => settings.theme,
  (t) => applyTheme(t),
  { deep: true },
)
</script>

<template>
  <v-app theme="customTheme"> <RouterView /></v-app>
</template>

<style>
*::-webkit-scrollbar {
  display: none;
}
body {
  font-family: var(--app-font, 'Poppins'), sans-serif;
  background-color: var(--app-background, #e0f7fa);
  color: var(--app-primary, #1e3d59);
}

/* Plain background modes hide the animated wave SVG and use a solid color or
   an uploaded image. The wave SVG is defined in wave-bg.css with !important on
   both `body` and `.v-application`, so the overrides below must out-specify it. */
body.app-bg-plain,
body.app-bg-plain .v-application {
  background: var(--app-background, #e0f7fa) !important;
  background-image: var(--app-bg-image, none) !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
}

a {
  color: var(--app-accent, #ff6f61);
}

.v-btn {
  border-radius: var(--app-btn-radius, 20px); /* roundness is theme-configurable */
}
</style>
