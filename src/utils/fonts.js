// Font options with real fallback stacks. Until now the app wrote bare family
// names ("Poppins") to CSS without loading any webfont, so they only rendered
// when installed locally. Each option carries a full stack (so the fallback is
// deliberate, not browser-default), and Google-hosted fonts are fetched with a
// guarded one-time <link> injection — never in the portable file:// build,
// which must work fully offline.
import { isPortable } from './platform.js'

export const FONT_OPTIONS = [
  { name: 'Poppins', stack: "'Poppins', 'Segoe UI', sans-serif", google: true },
  { name: 'Inter', stack: "'Inter', 'Helvetica Neue', Arial, sans-serif", google: true },
  { name: 'Montserrat', stack: "'Montserrat', 'Trebuchet MS', sans-serif", google: true },
  { name: 'Nunito', stack: "'Nunito', 'Segoe UI', sans-serif", google: true },
  { name: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", google: true },
  { name: 'Bebas Neue', stack: "'Bebas Neue', 'Arial Narrow', sans-serif", google: true },
  { name: 'Caveat', stack: "'Caveat', 'Comic Sans MS', cursive", google: true },
  { name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { name: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { name: 'Trebuchet MS', stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
  { name: 'Comic Sans MS', stack: "'Comic Sans MS', 'Comic Sans', cursive" },
  { name: 'Courier New', stack: "'Courier New', Courier, monospace" },
]

const byName = new Map(FONT_OPTIONS.map((f) => [f.name, f]))

// CSS font-family stack for a configured family name. Unknown names (e.g. from
// an edited backup) still render with a sane sans-serif fallback.
export function fontStack(name) {
  return byName.get(name)?.stack ?? `'${name}', sans-serif`
}

const LINK_ATTR = 'data-app-font'

// Inject a Google Fonts stylesheet for `name`, once per family. No-ops for
// system fonts, unknown names, and the portable build (file:// must never
// touch the network). A failed fetch is harmless — the stack's fallback shows.
export function ensureFontLoaded(name, { doc = typeof document === 'undefined' ? null : document } = {}) {
  const font = byName.get(name)
  if (!font?.google || !doc || isPortable()) return false
  if (doc.querySelector(`link[${LINK_ATTR}="${name}"]`)) return false
  const link = doc.createElement('link')
  link.rel = 'stylesheet'
  link.setAttribute(LINK_ATTR, name)
  const family = encodeURIComponent(name).replace(/%20/g, '+')
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700&display=swap`
  doc.head.appendChild(link)
  return true
}
