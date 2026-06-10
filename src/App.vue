<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { useParticipantStore } from './stores/participants.js'
import { useSettingsStore } from './stores/settings.js'
import { useStoreSync } from './composables/useStoreSync.js'
import { onMounted, watch } from 'vue'

const store = useParticipantStore()
const settings = useSettingsStore()
const theme = useTheme()

// Live multi-display sync: reload stores when another tab persists a change.
useStoreSync()

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
  // Optional overrides — null falls back to the palette-derived defaults.
  root.style.setProperty('--app-text', t.textColor || t.primary)
  root.style.setProperty('--app-headline', t.headlineColor || t.primary)
  root.style.setProperty('--app-winner-card-bg', t.winnerCardBg || t.surface)
  root.style.setProperty('--app-winner-card-text', t.winnerCardText || t.primary)

  if (t.backgroundStyle === 'image' && t.backgroundImage) {
    // Strip quotes and backslashes so a malformed data URL from a restored JSON
    // backup cannot break out of the CSS string and inject arbitrary properties.
    const safe = t.backgroundImage.replace(/["\\]/g, '')
    root.style.setProperty('--app-bg-image', `url("${safe}")`)
  } else if (t.backgroundStyle === 'gradient' && t.backgroundGradient) {
    const g = t.backgroundGradient
    // Gradient values come from Vuetify color pickers (hex only) so no escaping
    // is needed, but strip anything outside a-f, 0-9, #, comma, space, deg.
    const safeTo = g.to.replace(/[^a-fA-F0-9#]/g, '')
    const safeFrom = g.from.replace(/[^a-fA-F0-9#]/g, '')
    root.style.setProperty('--app-bg-image', `linear-gradient(${Number(g.angle)}deg, ${safeFrom}, ${safeTo})`)
  } else {
    root.style.setProperty('--app-bg-image', 'none')
  }
  // Toggle the animated wave background only in 'waves' mode.
  document.body.classList.toggle('app-bg-waves', t.backgroundStyle === 'waves')
  document.body.classList.toggle('app-bg-plain', t.backgroundStyle !== 'waves')
}

onMounted(() => {
  store.loadFromStorage()
  settings.loadFromStorage()
  applyTheme(settings.theme)
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
  color: var(--app-text, var(--app-primary, #1e3d59));
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
  border-radius: 20px; /* Rounded buttons for a softer look */
}
</style>
