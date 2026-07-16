// Winner-reveal celebration effects: a confetti burst rendered onto a
// full-screen canvas, and a short celebratory chime via Web Audio.
//
// Both are no-op-safe: they bail out cleanly when their underlying browser API
// isn't available (e.g. jsdom in tests, the page is hidden, autoplay blocked).

import { lighten } from './color.js'

const CANVAS_ID = 'celebration-canvas'
export const DEFAULT_CONFETTI_COLORS = ['#ff6f61', '#1c8c9a', '#1e3d59', '#ffcf48', '#7ed957', '#e0f7fa']

// Confetti palette derived from the event theme: the three brand colors plus
// lightened variants for visual depth.
export function confettiColorsFromTheme(theme) {
  const { primary, secondary, accent } = theme || {}
  const colors = [primary, secondary, accent].filter(Boolean)
  if (colors.length === 0) return [...DEFAULT_CONFETTI_COLORS]
  return [...colors, ...colors.map((c) => lighten(c, 0.2))]
}

export const INTENSITY_PARTICLES = { low: 80, medium: 160, high: 320 }

// Resolve celebration settings (+ theme) into the concrete options `celebrate`
// consumes: { confetti: { colors, particleCount } | false, sound: { style } |
// false }. Pure so it's testable without a DOM; `scale` shrinks intermediate
// reveals in a multi-winner batch.
export function resolveCelebration(celebration, theme, { scale = 1 } = {}) {
  const c = celebration || {}
  const colors =
    c.confettiColorMode === 'theme'
      ? confettiColorsFromTheme(theme)
      : c.confettiColorMode === 'custom' && c.confettiCustomColors?.length
        ? [...c.confettiCustomColors]
        : [...DEFAULT_CONFETTI_COLORS]
  const particleCount = Math.round((INTENSITY_PARTICLES[c.intensity] ?? INTENSITY_PARTICLES.medium) * scale)
  return {
    confetti: c.confetti ? { colors, particleCount } : false,
    sound: c.sound ? { style: c.soundStyle } : false,
  }
}

export function fireConfetti({
  particleCount = 160,
  durationMs = 2400,
  colors = DEFAULT_CONFETTI_COLORS,
} = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  // Reuse a single canvas across calls so rapid retriggers don't pile up DOM.
  let canvas = document.getElementById(CANVAS_ID)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.id = CANVAS_ID
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9999',
    })
    document.body.appendChild(canvas)
  }
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext?.('2d')
  if (!ctx) return false

  const particles = []
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -16 - 4,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  const gravity = 0.45
  const drag = 0.99
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(Date.now()), 16)

  function frame(now) {
    const elapsed = now - start
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.vy += gravity
      p.vx *= drag
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vRot
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5)
      ctx.restore()
    }
    if (elapsed < durationMs) {
      raf(frame)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.remove()
    }
  }
  raf(frame)
  return true
}

// Win-sound patterns, each a short Web-Audio note list — no asset to bundle.
// { freq, at, dur } per note plus a per-pattern oscillator type and gain.
//   chime   — the original C5-E5-G5-C6 major arpeggio (triangle).
//   fanfare — brassy G4→C5→E5 with a held C6 top note (sawtooth).
//   tada    — two-note C5→C6 leap with a long ringing decay (triangle).
const SOUND_PATTERNS = {
  chime: {
    type: 'triangle',
    gain: 0.25,
    notes: [523.25, 659.25, 783.99, 1046.5].map((freq, i) => ({
      freq,
      at: i * 0.18 * 0.7,
      dur: 0.18,
    })),
  },
  fanfare: {
    type: 'sawtooth',
    gain: 0.15,
    notes: [
      { freq: 392.0, at: 0, dur: 0.16 },
      { freq: 523.25, at: 0.14, dur: 0.16 },
      { freq: 659.25, at: 0.28, dur: 0.16 },
      { freq: 1046.5, at: 0.42, dur: 0.5 },
    ],
  },
  tada: {
    type: 'triangle',
    gain: 0.28,
    notes: [
      { freq: 523.25, at: 0, dur: 0.14 },
      { freq: 1046.5, at: 0.16, dur: 0.7 },
    ],
  },
}

export function playWinnerSound({ style = 'chime', AudioContextCtor } = {}) {
  if (typeof window === 'undefined') return false
  const Ctor = AudioContextCtor || window.AudioContext || window.webkitAudioContext
  if (!Ctor) return false
  let ctx
  try {
    ctx = new Ctor()
  } catch {
    return false
  }
  const pattern = SOUND_PATTERNS[style] ?? SOUND_PATTERNS.chime
  const startAt = ctx.currentTime + 0.02
  let end = 0

  for (const note of pattern.notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = pattern.type
    osc.frequency.value = note.freq
    const t0 = startAt + note.at
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(pattern.gain, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + note.dur + 0.05)
    end = Math.max(end, note.at + note.dur)
  }
  // Close the context after the last note so we don't leak. Some browsers
  // complain about close() on already-closed contexts; swallow that.
  setTimeout(() => {
    try { ctx.close() } catch { /* already closed */ }
  }, (end + 0.4) * 1000)
  return true
}

export function celebrate(options = {}) {
  const { confetti = true, sound = true } = options
  const results = {}
  // `confetti` / `sound` are booleans in normal use (from settings). Tests may
  // pass a plain object of sub-options instead — handle both without coercing
  // a falsy boolean into a call.
  if (confetti) results.confetti = fireConfetti(typeof options.confetti === 'object' ? options.confetti : {})
  if (sound) results.sound = playWinnerSound(typeof options.sound === 'object' ? options.sound : {})
  return results
}
