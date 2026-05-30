// Winner-reveal celebration effects: a confetti burst rendered onto a
// full-screen canvas, and a short celebratory chime via Web Audio.
//
// Both are no-op-safe: they bail out cleanly when their underlying browser API
// isn't available (e.g. jsdom in tests, the page is hidden, autoplay blocked).

const CANVAS_ID = 'celebration-canvas'
const DEFAULT_COLORS = ['#ff6f61', '#1c8c9a', '#1e3d59', '#ffcf48', '#7ed957', '#e0f7fa']

export function fireConfetti({
  particleCount = 160,
  durationMs = 2400,
  colors = DEFAULT_COLORS,
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

// Short major-chord arpeggio. Web Audio is enough — no asset to bundle.
export function playWinnerSound({ AudioContextCtor } = {}) {
  if (typeof window === 'undefined') return false
  const Ctor = AudioContextCtor || window.AudioContext || window.webkitAudioContext
  if (!Ctor) return false
  let ctx
  try {
    ctx = new Ctor()
  } catch {
    return false
  }
  // C5, E5, G5, C6 — bright and unambiguously "win".
  const notes = [523.25, 659.25, 783.99, 1046.5]
  const startAt = ctx.currentTime + 0.02
  const noteDur = 0.18

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t0 = startAt + i * noteDur * 0.7
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + noteDur + 0.05)
  })
  // Close the context after the last note so we don't leak. Some browsers
  // complain about close() on already-closed contexts; swallow that.
  setTimeout(() => {
    try { ctx.close() } catch { /* already closed */ }
  }, (notes.length * noteDur * 0.7 + 0.4) * 1000)
  return true
}

export function celebrate(options = {}) {
  const { confetti = true, sound = true } = options
  const results = {}
  if (confetti) results.confetti = fireConfetti(options.confetti === true ? {} : options.confetti)
  if (sound) results.sound = playWinnerSound(options.sound === true ? {} : options.sound)
  return results
}
