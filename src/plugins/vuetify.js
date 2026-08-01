import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, fa } from 'vuetify/iconsets/fa-svg'
// Live, user-customizable theme. Colors here are overwritten at runtime from the
// settings store (see App.vue); these values are the defaults / fallback.
const customTheme = {
  dark: false,
  colors: {
    primary: '#1e3d59', // Deep Blue
    secondary: '#1c8c9a', // Sea Blue
    accent: '#ff6f61', // Coral
    error: '#b71c1c', // Standard Error Red
    info: '#1e88e5', // Light Blue
    success: '#43a047', // Green
    warning: '#fdd835', // Yellow
    background: '#e0f7fa', // Light Aqua
    surface: '#ffffff', // White for cards
  },
}
// Dark-mode variant, active when settings.theme.mode === 'dark'. Its colors
// are likewise overwritten at runtime (App.vue darkens the user's background/
// surface so presets keep their hue identity); these are the fallbacks.
const customThemeDark = {
  dark: true,
  colors: {
    primary: '#1e3d59',
    secondary: '#1c8c9a',
    accent: '#ff6f61',
    error: '#ef5350',
    info: '#42a5f5',
    success: '#66bb6a',
    warning: '#fdd835',
    background: '#10181e',
    surface: '#1a242c',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: 'customTheme',
    themes: {
      customTheme,
      customThemeDark,
    },
  },
  icons: {
    defaultSet: 'fa',
    aliases,
    sets: {
      fa,
    },
  },
})
