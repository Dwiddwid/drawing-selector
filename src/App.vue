<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { useParticipantStore } from './stores/participants.js'
import { useSettingsStore, clampLogoHeight } from './stores/settings.js'
import { useStoreSync } from './composables/useStoreSync.js'
import { darken, lighten } from './utils/color.js'
import { fontStack, ensureFontLoaded } from './utils/fonts.js'
import { computed, onMounted, watch } from 'vue'

const store = useParticipantStore()
const settings = useSettingsStore()
const theme = useTheme()

// Live multi-display sync: reload stores when another tab persists a change.
useStoreSync()

const themeName = computed(() =>
  settings.theme.mode === 'dark' ? 'customThemeDark' : 'customTheme',
)

// Push the user's theme settings into Vuetify's live theme colors and into
// CSS variables consumed by the global styles / drawing screen.
function applyTheme(t) {
  const dark = t.mode === 'dark'
  // Dark mode darkens the user's background/surface rather than replacing
  // them, so presets and custom palettes keep their hue identity. Explicit
  // color overrides below still win untouched.
  const background = dark ? darken(t.background, 0.75) : t.background
  const surface = dark ? darken(t.surface, 0.82) : t.surface
  for (const name of ['customTheme', 'customThemeDark']) {
    const colors = theme.themes.value[name]?.colors
    if (!colors) continue
    colors.primary = t.primary
    colors.secondary = t.secondary
    colors.accent = t.accent
    colors.background = background
    colors.surface = surface
  }

  const root = document.documentElement
  root.style.setProperty('--app-font', fontStack(t.fontFamily))
  // Fetch the webfont when it's a Google-hosted family (no-op offline/portable).
  ensureFontLoaded(t.fontFamily)
  root.style.setProperty('--app-primary', t.primary)
  root.style.setProperty('--app-accent', t.accent)
  root.style.setProperty('--app-background', background)
  root.style.setProperty('--app-surface', surface)
  // Optional overrides — null falls back to the palette-derived defaults
  // (lightened in dark mode so derived text stays readable on dark surfaces).
  const derivedText = dark ? lighten(t.primary, 0.45) : t.primary
  root.style.setProperty('--app-text', t.textColor || derivedText)
  root.style.setProperty('--app-headline', t.headlineColor || derivedText)
  root.style.setProperty('--app-winner-card-bg', t.winnerCardBg || surface)
  root.style.setProperty('--app-winner-card-text', t.winnerCardText || derivedText)
  root.style.setProperty('--app-logo-height', `${clampLogoHeight(t.logoHeightVh)}vh`)
  // Dark mode dims whatever backdrop is in play — including the animated waves,
  // whose artwork is a fixed bright-blue SVG that ignores the palette. Without
  // this the "dark" theme lightens the text over an unchanged bright background,
  // which is worse than light mode.
  root.style.setProperty('--app-bg-scrim', dark ? 'rgba(0, 0, 0, 0.55)' : 'transparent')
  document.body.classList.toggle('app-dark', dark)

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
  <v-app :theme="themeName"> <RouterView /></v-app>
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

/* Dark-mode scrim. The wave background is painted by .v-application itself (with
   !important), so it can't be recolored — instead this pseudo-element lays a
   translucent black sheet over it, beneath all app content. Fully transparent
   in light mode. */
.v-application::before {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--app-bg-scrim, transparent);
  pointer-events: none;
}

a {
  color: var(--app-accent, #ff6f61);
}

.v-btn {
  border-radius: 20px; /* Rounded buttons for a softer look */
}
</style>
