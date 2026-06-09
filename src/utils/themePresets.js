// Curated theme presets. Each preset is a pure color block that can be merged
// onto `settings.theme` via `settings.applyPreset(preset.colors)`. Only color
// slots are included so applying a preset leaves font/background/logo/title
// untouched. `headingColor`/`winnerNameColor` are explicit so a preset can give
// headings their own accent (null means "fall back to primary").

export const THEME_PRESETS = [
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      primary: '#1e3d59',
      secondary: '#1c8c9a',
      accent: '#ff6f61',
      background: '#e0f7fa',
      surface: '#ffffff',
      headingColor: null,
      winnerNameColor: null,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      primary: '#7a2048',
      secondary: '#e8543f',
      accent: '#ffb627',
      background: '#fff1e6',
      surface: '#ffffff',
      headingColor: '#7a2048',
      winnerNameColor: '#e8543f',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#1b3a2b',
      secondary: '#3f7d4f',
      accent: '#f2b441',
      background: '#eaf3ec',
      surface: '#ffffff',
      headingColor: '#1b3a2b',
      winnerNameColor: '#2f6f3e',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      primary: '#e8eaf6',
      secondary: '#7c83ff',
      accent: '#ff5ca2',
      background: '#10131f',
      surface: '#1d2233',
      headingColor: '#e8eaf6',
      winnerNameColor: '#7c83ff',
    },
  },
  {
    id: 'candy',
    name: 'Candy',
    colors: {
      primary: '#c2185b',
      secondary: '#7b3ff2',
      accent: '#19c3c9',
      background: '#fde7f1',
      surface: '#ffffff',
      headingColor: '#c2185b',
      winnerNameColor: '#7b3ff2',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    colors: {
      primary: '#222222',
      secondary: '#555555',
      accent: '#888888',
      background: '#f4f4f4',
      surface: '#ffffff',
      headingColor: '#222222',
      winnerNameColor: '#222222',
    },
  },
]
