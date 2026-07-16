// Draw-timing resolution.
//
// The operator chooses how long the reveal animation runs via
// `settings.drawTiming`:
//   { mode: 'fixed' | 'random' | 'manual', fixedMs, minMs, maxMs }
//
// - 'fixed'  — every draw runs for `fixedMs`.
// - 'random' — each draw runs a uniform-random duration in [minMs, maxMs]
//   (order-safe: reversed bounds are swapped).
// - 'manual' — the operator stops the spin by hand, so there is no fixed
//   length; resolveDrawDuration returns MANUAL_DURATION (Infinity) as the
//   "free-spin until stopped" sentinel.
//
// The concrete duration is resolved on the drawing screen (where the animation
// actually runs) so multi-display stays in sync — a random length is decided in
// exactly one place per draw.

// Sentinel meaning "spin until the operator stops it". Callers test with
// Number.isFinite() rather than comparing against this directly.
export const MANUAL_DURATION = Infinity

// Allowed bounds for the configurable durations (milliseconds). Used by both the
// settings validation and the settings UI sliders.
export const MIN_DRAW_MS = 500
export const MAX_DRAW_MS = 30000

export const DRAW_TIMING_MODES = ['fixed', 'random', 'manual']

export function clampDrawMs(ms, fallback) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_DRAW_MS, Math.max(MIN_DRAW_MS, Math.round(n)))
}

// Resolve a concrete animation duration (ms) for one draw. `random` is
// injectable for deterministic tests.
export function resolveDrawDuration(drawTiming, random = Math.random) {
  if (!drawTiming || typeof drawTiming !== 'object') return MANUAL_DURATION
  if (drawTiming.mode === 'manual') return MANUAL_DURATION
  if (drawTiming.mode === 'random') {
    const lo = Math.min(drawTiming.minMs, drawTiming.maxMs)
    const hi = Math.max(drawTiming.minMs, drawTiming.maxMs)
    return lo + random() * (hi - lo)
  }
  // 'fixed' (and any unexpected mode) → the fixed duration.
  return drawTiming.fixedMs
}
