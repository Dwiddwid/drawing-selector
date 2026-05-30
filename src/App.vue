<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { useParticipantStore } from './stores/participants.js'
import { useSettingsStore } from './stores/settings.js'
import { onMounted, watch } from 'vue'

const store = useParticipantStore()
const settings = useSettingsStore()
const theme = useTheme()

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

  if (t.backgroundStyle === 'image' && t.backgroundImage) {
    root.style.setProperty('--app-bg-image', `url("${t.backgroundImage}")`)
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
  border-radius: 20px; /* Rounded buttons for a softer look */
}
</style>
